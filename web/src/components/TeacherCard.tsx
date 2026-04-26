import { useMemo, useState } from "react";
import type { TeacherProfile } from "../types/teacher";

type TeacherCardProps = {
  teacherProfile: TeacherProfile & { name: string; photoUrl?: string };
  onSave?: () => void;
};

export function TeacherCard({ teacherProfile, onSave }: TeacherCardProps) {
  const [expandedBio, setExpandedBio] = useState(false);

  const rating =
    teacherProfile.ratingAvg ?? teacherProfile.rating_avg ?? 0;
  const reviewCount =
    teacherProfile.reviewCount ?? teacherProfile.review_count ?? 0;

  const cheapestRate = useMemo(() => {
    if (typeof teacherProfile.minRate === "number") return teacherProfile.minRate;
    if (!Array.isArray(teacherProfile.pricing) || teacherProfile.pricing.length === 0) {
      return 0;
    }
    return Math.min(...teacherProfile.pricing.map((p) => p.hourlyRate));
  }, [teacherProfile.minRate, teacherProfile.pricing]);

  const hasLongBio = teacherProfile.bio.length > 180;

  return (
    <article className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-5 shadow-card sm:p-6">
      <div className="flex items-start gap-4">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full border border-slate-200 bg-slate-100">
          {teacherProfile.photoUrl ? (
            <img
              src={teacherProfile.photoUrl}
              alt={teacherProfile.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-2xl text-slate-400">
              <span>👤</span>
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="truncate text-lg font-semibold text-slate-900">{teacherProfile.name}</h3>
              <p className="mt-0.5 text-sm text-slate-600">{teacherProfile.location}</p>
            </div>
            {teacherProfile.verificationStatus === "verified" ? (
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                ✓ Verified
              </span>
            ) : null}
          </div>

          <p className="mt-2 text-sm font-medium text-slate-700">
            From <span className="text-slate-900">${cheapestRate}/hr</span>
          </p>
          <p className="mt-1 text-sm text-slate-600">
            ★ {rating.toFixed(1)} ({reviewCount} review{reviewCount === 1 ? "" : "s"})
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {teacherProfile.subjects.map((subject) => (
          <span
            key={subject}
            className="rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700"
          >
            {subject}
          </span>
        ))}
      </div>

      <div className="mt-4">
        <p
          className={`text-sm leading-6 text-slate-700 ${expandedBio ? "" : "line-clamp-3"}`}
        >
          {teacherProfile.bio}
        </p>
        {hasLongBio ? (
          <button
            type="button"
            onClick={() => setExpandedBio((v) => !v)}
            className="mt-1 text-sm font-medium text-brand-700 hover:text-brand-800"
          >
            {expandedBio ? "Show less" : "Read more"}
          </button>
        ) : null}
      </div>

      <button
        type="button"
        onClick={onSave}
        className="mt-5 inline-flex w-full items-center justify-center rounded-full bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-800"
      >
        Save to Deck
      </button>
    </article>
  );
}
