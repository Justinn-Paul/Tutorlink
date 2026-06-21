import { type FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { apiBase, type ApiResponse } from "../lib/api";

type Role = "student" | "teacher";

export function SignupPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("student");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${apiBase()}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, role }),
      });

      const json = (await res.json()) as ApiResponse<{ message?: string; email?: string }>;

      if (res.status === 201 && json.success) {
        navigate(`/verify?email=${encodeURIComponent(email)}`, { replace: true });
        return;
      }

      if (res.status === 409) {
        setError("This email is already registered");
        return;
      }

      setError(json.error ?? "Something went wrong. Please try again.");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
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
              Create your account
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Join TutorLink to find trusted tutors across Singapore.
            </p>

            <form onSubmit={onSubmit} className="mt-8 space-y-5">
                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-slate-700"
                  >
                    Email
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none ring-brand-500 transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-2"
                  />
                </div>
                <div>
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium text-slate-700"
                  >
                    Password
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none ring-brand-500 transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-2"
                  />
                  <p className="mt-1 text-xs text-slate-500">At least 8 characters</p>
                </div>

                <div>
                  <p className="text-sm font-medium text-slate-700">I am a</p>
                  <div className="mt-2 grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setRole("student")}
                      className={`rounded-xl border px-4 py-4 text-left shadow-sm transition ${
                        role === "student"
                          ? "border-brand-600 bg-brand-50 ring-2 ring-brand-600"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      <span className="block text-sm font-semibold text-slate-900">
                        Student
                      </span>
                      <span className="mt-1 block text-xs text-slate-600">
                        Find a tutor
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRole("teacher")}
                      className={`rounded-xl border px-4 py-4 text-left shadow-sm transition ${
                        role === "teacher"
                          ? "border-brand-600 bg-brand-50 ring-2 ring-brand-600"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      <span className="block text-sm font-semibold text-slate-900">
                        Teacher
                      </span>
                      <span className="mt-1 block text-xs text-slate-600">
                        Offer lessons
                      </span>
                    </button>
                  </div>
                </div>

                {error ? (
                  <p className="text-sm font-medium text-red-700" role="alert">
                    {error}
                  </p>
                ) : null}

                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center rounded-full bg-brand-700 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Creating account…" : "Create Account"}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-slate-600">
              Already have an account?{" "}
              <Link
                to="/login"
                className="font-semibold text-brand-700 hover:text-brand-800"
              >
                Log in
              </Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
