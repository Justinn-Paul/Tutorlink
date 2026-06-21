import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

const NAV_LINKS = [
  { to: "/discovery", label: "Discovery" },
  { to: "/deck", label: "My Deck" },
  { to: "/profile", label: "Profile" },
] as const;

type AppNavProps = {
  maxWidth?: string;
};

export function AppNav({ maxWidth = "max-w-5xl" }: AppNavProps) {
  const { logout } = useAuth();
  const location = useLocation();

  return (
    <header className="border-b border-slate-200 bg-white">
      <div
        className={`mx-auto flex h-16 ${maxWidth} items-center justify-between px-4 sm:px-6`}
      >
        <Link to="/dashboard" className="text-lg font-semibold tracking-tight text-brand-800">
          TutorLink
        </Link>
        <div className="flex items-center gap-4">
          {NAV_LINKS.map(({ to, label }) => {
            const active = location.pathname === to;
            return (
              <Link
                key={to}
                to={to}
                className={`text-sm font-medium ${
                  active
                    ? "text-brand-800"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {label}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => logout()}
            className="text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            Log out
          </button>
        </div>
      </div>
    </header>
  );
}
