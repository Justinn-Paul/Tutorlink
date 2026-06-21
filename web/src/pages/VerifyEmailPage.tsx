import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { apiBase, type ApiResponse } from "../lib/api";

const RESEND_COOLDOWN_SEC = 60;

function getEmailFromQuery(): string | null {
  const email = new URLSearchParams(window.location.search).get("email");
  return email?.trim() ? email.trim() : null;
}

export function VerifyEmailPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const email = useMemo(() => getEmailFromQuery(), []);

  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [codeExpired, setCodeExpired] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setResendCooldown((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  if (!email) {
    return <Navigate to="/signup" replace />;
  }

  function onCodeChange(raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, 6);
    setCode(digits);
    setError(null);
  }

  async function onVerify(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setCodeExpired(false);

    if (code.length !== 6) {
      setError("Please enter the 6-digit code from your email.");
      return;
    }

    setVerifying(true);
    try {
      const res = await fetch(`${apiBase()}/auth/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });

      const json = (await res.json()) as ApiResponse<{ message?: string }>;

      if ((res.status === 200 || res.status === 201) && json.success) {
        navigate("/login", {
          replace: true,
          state: { message: "Email verified! You can now log in." },
        });
        return;
      }

      if (res.status === 400) {
        const msg = json.error ?? "";
        if (msg.toLowerCase().includes("expired")) {
          setCodeExpired(true);
          setError("Code expired");
          return;
        }
        if (msg.toLowerCase().includes("invalid")) {
          setError("Invalid code, please try again");
          return;
        }
        if (msg.toLowerCase().includes("already verified")) {
          navigate("/login", {
            replace: true,
            state: { message: "Email verified! You can now log in." },
          });
          return;
        }
      }

      setError(json.error ?? "Something went wrong. Please try again.");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setVerifying(false);
    }
  }

  async function onResend() {
    if (resendCooldown > 0 || resending) return;

    setError(null);
    setInfo(null);
    setResending(true);
    try {
      const res = await fetch(`${apiBase()}/auth/resend-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const json = (await res.json()) as ApiResponse<{ message?: string }>;

      if (res.status === 200 && json.success) {
        setInfo(`New code sent to ${email}`);
        setCodeExpired(false);
        setResendCooldown(RESEND_COOLDOWN_SEC);
        return;
      }

      if (res.status === 429) {
        setError("Too many attempts, please wait a few minutes");
        return;
      }

      setError(json.error ?? "Something went wrong. Please try again.");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center px-4 sm:px-6">
          <Link to="/" className="text-lg font-semibold tracking-tight text-brand-800">
            TutorLink
          </Link>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-12 sm:px-6">
        <div className="w-full max-w-md">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-card">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Verify your email
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              We sent a 6-digit code to{" "}
              <span className="font-medium text-slate-900">{email}</span>. Enter it below.
            </p>

            <form onSubmit={onVerify} className="mt-8 space-y-5">
              <div>
                <label htmlFor="code" className="block text-sm font-medium text-slate-700">
                  Verification code
                </label>
                <input
                  id="code"
                  name="code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  required
                  value={code}
                  onChange={(e) => onCodeChange(e.target.value)}
                  placeholder="000000"
                  className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-center text-lg tracking-[0.35em] text-slate-900 shadow-sm outline-none ring-brand-500 transition placeholder:tracking-normal placeholder:text-slate-400 focus:border-brand-500 focus:ring-2"
                />
              </div>

              {error ? (
                <p className="text-sm font-medium text-red-700" role="alert">
                  {error}
                </p>
              ) : null}

              {info ? (
                <p className="text-sm font-medium text-emerald-700" role="status">
                  {info}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={verifying}
                className="flex w-full items-center justify-center rounded-full bg-brand-700 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {verifying ? "Verifying…" : "Verify Email"}
              </button>
            </form>

            <div
              className={`mt-6 text-center ${codeExpired ? "rounded-xl border border-amber-200 bg-amber-50 px-4 py-4" : ""}`}
            >
              {codeExpired ? (
                <p className="mb-3 text-sm font-medium text-amber-900">
                  Your code has expired. Request a new one below.
                </p>
              ) : null}
              <button
                type="button"
                onClick={() => void onResend()}
                disabled={resending || resendCooldown > 0}
                className={`text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                  codeExpired
                    ? "inline-flex w-full items-center justify-center rounded-full bg-brand-700 px-4 py-2.5 text-white hover:bg-brand-800"
                    : "text-brand-700 hover:text-brand-800"
                }`}
              >
                {resending
                  ? "Sending…"
                  : resendCooldown > 0
                    ? `Resend code (${resendCooldown}s)`
                    : "Resend code"}
              </button>
            </div>

            <p className="mt-6 text-center text-sm text-slate-600">
              Wrong email?{" "}
              <Link to="/signup" className="font-semibold text-brand-700 hover:text-brand-800">
                Sign up again
              </Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
