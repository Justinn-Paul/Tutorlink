import { type FormEvent, useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { decodeJwtPayload } from "../auth/jwt";
import {
  TeacherPricingFields,
  validateTeacherProfileForm,
} from "../components/TeacherPricingFields";
import { apiBase, type ApiResponse } from "../lib/api";
import { authedFetch } from "../lib/authFetch";
import type { PricingEntry, Qualification, TeacherProfile } from "../types/teacher";

const MAX_BIO_LENGTH = 500;

type UserProfile = {
  userId: string;
  roles?: string[];
  role?: string;
};

function getUserIdFromToken(idToken: string): string | null {
  const payload = decodeJwtPayload(idToken);
  return typeof payload?.sub === "string" ? payload.sub : null;
}

function hasTeacherRole(user: UserProfile): boolean {
  const roles = user.roles ?? (user.role ? [user.role] : []);
  return roles.some((r) => r.toLowerCase() === "teacher");
}

export function TeacherEditPage() {
  const navigate = useNavigate();
  const { getIdToken, logout } = useAuth();

  const [checking, setChecking] = useState(true);
  const [teacherId, setTeacherId] = useState<string | null>(null);

  const [location, setLocation] = useState("");
  const [bio, setBio] = useState("");
  const [pricing, setPricing] = useState<PricingEntry[]>([
    { subject: "", level: "", hourlyRate: 0, trialRate: 0 },
  ]);
  const [qualifications, setQualifications] = useState<Qualification[]>([
    { degree: "", institution: "", year: new Date().getFullYear() },
  ]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      setChecking(true);
      setError(null);

      try {
        const idToken = await getIdToken();
        if (!idToken) throw new Error("Session expired. Please log in again.");

        const userId = getUserIdFromToken(idToken);
        if (!userId) throw new Error("Unable to read user id from token.");

        const userRes = await authedFetch(
          getIdToken,
          `${apiBase()}/users/${encodeURIComponent(userId)}`
        );
        const userJson = (await userRes.json()) as ApiResponse<UserProfile>;
        if (!userRes.ok || !userJson.success || !userJson.data) {
          throw new Error(userJson.error ?? "Failed to load user profile");
        }

        if (!hasTeacherRole(userJson.data)) {
          if (!cancelled) navigate("/profile", { replace: true });
          return;
        }

        const teacherRes = await authedFetch(
          getIdToken,
          `${apiBase()}/teachers/${encodeURIComponent(userId)}`
        );
        const teacherJson = (await teacherRes.json()) as ApiResponse<TeacherProfile>;

        if (teacherRes.status === 404) {
          if (!cancelled) navigate("/teacher-setup", { replace: true });
          return;
        }

        if (!teacherRes.ok || !teacherJson.success || !teacherJson.data) {
          throw new Error(teacherJson.error ?? "Failed to load teacher profile");
        }

        const t = teacherJson.data;
        if (cancelled) return;

        setTeacherId(userId);
        setLocation(t.location ?? "");
        setBio(t.bio ?? "");
        setPricing(
          t.pricing?.length
            ? t.pricing
            : [{ subject: "", level: "", hourlyRate: 0, trialRate: 0 }]
        );
        setQualifications(
          t.qualifications?.length
            ? t.qualifications
            : [{ degree: "", institution: "", year: new Date().getFullYear() }]
        );
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load teacher profile");
        }
      } finally {
        if (!cancelled) setChecking(false);
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [getIdToken, navigate]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const validationError = validateTeacherProfileForm(location, pricing, qualifications);
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!teacherId) return;

    setSubmitting(true);
    try {
      const payload = {
        location: location.trim(),
        bio: bio.trim(),
        pricing: pricing.map((p) => ({
          subject: p.subject.trim(),
          level: p.level.trim(),
          hourlyRate: Number(p.hourlyRate),
          trialRate: Number(p.trialRate),
        })),
        qualifications: qualifications.map((q) => ({
          degree: q.degree.trim(),
          institution: q.institution.trim(),
          year: Number(q.year),
        })),
      };

      const res = await authedFetch(
        getIdToken,
        `${apiBase()}/teachers/${encodeURIComponent(teacherId)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const json = (await res.json()) as ApiResponse<{ message: string; teacherId: string }>;
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Failed to update teacher profile");
      }

      setSuccess("Teacher profile updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update teacher profile");
    } finally {
      setSubmitting(false);
    }
  }

  if (checking) {
    return (
      <div className="flex min-h-full items-center justify-center text-sm text-slate-600">
        <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-brand-700" />
        Loading profile...
      </div>
    );
  }

  if (!teacherId) {
    return <Navigate to="/profile" replace />;
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link to="/dashboard" className="text-lg font-semibold tracking-tight text-brand-800">
            TutorLink
          </Link>
          <button
            type="button"
            onClick={() => logout()}
            className="text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            Log out
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card sm:p-8">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Edit teacher profile</h1>
          <p className="mt-1 text-sm text-slate-600">
            Update your teaching details visible to students.
          </p>

          <form className="mt-8 space-y-8" onSubmit={onSubmit}>
            <TeacherPricingFields
              location={location}
              bio={bio}
              bioMaxLength={MAX_BIO_LENGTH}
              pricing={pricing}
              qualifications={qualifications}
              onLocationChange={setLocation}
              onBioChange={setBio}
              onPricingChange={setPricing}
              onQualificationsChange={setQualifications}
            />

            {error ? <p className="text-sm font-medium text-red-700">{error}</p> : null}
            {success ? <p className="text-sm font-medium text-emerald-700">{success}</p> : null}

            <div className="flex flex-wrap gap-3 border-t border-slate-200 pt-6">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center justify-center rounded-full bg-brand-700 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Saving..." : "Save changes"}
              </button>
              <Link
                to={`/teachers/${encodeURIComponent(teacherId)}`}
                className="inline-flex items-center justify-center rounded-full border border-slate-300 px-6 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                View public profile
              </Link>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
