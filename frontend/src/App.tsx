import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
  import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
  import { Toaster } from "@/components/ui/toaster";
  import { TooltipProvider } from "@/components/ui/tooltip";
  import { AuthProvider } from "@/lib/auth";
  import { ProtectedRoute } from "@/components/protected-route";

  import NotFound from "@/pages/not-found";
  import Login from "@/pages/login";
  import Register from "@/pages/register";
  import Dashboard from "@/pages/dashboard";
  import AdminPage from "@/pages/admin";
  import AnalyticsPage from "@/pages/analytics";
  import SearchPage from "@/pages/search";

  const queryClient = new QueryClient();

  function Router() {
    return (
      <Switch>
        <Route path="/login" component={Login} />
        <Route path="/register" component={Register} />

        <Route path="/">
          <Redirect to="/dashboard" />
        </Route>

        <Route path="/dashboard">
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        </Route>

        <Route path="/admin">
          <ProtectedRoute requireAdmin={true}>
            <AdminPage />
          </ProtectedRoute>
        </Route>

        <Route path="/analytics">
          <ProtectedRoute>
            <AnalyticsPage />
          </ProtectedRoute>
        </Route>

        <Route path="/search">
          <ProtectedRoute>
            <SearchPage />
          </ProtectedRoute>
        </Route>

        <Route component={NotFound} />
      </Switch>
    );
  }

  function App() {
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter>
            <AuthProvider>
              <Router />
            </AuthProvider>
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    );
  }

  export default App;
  