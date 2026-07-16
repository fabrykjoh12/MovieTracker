/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { PropsWithChildren } from "react";
import { getNeonClient, isNeonConfigured } from "../lib/neon";

type AuthStatus = "loading" | "authenticated" | "anonymous" | "demo";

interface AuthUser {
  id: string;
  email: string;
  name: string;
  image?: string | null;
}

interface AuthResult {
  error?: string;
}

interface AuthValue {
  user: AuthUser | null;
  status: AuthStatus;
  isConfigured: boolean;
  signInWithPassword: (email: string, password: string) => Promise<AuthResult>;
  requestPasswordReset: (
    email: string,
    redirectTo: string,
  ) => Promise<AuthResult>;
  resetPassword: (newPassword: string, token: string) => Promise<AuthResult>;
  signOut: () => Promise<AuthResult>;
}

const AuthContext = createContext<AuthValue | null>(null);

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }
  return fallback;
}

export function AuthProvider({ children }: PropsWithChildren) {
  const clientRef = useRef<Awaited<ReturnType<typeof getNeonClient>>>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>(
    isNeonConfigured ? "loading" : "demo",
  );

  const refreshSession = useCallback(async () => {
    try {
      const client = clientRef.current ?? (await getNeonClient());
      if (!client) return;
      clientRef.current = client;
      const result = await client.auth.getSession();
      setUser(result.data?.user ?? null);
      setStatus(result.data?.user ? "authenticated" : "anonymous");
    } catch {
      setUser(null);
      setStatus("anonymous");
    }
  }, []);

  useEffect(() => {
    if (!isNeonConfigured) return;
    queueMicrotask(() => void refreshSession());

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void refreshSession();
    };
    window.addEventListener("focus", refreshSession);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.removeEventListener("focus", refreshSession);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [refreshSession]);

  const signInWithPassword = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      try {
        const client = clientRef.current ?? (await getNeonClient());
        if (!client)
          return { error: "Neon is not configured for this deployment." };
        clientRef.current = client;
        const result = await client.auth.signIn.email({
          email,
          password,
          rememberMe: true,
        });
        if (result.error) {
          return { error: errorMessage(result.error, "Unable to sign in.") };
        }
        setUser(result.data?.user ?? null);
        setStatus(result.data?.user ? "authenticated" : "anonymous");
        return {};
      } catch (error) {
        return { error: errorMessage(error, "Unable to sign in.") };
      }
    },
    [],
  );

  const signOut = useCallback(async (): Promise<AuthResult> => {
    try {
      const client = clientRef.current ?? (await getNeonClient());
      if (!client) return {};
      clientRef.current = client;
      const result = await client.auth.signOut();
      if (result.error) {
        return { error: errorMessage(result.error, "Unable to sign out.") };
      }
      setUser(null);
      setStatus("anonymous");
      return {};
    } catch (error) {
      return { error: errorMessage(error, "Unable to sign out.") };
    }
  }, []);

  const requestPasswordReset = useCallback(
    async (email: string, redirectTo: string): Promise<AuthResult> => {
      try {
        const client = clientRef.current ?? (await getNeonClient());
        if (!client)
          return { error: "Neon is not configured for this deployment." };
        clientRef.current = client;
        const result = await client.auth.requestPasswordReset({
          email,
          redirectTo,
        });
        if (result.error) {
          return {
            error: errorMessage(
              result.error,
              "Unable to send the password setup email.",
            ),
          };
        }
        return {};
      } catch (error) {
        return {
          error: errorMessage(
            error,
            "Unable to send the password setup email.",
          ),
        };
      }
    },
    [],
  );

  const resetPassword = useCallback(
    async (newPassword: string, token: string): Promise<AuthResult> => {
      try {
        const client = clientRef.current ?? (await getNeonClient());
        if (!client)
          return { error: "Neon is not configured for this deployment." };
        clientRef.current = client;
        const result = await client.auth.resetPassword({ newPassword, token });
        if (result.error) {
          return {
            error: errorMessage(result.error, "Unable to set your password."),
          };
        }
        return {};
      } catch (error) {
        return {
          error: errorMessage(error, "Unable to set your password."),
        };
      }
    },
    [],
  );

  const value = useMemo<AuthValue>(
    () => ({
      user,
      status,
      isConfigured: isNeonConfigured,
      signInWithPassword,
      requestPasswordReset,
      resetPassword,
      signOut,
    }),
    [
      requestPasswordReset,
      resetPassword,
      signInWithPassword,
      signOut,
      status,
      user,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
