import { createContext, useContext, useEffect, useState, ReactNode } from "react";
  import { useLocation } from "wouter";
  import { getToken, getUser, setAuth as setAuthStorage, clearAuth as clearAuthStorage } from "./api";
  import type { User } from "@/api";

  interface AuthContextType {
    user: User | null;
    token: string | null;
    login: (token: string, user: User) => void;
    logout: () => void;
    isAuthenticated: boolean;
  }

  const AuthContext = createContext<AuthContextType | undefined>(undefined);

  export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [, setLocation] = useLocation();

    useEffect(() => {
      const t = getToken();
      const u = getUser();
      if (t && u) {
        setToken(t);
        setUser(u);
      }
      setIsLoading(false);
    }, []);

    const login = (newToken: string, newUser: User) => {
      setAuthStorage(newToken, newUser);
      setToken(newToken);
      setUser(newUser);
    };

    const logout = () => {
      clearAuthStorage();
      setToken(null);
      setUser(null);
      setLocation("/login");
    };

    if (isLoading) {
      return <div className="min-h-screen bg-background flex items-center justify-center text-foreground">Loading...</div>;
    }

    return (
      <AuthContext.Provider value={{ user, token, login, logout, isAuthenticated: !!token }}>
        {children}
      </AuthContext.Provider>
    );
  }

  export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
      throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
  }
  