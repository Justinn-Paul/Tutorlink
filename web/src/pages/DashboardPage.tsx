import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { AppNav } from "../components/AppNav";

export function DashboardPage() {
  const { userEmail } = useAuth();

  return (
    <div className="flex min-h-full flex-col">
      <AppNav maxWidth="max-w-6xl" />

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
            Find tutors, manage your profile, or set up your teacher listing.
          </p>
          <p className="mt-4 flex flex-wrap gap-4 text-sm">
            <Link to="/discovery" className="font-medium text-brand-700 hover:text-brand-800">
              Find tutors
            </Link>
            <Link to="/deck" className="font-medium text-brand-700 hover:text-brand-800">
              My deck
            </Link>
            <Link to="/profile" className="font-medium text-brand-700 hover:text-brand-800">
              My profile
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
