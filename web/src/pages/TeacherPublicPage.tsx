import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiBase, type ApiResponse } from "../lib/api";
import type { TeacherProfile } from "../types/teacher";

type PublicTeacher = TeacherProfile & { name?: string; photoUrl?: string };

export function TeacherPublicPage() {
  const { teacherId } = useParams<{ teacherId: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [teacher, setTeacher] = useState<PublicTeacher | null>(null);

  const rating = useMemo(() => {
    if (!teacher) return 0;
    return teacher.ratingAvg ?? teacher.rating_avg ?? 0;
  }, [teacher]);

  const reviewCount = useMemo(() => {
    if (!teacher) return 0;
    return teacher.reviewCount ?? teacher.review_count ?? 0;
  }, [teacher]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!teacherId) {
        setError("Missing teacher id");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`${apiBase()}/teachers/${encodeURIComponent(teacherId)}`);
        const json = (await res.json()) as ApiResponse<PublicTeacher>;

        if (!res.ok || !json.success || !json.data) {
          throw new Error(json.error ?? "Teacher not found");
        }

        if (!cancelled) setTeacher(json.data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load teacher");
          setTeacher(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [teacherId]);

  const displayName = teacher?.name?.trim() || "Tutor";

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link to="/discovery" className="text-lg font-semibold tracking-tight text-brand-800">
            TutorLink
          </Link>
          <Link
            to="/discovery"
            className="text-sm font-medium text-brand-700 hover:text-brand-800"
          >
            ← Back to search
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
        {loading ? (
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-brand-700" />
            Loading teacher profile...
          </div>
        ) : null}

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        {teacher ? (
          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card sm:p-8">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
              <div className="h-28 w-28 shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                {teacher.photoUrl ? (
                  <img
                    src={teacher.photoUrl}
                    alt={displayName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-4xl text-slate-400">
                    👤
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                      {displayName}
                    </h1>
                    <p className="mt-1 text-slate-600">{teacher.location}</p>
                  </div>
                  {teacher.verificationStatus === "verified" ? (
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                      ✓ Verified
                    </span>
                  ) : null}
                </div>

                <p className="mt-3 text-sm text-slate-700">
                  ★ {rating.toFixed(1)} · {reviewCount} review
                  {reviewCount === 1 ? "" : "s"} · From ${teacher.minRate}/hr
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  {teacher.subjects.map((s) => (
                    <span
                      key={s}
                      className="rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <section className="mt-8 border-t border-slate-200 pt-6">
              <h2 className="text-lg font-semibold text-slate-900">About</h2>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">
                {teacher.bio || "No bio provided yet."}
              </p>
            </section>

            <section className="mt-8 border-t border-slate-200 pt-6">
              <h2 className="text-lg font-semibold text-slate-900">Rates</h2>
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="py-2 pr-4 font-medium">Subject</th>
                      <th className="py-2 pr-4 font-medium">Level</th>
                      <th className="py-2 pr-4 font-medium">Hourly</th>
                      <th className="py-2 font-medium">Trial</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teacher.pricing.map((row) => (
                      <tr key={`${row.subject}-${row.level}`} className="border-b border-slate-100">
                        <td className="py-2 pr-4 text-slate-900">{row.subject}</td>
                        <td className="py-2 pr-4 text-slate-700">{row.level}</td>
                        <td className="py-2 pr-4 text-slate-900">${row.hourlyRate}</td>
                        <td className="py-2 text-slate-900">${row.trialRate}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {teacher.qualifications.length > 0 ? (
              <section className="mt-8 border-t border-slate-200 pt-6">
                <h2 className="text-lg font-semibold text-slate-900">Qualifications</h2>
                <ul className="mt-4 space-y-3">
                  {teacher.qualifications.map((q, i) => (
                    <li key={i} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                      <span className="font-medium text-slate-900">{q.degree}</span>
                      <span className="text-slate-600">
                        {" "}
                        — {q.institution} ({q.year})
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </article>
        ) : null}
      </main>
    </div>
  );
}
