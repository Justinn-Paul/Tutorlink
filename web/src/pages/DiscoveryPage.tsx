import { type FormEvent, useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { decodeJwtPayload } from "../auth/jwt";
import { TeacherCard } from "../components/TeacherCard";
import { apiBase, type ApiResponse } from "../lib/api";
import { authedFetch } from "../lib/authFetch";
import type { TeacherProfile } from "../types/teacher";

type DiscoveryTeacher = TeacherProfile & { name?: string; photoUrl?: string };

type DiscoveryData = {
  teachers: DiscoveryTeacher[];
  count: number;
  nextToken: string | null;
};

function getUserIdFromIdToken(idToken: string): string | null {
  const payload = decodeJwtPayload(idToken);
  const sub = payload?.sub;
  return typeof sub === "string" ? sub : null;
}

export function DiscoveryPage() {
  const { getIdToken, logout } = useAuth();

  const [subject, setSubject] = useState("");
  const [location, setLocation] = useState("");
  const [minRate, setMinRate] = useState("");
  const [maxRate, setMaxRate] = useState("");

  const [teachers, setTeachers] = useState<DiscoveryTeacher[]>([]);
  const [nextToken, setNextToken] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deckMessage, setDeckMessage] = useState<string | null>(null);

  const fetchFeed = useCallback(
    async (opts: { append: boolean; token?: string | null }) => {
      const trimmedSubject = subject.trim();
      const trimmedLocation = location.trim();

      if (!trimmedSubject && !trimmedLocation) {
        setError("Enter a subject or location to search.");
        return;
      }

      if (opts.append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setError(null);
        setDeckMessage(null);
      }

      try {
        const idToken = await getIdToken();
        if (!idToken) throw new Error("Session expired. Please log in again.");

        const studentId = getUserIdFromIdToken(idToken);
        const params = new URLSearchParams();

        if (trimmedSubject) params.set("subject", trimmedSubject);
        if (trimmedLocation) params.set("location", trimmedLocation);
        if (minRate.trim()) params.set("minRate", minRate.trim());
        if (maxRate.trim()) params.set("maxRate", maxRate.trim());
        if (studentId) params.set("studentId", studentId);
        params.set("limit", "20");
        if (opts.token) params.set("nextToken", opts.token);

        const res = await authedFetch(
          getIdToken,
          `${apiBase()}/discovery?${params.toString()}`
        );
        const json = (await res.json()) as ApiResponse<DiscoveryData>;

        if (!res.ok || !json.success || !json.data) {
          throw new Error(json.error ?? "Failed to load tutors");
        }

        setTeachers((prev) =>
          opts.append ? [...prev, ...json.data!.teachers] : json.data!.teachers
        );
        setNextToken(json.data.nextToken);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load tutors");
        if (!opts.append) setTeachers([]);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [getIdToken, subject, location, minRate, maxRate]
  );

  function onSearch(e: FormEvent) {
    e.preventDefault();
    void fetchFeed({ append: false });
  }

  function onSaveToDeck(teacherId: string) {
    setSavedIds((prev) => new Set(prev).add(teacherId));
    setDeckMessage("Saved to your deck (UI only — deck API coming soon).");
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/dashboard" className="text-lg font-semibold tracking-tight text-brand-800">
            TutorLink
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/profile" className="text-sm font-medium text-slate-600 hover:text-slate-900">
              Profile
            </Link>
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

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Find a tutor</h1>
          <p className="mt-1 text-sm text-slate-600">
            Browse verified teachers by subject or area in Singapore.
          </p>
        </div>

        <form
          onSubmit={onSearch}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card"
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="subject">
                Subject
              </label>
              <input
                id="subject"
                type="text"
                placeholder="Primary Maths"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none ring-brand-500 focus:border-brand-500 focus:ring-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="location">
                Location
              </label>
              <input
                id="location"
                type="text"
                placeholder="Tampines"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none ring-brand-500 focus:border-brand-500 focus:ring-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="minRate">
                Min rate (SGD/hr)
              </label>
              <input
                id="minRate"
                type="number"
                min={0}
                value={minRate}
                onChange={(e) => setMinRate(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none ring-brand-500 focus:border-brand-500 focus:ring-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="maxRate">
                Max rate (SGD/hr)
              </label>
              <input
                id="maxRate"
                type="number"
                min={0}
                value={maxRate}
                onChange={(e) => setMaxRate(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none ring-brand-500 focus:border-brand-500 focus:ring-2"
              />
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500">Provide at least subject or location.</p>
          <button
            type="submit"
            disabled={loading}
            className="mt-4 inline-flex items-center justify-center rounded-full bg-brand-700 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Searching..." : "Search tutors"}
          </button>
        </form>

        {error ? <p className="mt-6 text-sm font-medium text-red-700">{error}</p> : null}
        {deckMessage ? <p className="mt-4 text-sm font-medium text-emerald-700">{deckMessage}</p> : null}

        {!loading && teachers.length === 0 && !error ? (
          <p className="mt-10 text-center text-sm text-slate-500">
            Run a search to see verified tutors.
          </p>
        ) : null}

        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {teachers.map((teacher) => (
            <TeacherCard
              key={teacher.teacherId}
              teacherProfile={teacher}
              onSave={
                savedIds.has(teacher.teacherId)
                  ? undefined
                  : () => onSaveToDeck(teacher.teacherId)
              }
              saveLabel={savedIds.has(teacher.teacherId) ? "Saved" : "Save to Deck"}
            />
          ))}
        </div>

        {nextToken ? (
          <div className="mt-8 flex justify-center">
            <button
              type="button"
              disabled={loadingMore}
              onClick={() => void fetchFeed({ append: true, token: nextToken })}
              className="rounded-full border border-brand-700 px-6 py-2.5 text-sm font-semibold text-brand-700 transition hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loadingMore ? "Loading..." : "Load more"}
            </button>
          </div>
        ) : null}
      </main>
    </div>
  );
}
