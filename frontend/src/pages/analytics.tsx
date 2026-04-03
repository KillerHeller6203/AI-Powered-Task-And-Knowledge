import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useGetAnalytics } from "@/api";
import { Loader2, Users, FileText, CheckCircle, Search, Activity } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import { format } from "date-fns";

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

const ACTION_COLORS: Record<string, string> = {
  login: "bg-blue-500/10 text-blue-500",
  search: "bg-purple-500/10 text-purple-500",
  document_uploaded: "bg-green-500/10 text-green-600",
  document_deleted: "bg-red-500/10 text-red-500",
  task_created: "bg-yellow-500/10 text-yellow-600",
  task_updated: "bg-orange-500/10 text-orange-500",
  task_deleted: "bg-red-500/10 text-red-500",
};

export default function AnalyticsPage() {
  const { data: analytics, isLoading } = useGetAnalytics();

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (!analytics) return null;

  const taskStatusData = [
    { name: "Pending", value: analytics.tasks.pending },
    { name: "Completed", value: analytics.tasks.completed },
    { name: "In Progress", value: analytics.tasks.in_progress },
  ].filter((d) => d.value > 0);

  const searchData = analytics.searches.top_queries.slice(0, 8).map((q) => ({
    name: q.query.length > 20 ? `${q.query.slice(0, 20)}…` : q.query,
    fullQuery: q.query,
    searches: q.count,
  }));

  const userStatsData = [
    { name: "Active Users", value: analytics.users.active_users },
    { name: "Admins", value: analytics.users.admins },
  ];

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics Overview</h1>
          <p className="text-muted-foreground mt-1">System-wide metrics and usage statistics.</p>
        </div>

        {/* Stat cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
              <CheckCircle className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.tasks.total}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {analytics.tasks.completion_rate}% completion rate
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">Documents</CardTitle>
              <FileText className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.documents.total_documents}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {analytics.documents.total_chunks} indexed chunks
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">Total Searches</CardTitle>
              <Search className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.searches.total_searches}</div>
              <p className="text-xs text-muted-foreground mt-1">Across all users</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">Users</CardTitle>
              <Users className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.users.total_users}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {analytics.users.active_users} active · {analytics.users.admins} admin
                {analytics.users.admins !== 1 ? "s" : ""}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts row */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Task distribution pie */}
          <Card>
            <CardHeader>
              <CardTitle>Task Status Distribution</CardTitle>
              <CardDescription>Breakdown of tasks by current status</CardDescription>
            </CardHeader>
            <CardContent>
              {analytics.tasks.total === 0 ? (
                <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">
                  No tasks yet
                </div>
              ) : (
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={taskStatusData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={4}
                        dataKey="value"
                        label={({ name, percent }) =>
                          `${name} ${(percent * 100).toFixed(0)}%`
                        }
                        labelLine={false}
                      >
                        {taskStatusData.map((_, index) => (
                          <Cell key={index} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          borderColor: "hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top search queries bar chart */}
          <Card>
            <CardHeader>
              <CardTitle>Top Search Queries</CardTitle>
              <CardDescription>Most frequent knowledge base queries</CardDescription>
            </CardHeader>
            <CardContent>
              {searchData.length === 0 ? (
                <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">
                  No searches yet
                </div>
              ) : (
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={searchData}
                      layout="vertical"
                      margin={{ top: 5, right: 24, left: 8, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                      <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} allowDecimals={false} />
                      <YAxis
                        dataKey="name"
                        type="category"
                        width={110}
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={11}
                      />
                      <RechartsTooltip
                        cursor={{ fill: "hsl(var(--muted)/0.4)" }}
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          borderColor: "hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                        formatter={(val: number, _name: string, props: any) => [
                          `${val} search${val !== 1 ? "es" : ""}`,
                          props.payload.fullQuery,
                        ]}
                      />
                      <Bar dataKey="searches" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} barSize={20} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* User stats + recent activity */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* User stats */}
          <Card>
            <CardHeader>
              <CardTitle>User Statistics</CardTitle>
              <CardDescription>Active users and role breakdown</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { label: "Total Users", value: analytics.users.total_users },
                  { label: "Active Users", value: analytics.users.active_users },
                  { label: "Admins", value: analytics.users.admins },
                  {
                    label: "Regular Users",
                    value: analytics.users.total_users - analytics.users.admins,
                  },
                ].map((row) => (
                  <div key={row.label} className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">{row.label}</span>
                    <span className="font-semibold text-sm">{row.value}</span>
                  </div>
                ))}
                <div className="pt-2 border-t">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Task Completion Rate</span>
                    <span className="font-semibold text-sm text-primary">
                      {analytics.tasks.completion_rate}%
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent activity feed */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Recent Activity
              </CardTitle>
              <CardDescription>Latest actions across the platform</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {analytics.recent_activity.length === 0 ? (
                <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                  No activity yet
                </div>
              ) : (
                <div className="divide-y max-h-72 overflow-y-auto">
                  {analytics.recent_activity.map((log) => (
                    <div key={log.id} className="flex items-start gap-3 px-6 py-3">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-medium shrink-0 mt-0.5 ${
                          ACTION_COLORS[log.action] ?? "bg-muted text-muted-foreground"
                        }`}
                      >
                        {log.action}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">
                          {log.username ?? "System"}
                          {log.details ? ` — ${log.details}` : ""}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {format(new Date(log.created_at), "MMM d, HH:mm")}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
