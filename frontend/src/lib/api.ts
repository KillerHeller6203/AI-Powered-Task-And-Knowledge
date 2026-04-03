import type { User } from "@/api";

  export function getAuthHeaders(): Record<string, string> {
    const token = localStorage.getItem("taskiq_token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  export function getToken(): string | null {
    return localStorage.getItem("taskiq_token");
  }

  export function getUser(): User | null {
    const u = localStorage.getItem("taskiq_user");
    return u ? JSON.parse(u) : null;
  }

  export function setAuth(token: string, user: User) {
    localStorage.setItem("taskiq_token", token);
    localStorage.setItem("taskiq_user", JSON.stringify(user));
  }

  export function clearAuth() {
    localStorage.removeItem("taskiq_token");
    localStorage.removeItem("taskiq_user");
  }
  