import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { getEmailFromIdToken, getJwtExp } from "./jwt";

export type AuthTokens = {
  idToken: string;
  accessToken: string;
  refreshToken: string;
};

type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

type AuthContextValue = {
  login: (tokens: AuthTokens) => void;
  logout: () => void;
  getIdToken: () => Promise<string | null>;
  userEmail: string | null;
  isAuthenticated: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function apiBase(): string {
  const base = import.meta.env.VITE_API_BASE_URL;
  if (!base || typeof base !== "string") {
    throw new Error("VITE_API_BASE_URL is not set");
  }
  return base.replace(/\/$/, "");
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const tokensRef = useRef<AuthTokens | null>(null);
  const refreshInFlight = useRef<Promise<void> | null>(null);
  const [, setRenderKey] = useState(0);

  const bump = useCallback(() => setRenderKey((k) => k + 1), []);

  const login = useCallback(
    (tokens: AuthTokens) => {
      tokensRef.current = tokens;
      bump();
    },
    [bump]
  );

  const logout = useCallback(() => {
    tokensRef.current = null;
    bump();
  }, [bump]);

  const refreshSession = useCallback(async () => {
    const rt = tokensRef.current?.refreshToken;
    if (!rt) throw new Error("No refresh token");

    const res = await fetch(`${apiBase()}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: rt }),
    });

    const json = (await res.json()) as ApiResponse<{
      idToken: string;
      accessToken: string;
      expiresIn: number;
    }>;

    if (!res.ok || !json.success || !json.data) {
      throw new Error(json.error ?? "Session refresh failed");
    }

    const { idToken, accessToken } = json.data;
    const prev = tokensRef.current;
    if (!prev) throw new Error("Session lost");
    tokensRef.current = {
      ...prev,
      idToken,
      accessToken,
    };
    bump();
  }, [bump]);

  const getIdToken = useCallback(async (): Promise<string | null> => {
    const current = tokensRef.current;
    if (!current?.idToken || !current.refreshToken) return null;

    const exp = getJwtExp(current.idToken);
    const now = Math.floor(Date.now() / 1000);
    if (exp !== null && exp > now + 60) {
      return current.idToken;
    }

    if (refreshInFlight.current) {
      await refreshInFlight.current;
      return tokensRef.current?.idToken ?? null;
    }

    const p = refreshSession().catch((err) => {
      console.error(err);
      logout();
      throw err;
    });

    refreshInFlight.current = p.then(() => undefined);
    try {
      await refreshInFlight.current;
    } finally {
      refreshInFlight.current = null;
    }

    return tokensRef.current?.idToken ?? null;
  }, [logout, refreshSession]);

  const idToken = tokensRef.current?.idToken ?? null;
  const userEmail = idToken ? getEmailFromIdToken(idToken) : null;
  const isAuthenticated = Boolean(idToken);

  const value: AuthContextValue = {
    login,
    logout,
    getIdToken,
    userEmail,
    isAuthenticated,
  };

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
