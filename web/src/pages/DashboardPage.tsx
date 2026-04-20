import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export function DashboardPage() {
  const { userEmail, logout } = useAuth();

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <span className="text-lg font-semibold tracking-tight text-brand-800">
            TutorLink
          </span>
          <button
            type="button"
            onClick={() => logout()}
            className="text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            Log out
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-card">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Welcome to TutorLink
          </h1>
          <p className="mt-3 text-slate-600">
            Signed in as{" "}
            <span className="font-medium text-slate-900">
              {userEmail ?? "—"}
            </span>
          </p>
          <p className="mt-6 text-sm text-slate-500">
            This dashboard is a placeholder. Booking, discovery, and schedules will
            show up here as you build the product.
          </p>
          <p className="mt-4 text-sm">
            <Link to="/login" className="font-medium text-brand-700 hover:text-brand-800">
              Back to login
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
