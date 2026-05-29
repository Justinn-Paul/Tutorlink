export type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

export function apiBase(): string {
  const base = import.meta.env.VITE_API_BASE_URL;
  if (!base || typeof base !== "string") {
    throw new Error("VITE_API_BASE_URL is not set");
  }
  return base.replace(/\/$/, "");
}
