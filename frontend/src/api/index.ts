export type CustomFetchOptions = RequestInit & {
    responseType?: "json" | "text" | "blob" | "auto";
  };

  export type ErrorType<T = unknown> = ApiError<T>;
  export type BodyType<T> = T;

  const NO_BODY_STATUS = new Set([204, 205, 304]);
  const DEFAULT_JSON_ACCEPT = "application/json, application/problem+json";

  let _baseUrl: string | null = null;

  export function setBaseUrl(url: string | null): void {
    _baseUrl = url ? url.replace(/\/+$/, "") : null;
  }

  function resolveUrl(input: RequestInfo | URL): string {
    if (typeof input === "string") return input;
    if (input instanceof URL) return input.toString();
    return (input as Request).url;
  }

  function applyBaseUrl(input: RequestInfo | URL): RequestInfo | URL {
    if (!_baseUrl) return input;
    const url = resolveUrl(input);
    if (!url.startsWith("/")) return input;
    return `${_baseUrl}${url}`;
  }

  function mergeHeaders(...sources: Array<HeadersInit | undefined>): Headers {
    const headers = new Headers();
    for (const source of sources) {
      if (!source) continue;
      new Headers(source).forEach((value, key) => headers.set(key, value));
    }
    return headers;
  }

  function getMediaType(headers: Headers): string | null {
    const value = headers.get("content-type");
    return value ? value.split(";", 1)[0].trim().toLowerCase() : null;
  }

  function isJsonMediaType(mediaType: string | null): boolean {
    return mediaType === "application/json" || Boolean(mediaType?.endsWith("+json"));
  }

  function hasNoBody(response: Response, method: string): boolean {
    if (method === "HEAD") return true;
    if (NO_BODY_STATUS.has(response.status)) return true;
    if (response.headers.get("content-length") === "0") return true;
    if (response.body === null) return true;
    return false;
  }

  function looksLikeJson(text: string): boolean {
    const trimmed = text.trimStart();
    return trimmed.startsWith("{") || trimmed.startsWith("[");
  }

  function getStringField(value: unknown, key: string): string | undefined {
    if (!value || typeof value !== "object") return undefined;
    const candidate = (value as Record<string, unknown>)[key];
    if (typeof candidate !== "string") return undefined;
    const trimmed = candidate.trim();
    return trimmed === "" ? undefined : trimmed;
  }

  function buildErrorMessage(response: Response, data: unknown): string {
    const prefix = `HTTP ${response.status} ${response.statusText}`;
    if (typeof data === "string") {
      const text = data.trim();
      return text ? `${prefix}: ${text}` : prefix;
    }
    const detail = getStringField(data, "detail");
    const message = getStringField(data, "message") ?? getStringField(data, "error");
    if (detail) return `${prefix}: ${detail}`;
    if (message) return `${prefix}: ${message}`;
    return prefix;
  }

  export class ApiError<T = unknown> extends Error {
    readonly name = "ApiError";
    readonly status: number;
    readonly statusText: string;
    readonly data: T | null;
    readonly headers: Headers;
    readonly response: Response;
    readonly method: string;
    readonly url: string;

    constructor(response: Response, data: T | null, requestInfo: { method: string; url: string }) {
      super(buildErrorMessage(response, data));
      Object.setPrototypeOf(this, new.target.prototype);
      this.status = response.status;
      this.statusText = response.statusText;
      this.data = data;
      this.headers = response.headers;
      this.response = response;
      this.method = requestInfo.method;
      this.url = response.url || requestInfo.url;
    }
  }

  async function parseErrorBody(response: Response, method: string): Promise<unknown> {
    if (hasNoBody(response, method)) return null;
    const raw = await response.text();
    const normalized = raw.replace(/^\uFEFF/, "").trim();
    if (normalized === "") return null;
    if (isJsonMediaType(getMediaType(response.headers)) || looksLikeJson(normalized)) {
      try { return JSON.parse(normalized); } catch { return raw; }
    }
    return raw;
  }

  async function parseSuccessBody(response: Response, method: string): Promise<unknown> {
    if (hasNoBody(response, method)) return null;
    const raw = await response.text();
    const normalized = raw.replace(/^\uFEFF/, "").trim();
    if (normalized === "") return null;
    const mediaType = getMediaType(response.headers);
    if (isJsonMediaType(mediaType) || looksLikeJson(normalized)) {
      return JSON.parse(normalized);
    }
    return normalized;
  }

  export async function customFetch<T = unknown>(
    input: RequestInfo | URL,
    options: CustomFetchOptions = {},
  ): Promise<T> {
    input = applyBaseUrl(input);
    const { responseType, headers: headersInit, ...init } = options;
    const method = (init.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
    const headers = mergeHeaders(input instanceof Request ? input.headers : undefined, headersInit);

    if (typeof init.body === "string" && !headers.has("content-type") && looksLikeJson(init.body)) {
      headers.set("content-type", "application/json");
    }
    if (!headers.has("accept")) {
      headers.set("accept", DEFAULT_JSON_ACCEPT);
    }
    if (!headers.has("authorization")) {
      const token = typeof window !== "undefined" ? window.localStorage.getItem("taskiq_token") : null;
      if (token) headers.set("authorization", `Bearer ${token}`);
    }

    const requestInfo = { method, url: resolveUrl(input) };
    const response = await fetch(input, { ...init, method, headers });

    if (!response.ok) {
      const errorData = await parseErrorBody(response, method);
      throw new ApiError(response, errorData, requestInfo);
    }

    return (await parseSuccessBody(response, method)) as T;
  }

  // ============================================================
  // TYPES
  // ============================================================

  export interface HealthStatus { status: string; }
  export interface ErrorResponse { detail: string; }
  export interface LoginRequest { username: string; password: string; }

  export type UserRole = "admin" | "user";
  export interface User {
    id: number; username: string; email: string;
    role: UserRole; is_active: boolean; created_at: string;
  }
  export interface LoginResponse { access_token: string; token_type: string; user: User; }
  export interface CreateUserRequest {
    username: string; email: string; password: string; role?: UserRole;
  }

  export type TaskStatus = "pending" | "completed";
  export type TaskPriority = "low" | "medium" | "high";
  export interface Task {
    id: number; title: string; description?: string | null;
    status: TaskStatus; priority: TaskPriority;
    assigned_to?: number | null; assigned_to_username?: string | null;
    created_by: number; created_by_username: string;
    due_date?: string | null; created_at: string; updated_at: string;
  }
  export interface TaskPage {
    items: Task[];
    total: number;
    page: number;
    page_size: number;
  }
  export interface CreateTaskRequest {
    title: string; description?: string | null;
    priority?: TaskPriority; assigned_to?: number | null; due_date?: string | null;
  }
  export interface UpdateTaskRequest {
    title?: string | null; description?: string | null;
    status?: TaskStatus | null; priority?: TaskPriority | null;
    assigned_to?: number | null; due_date?: string | null;
  }
  export interface Document {
    id: number; title: string; description?: string | null;
    filename: string; file_size: number; is_indexed: boolean;
    uploaded_by: number; uploaded_by_username: string;
    content_preview?: string | null;
    created_at: string;
  }
  export interface SearchRequest { query: string; top_k?: number; }
  export interface SearchResult {
    document_id: number; title: string; score: number; excerpt: string;
  }
  export interface SearchResponse { query: string; results: SearchResult[]; total: number; }
  export interface SearchHistoryItem { query: string; created_at: string; }
  export interface ActivityLog {
    id: number; user_id?: number; username?: string;
    action: string; resource_type?: string; resource_id?: number;
    details?: string | null; created_at: string;
  }
  export interface TopQuery { query: string; count: number; }
  export interface TaskAnalytics {
    total: number; pending: number; in_progress: number;
    completed: number; completion_rate: number;
  }
  export interface DocumentAnalytics { total_documents: number; total_chunks: number; }
  export interface SearchAnalytics { total_searches: number; top_queries: TopQuery[]; }
  export interface UserAnalytics { total_users: number; active_users: number; admins: number; }
  export interface Analytics {
    tasks: TaskAnalytics;
    searches: SearchAnalytics;
    users: UserAnalytics;
    documents: DocumentAnalytics;
    recent_activity: ActivityLog[];
  }
  export interface ListTasksParams {
    status?: TaskStatus; assigned_to?: number; created_by?: number;
    priority?: TaskPriority; page?: number; page_size?: number;
  }
  export interface ListActivityLogsParams { limit?: number; offset?: number; user_id?: number; }
  export interface UploadDocumentBody { file: Blob; title: string; description?: string; }

  // ============================================================
  // HOOKS
  // ============================================================

  import { useMutation, useQuery } from "@tanstack/react-query";
  import type { UseQueryOptions, UseMutationOptions } from "@tanstack/react-query";

  // -- Query key factories --
  export const getHealthCheckQueryKey = () => ["/api/healthz"] as const;
  export const getListUsersQueryKey = () => ["/api/users"] as const;
  export const getListTasksQueryKey = (params?: ListTasksParams) =>
    ["/api/tasks", ...(params ? [params] : [])] as const;
  export const getListDocumentsQueryKey = () => ["/api/documents"] as const;
  export const getGetAnalyticsQueryKey = () => ["/api/analytics"] as const;
  export const getListActivityLogsQueryKey = (params?: ListActivityLogsParams) =>
    ["/api/activity", ...(params ? [params] : [])] as const;

  // -- Auth --
  export const useLogin = (options?: { mutation?: UseMutationOptions<LoginResponse, ErrorType<ErrorResponse>, { data: LoginRequest }> }) =>
    useMutation({
      mutationKey: ["login"],
      mutationFn: ({ data }: { data: LoginRequest }) => customFetch<LoginResponse>("/api/auth/login", { method: "POST", body: JSON.stringify(data) }),
      ...options?.mutation,
    });

  export const useRegister = (options?: { mutation?: UseMutationOptions<User, ErrorType<ErrorResponse>, { data: CreateUserRequest }> }) =>
    useMutation({
      mutationKey: ["register"],
      mutationFn: ({ data }: { data: CreateUserRequest }) => customFetch<User>("/api/auth/register", { method: "POST", body: JSON.stringify(data) }),
      ...options?.mutation,
    });

  // -- Users --
  export const useListUsers = (options?: { query?: UseQueryOptions<User[]> }) =>
    useQuery({ queryKey: getListUsersQueryKey(), queryFn: () => customFetch<User[]>("/api/users"), ...options?.query });

  export const useCreateUser = (options?: { mutation?: UseMutationOptions<User, ErrorType<ErrorResponse>, { data: CreateUserRequest }> }) =>
    useMutation({
      mutationKey: ["createUser"],
      mutationFn: ({ data }: { data: CreateUserRequest }) => customFetch<User>("/api/users", { method: "POST", body: JSON.stringify(data) }),
      ...options?.mutation,
    });

  // -- Tasks --
  export const useListTasks = (params?: ListTasksParams, options?: { query?: UseQueryOptions<TaskPage> }) => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined) searchParams.append(k, String(v));
      });
    }
    const qs = searchParams.toString();
    const url = qs ? `/api/tasks?${qs}` : "/api/tasks";
    return useQuery({ queryKey: getListTasksQueryKey(params), queryFn: () => customFetch<TaskPage>(url), ...options?.query });
  };

  export const useCreateTask = (options?: { mutation?: UseMutationOptions<Task, ErrorType<ErrorResponse>, { data: CreateTaskRequest }> }) =>
    useMutation({
      mutationKey: ["createTask"],
      mutationFn: ({ data }: { data: CreateTaskRequest }) => customFetch<Task>("/api/tasks", { method: "POST", body: JSON.stringify(data) }),
      ...options?.mutation,
    });

  export const useUpdateTask = (options?: { mutation?: UseMutationOptions<Task, ErrorType<ErrorResponse>, { id: number; data: UpdateTaskRequest }> }) =>
    useMutation({
      mutationKey: ["updateTask"],
      mutationFn: ({ id, data }: { id: number; data: UpdateTaskRequest }) => customFetch<Task>(`/api/tasks/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
      ...options?.mutation,
    });

  // -- Documents --
  export const useListDocuments = (options?: { query?: UseQueryOptions<Document[]> }) =>
    useQuery({ queryKey: getListDocumentsQueryKey(), queryFn: () => customFetch<Document[]>("/api/documents"), ...options?.query });

  export const useDeleteDocument = (options?: { mutation?: UseMutationOptions<void, ErrorType<ErrorResponse>, { id: number }> }) =>
    useMutation({
      mutationKey: ["deleteDocument"],
      mutationFn: ({ id }: { id: number }) => customFetch<void>(`/api/documents/${id}`, { method: "DELETE" }),
      ...options?.mutation,
    });

  // -- Search --
  export const useSearchDocuments = (options?: { mutation?: UseMutationOptions<SearchResponse, ErrorType<ErrorResponse>, { data: SearchRequest }> }) =>
    useMutation({
      mutationKey: ["searchDocuments"],
      mutationFn: ({ data }: { data: SearchRequest }) => customFetch<SearchResponse>("/api/search", { method: "POST", body: JSON.stringify(data) }),
      ...options?.mutation,
    });

  // -- Analytics --
  export const useGetAnalytics = (options?: { query?: UseQueryOptions<Analytics> }) =>
    useQuery({ queryKey: getGetAnalyticsQueryKey(), queryFn: () => customFetch<Analytics>("/api/analytics"), ...options?.query });

  // -- Activity Logs --
  export const useListActivityLogs = (params?: ListActivityLogsParams, options?: { query?: UseQueryOptions<ActivityLog[]> }) => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined) searchParams.append(k, String(v));
      });
    }
    const qs = searchParams.toString();
    const url = qs ? `/api/activity?${qs}` : "/api/activity";
    return useQuery({ queryKey: getListActivityLogsQueryKey(params), queryFn: () => customFetch<ActivityLog[]>(url), ...options?.query });
  };
