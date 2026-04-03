import { useState, useRef } from "react";
import { Layout } from "@/components/layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  useListUsers, useCreateUser, useListTasks, useCreateTask,
  useListDocuments, useDeleteDocument, useListActivityLogs,
  getListUsersQueryKey, getListTasksQueryKey, getListDocumentsQueryKey,
} from "@/api";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { TaskCard } from "@/components/task-card";
import { Loader2, Plus, Upload, Trash2, ShieldAlert } from "lucide-react";
import { format } from "date-fns";
import { getToken } from "@/lib/api";

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState("users");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Queries
  const { data: users, isLoading: usersLoading } = useListUsers();
  const { data: taskPage, isLoading: tasksLoading } = useListTasks({ page: 1, page_size: 100 });
  const { data: documents, isLoading: docsLoading } = useListDocuments();
  const { data: logs, isLoading: logsLoading } = useListActivityLogs({ limit: 50 });

  // Mutations
  const createUser = useCreateUser();
  const createTask = useCreateTask();
  const deleteDoc = useDeleteDocument();

  // Task form
  const [newTask, setNewTask] = useState({
    title: "", description: "", priority: "medium", assigned_to: "", due_date: "",
  });

  // User form
  const [newUser, setNewUser] = useState({
    username: "", email: "", password: "", role: "user",
  });

  // File upload state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadDesc, setUploadDesc] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    createTask.mutate(
      {
        data: {
          title: newTask.title,
          description: newTask.description || undefined,
          priority: newTask.priority as any,
          assigned_to: newTask.assigned_to ? parseInt(newTask.assigned_to) : null,
          due_date: newTask.due_date ? new Date(newTask.due_date).toISOString() : null,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Task created successfully" });
          setNewTask({ title: "", description: "", priority: "medium", assigned_to: "", due_date: "" });
          queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
        },
        onError: (err: any) => {
          toast({ variant: "destructive", title: "Failed to create task", description: err.data?.detail });
        },
      },
    );
  };

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    createUser.mutate(
      { data: newUser as any },
      {
        onSuccess: () => {
          toast({ title: "User created successfully" });
          setNewUser({ username: "", email: "", password: "", role: "user" });
          queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
        },
        onError: (err: any) => {
          toast({ variant: "destructive", title: "Failed to create user", description: err.data?.detail });
        },
      },
    );
  };

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile || !uploadTitle) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", uploadFile);
    formData.append("title", uploadTitle);
    if (uploadDesc) formData.append("description", uploadDesc);

    try {
      const token = getToken();
      const res = await fetch("/api/documents/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Upload failed");
      }

      toast({ title: "Document uploaded and indexed", description: "It is now searchable." });
      setUploadFile(null);
      setUploadTitle("");
      setUploadDesc("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      queryClient.invalidateQueries({ queryKey: getListDocumentsQueryKey() });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Upload failed", description: err.message });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteDoc = (id: number) => {
    if (!confirm("Delete this document? This cannot be undone.")) return;
    deleteDoc.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: "Document deleted" });
          queryClient.invalidateQueries({ queryKey: getListDocumentsQueryKey() });
        },
      },
    );
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin Console</h1>
          <p className="text-muted-foreground mt-1">
            Manage users, tasks, documents, and system settings.
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent">
            {["users", "tasks", "documents", "logs"].map((tab) => (
              <TabsTrigger
                key={tab}
                value={tab}
                className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2 capitalize"
              >
                {tab === "logs" ? "Activity Logs" : tab === "tasks" ? "Task Management" : tab === "users" ? "User Management" : "Knowledge Base"}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* TAB 1: USER MANAGEMENT */}
          <TabsContent value="users" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Create New User</CardTitle>
                <CardDescription>Add a new account to the system</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateUser} className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="user-name">Username</Label>
                    <Input
                      id="user-name"
                      required
                      value={newUser.username}
                      onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="user-email">Email</Label>
                    <Input
                      id="user-email"
                      type="email"
                      required
                      value={newUser.email}
                      onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="user-pass">Password</Label>
                    <Input
                      id="user-pass"
                      type="password"
                      required
                      value={newUser.password}
                      onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="user-role">Role</Label>
                    <Select
                      value={newUser.role}
                      onValueChange={(v) => setNewUser({ ...newUser, role: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">User</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="sm:col-span-2 flex justify-end">
                    <Button type="submit" disabled={createUser.isPending}>
                      {createUser.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <Plus className="w-4 h-4 mr-2" />
                      )}
                      Create User
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <div className="border rounded-md overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/50 text-muted-foreground border-b">
                  <tr>
                    <th className="px-4 py-3 font-medium">Username</th>
                    <th className="px-4 py-3 font-medium">Email</th>
                    <th className="px-4 py-3 font-medium">Role</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {usersLoading ? (
                    <tr>
                      <td colSpan={5} className="text-center py-6">
                        <Loader2 className="w-5 h-5 animate-spin inline" />
                      </td>
                    </tr>
                  ) : (
                    users?.map((u) => (
                      <tr key={u.id} className="border-b last:border-0 hover:bg-muted/20">
                        <td className="px-4 py-3 font-medium">{u.username}</td>
                        <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-medium ${u.role === "admin" ? "bg-primary/10 text-primary" : "bg-muted"}`}
                          >
                            {u.role}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full ${u.is_active ? "bg-green-500" : "bg-red-500"}`} />
                            {u.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {format(new Date(u.created_at), "MMM d, yyyy")}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* TAB 2: TASK MANAGEMENT */}
          <TabsContent value="tasks" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Create New Task</CardTitle>
                <CardDescription>Assign tasks to team members</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateTask} className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="task-title">Title</Label>
                    <Input
                      id="task-title"
                      required
                      value={newTask.title}
                      onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="task-assignee">Assign To</Label>
                    <Select
                      value={newTask.assigned_to}
                      onValueChange={(v) => setNewTask({ ...newTask, assigned_to: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select user" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Unassigned</SelectItem>
                        {users?.map((u) => (
                          <SelectItem key={u.id} value={u.id.toString()}>
                            {u.username}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="task-desc">Description</Label>
                    <Textarea
                      id="task-desc"
                      rows={2}
                      value={newTask.description}
                      onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="task-priority">Priority</Label>
                    <Select
                      value={newTask.priority}
                      onValueChange={(v) => setNewTask({ ...newTask, priority: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="task-due">Due Date</Label>
                    <Input
                      id="task-due"
                      type="date"
                      value={newTask.due_date}
                      onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
                    />
                  </div>
                  <div className="sm:col-span-2 flex justify-end">
                    <Button type="submit" disabled={createTask.isPending}>
                      {createTask.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <Plus className="w-4 h-4 mr-2" />
                      )}
                      Create Task
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold">
                All Tasks{" "}
                {taskPage && (
                  <span className="text-sm font-normal text-muted-foreground">
                    ({taskPage.total} total)
                  </span>
                )}
              </h3>
              {tasksLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {taskPage?.items.map((task) => (
                    <TaskCard key={task.id} task={task} isAdmin={true} />
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* TAB 3: KNOWLEDGE BASE / DOCUMENTS */}
          <TabsContent value="documents" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Upload Document</CardTitle>
                <CardDescription>
                  Upload .txt or .pdf files to the knowledge base for semantic search
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleFileUpload} className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="doc-file">File (.txt or .pdf)</Label>
                    <Input
                      id="doc-file"
                      type="file"
                      accept=".txt,.pdf"
                      required
                      ref={fileInputRef}
                      onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="doc-title">Document Title</Label>
                    <Input
                      id="doc-title"
                      required
                      value={uploadTitle}
                      onChange={(e) => setUploadTitle(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="doc-desc">Description (optional)</Label>
                    <Input
                      id="doc-desc"
                      value={uploadDesc}
                      onChange={(e) => setUploadDesc(e.target.value)}
                    />
                  </div>
                  <div className="sm:col-span-2 flex justify-end">
                    <Button type="submit" disabled={isUploading || !uploadFile || !uploadTitle}>
                      {isUploading ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <Upload className="w-4 h-4 mr-2" />
                      )}
                      Upload and Index
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Uploaded Documents</h3>
              {docsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {documents?.map((doc) => (
                    <Card key={doc.id}>
                      <CardContent className="p-4 flex justify-between items-start">
                        <div className="min-w-0 flex-1">
                          <h4 className="font-medium text-base truncate">{doc.title}</h4>
                          <p className="text-xs text-muted-foreground mb-2">
                            {doc.filename} · {(doc.file_size / 1024).toFixed(1)} KB
                          </p>
                          <div className="flex items-center gap-2 text-xs">
                            <span
                              className={`px-2 py-0.5 rounded-full ${doc.is_indexed ? "bg-green-500/10 text-green-600" : "bg-yellow-500/10 text-yellow-600"}`}
                            >
                              {doc.is_indexed ? "Indexed" : "Indexing…"}
                            </span>
                            <span className="text-muted-foreground">
                              by {doc.uploaded_by_username}
                            </span>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteDoc(doc.id)}
                          className="text-destructive hover:bg-destructive/10 shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* TAB 4: ACTIVITY LOGS */}
          <TabsContent value="logs" className="space-y-4">
            <div className="flex items-center gap-2 p-4 bg-muted/50 rounded-lg text-sm text-muted-foreground">
              <ShieldAlert className="w-4 h-4 text-primary" />
              Showing the latest 50 system activity logs.
            </div>
            <div className="border rounded-md overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/50 text-muted-foreground border-b">
                  <tr>
                    <th className="px-4 py-3 font-medium">Time</th>
                    <th className="px-4 py-3 font-medium">User</th>
                    <th className="px-4 py-3 font-medium">Action</th>
                    <th className="px-4 py-3 font-medium">Resource</th>
                    <th className="px-4 py-3 font-medium">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {logsLoading ? (
                    <tr>
                      <td colSpan={5} className="text-center py-6">
                        <Loader2 className="w-5 h-5 animate-spin inline" />
                      </td>
                    </tr>
                  ) : (
                    logs?.map((log) => (
                      <tr key={log.id} className="hover:bg-muted/20">
                        <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                          {format(new Date(log.created_at), "MMM d, HH:mm:ss")}
                        </td>
                        <td className="px-4 py-3 font-medium">{log.username ?? "System"}</td>
                        <td className="px-4 py-3">
                          <span className="bg-muted px-2 py-0.5 rounded text-xs font-mono">
                            {log.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {log.resource_type}
                          {log.resource_id ? ` #${log.resource_id}` : ""}
                        </td>
                        <td
                          className="px-4 py-3 text-muted-foreground truncate max-w-xs"
                          title={log.details ?? ""}
                        >
                          {log.details ?? "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
