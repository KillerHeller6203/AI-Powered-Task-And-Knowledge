import { useAuth } from "@/lib/auth";
import { useGetAnalytics, useListTasks, useListDocuments } from "@/api";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, CheckCircle2, Clock, FileText, Search, ListTodo } from "lucide-react";
import { format } from "date-fns";

const PRIORITY_COLORS: Record<string, string> = {
  high: "bg-red-500/10 text-red-500",
  medium: "bg-yellow-500/10 text-yellow-600",
  low: "bg-green-500/10 text-green-600",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-blue-500/10 text-blue-500",
  completed: "bg-green-500/10 text-green-600",
};

export default function Dashboard() {
  const { user } = useAuth();
  const { data: analytics, isLoading: analyticsLoading } = useGetAnalytics();
  const { data: taskPage, isLoading: tasksLoading } = useListTasks(
    { page: 1, page_size: 5 },
    { query: { enabled: !!user } },
  );
  const { data: documents, isLoading: docsLoading } = useListDocuments();

  const stats = analytics
    ? [
        { label: "Total Tasks", value: analytics.tasks.total, icon: ListTodo, sub: `${analytics.tasks.completion_rate}% completion rate` },
        { label: "Completed", value: analytics.tasks.completed, icon: CheckCircle2, sub: `${analytics.tasks.pending} still pending` },
        { label: "Documents", value: analytics.documents.total_documents, icon: FileText, sub: `${analytics.documents.total_chunks} indexed chunks` },
        { label: "Total Searches", value: analytics.searches.total_searches, icon: Search, sub: "Across all users" },
      ]
    : [];

  return (
    <Layout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Welcome back, {user?.username}</h1>
          <p className="text-muted-foreground mt-1">Here is an overview of your workspace.</p>
        </div>

        {/* Stat Cards */}
        {analyticsLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((s) => (
              <Card key={s.label}>
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-sm font-medium">{s.label}</CardTitle>
                  <s.icon className="w-4 h-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{s.value}</div>
                  <p className="text-xs text-muted-foreground mt-1">{s.sub}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          {/* Recent Tasks */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Tasks</CardTitle>
              <CardDescription>Last 5 tasks in the system</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {tasksLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : taskPage && taskPage.items.length > 0 ? (
                <div className="divide-y">
                  {taskPage.items.map((task) => (
                    <div key={task.id} className="flex items-start gap-3 px-6 py-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{task.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {task.assigned_to_username
                            ? `Assigned to ${task.assigned_to_username}`
                            : "Unassigned"}{" "}
                          · {format(new Date(task.created_at), "MMM d")}
                        </p>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[task.priority] ?? ""}`}>
                          {task.priority}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[task.status] ?? ""}`}>
                          {task.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
                  <Clock className="w-8 h-8 mb-2 opacity-30" />
                  <p className="text-sm">No tasks yet</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Documents */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Documents</CardTitle>
              <CardDescription>Last 5 documents in the knowledge base</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {docsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : documents && documents.length > 0 ? (
                <div className="divide-y">
                  {documents.slice(0, 5).map((doc) => (
                    <div key={doc.id} className="flex items-start gap-3 px-6 py-3">
                      <FileText className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{doc.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {doc.filename} · {(doc.file_size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${doc.is_indexed ? "bg-green-500/10 text-green-600" : "bg-yellow-500/10 text-yellow-600"}`}>
                        {doc.is_indexed ? "Indexed" : "Pending"}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
                  <FileText className="w-8 h-8 mb-2 opacity-30" />
                  <p className="text-sm">No documents uploaded yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
