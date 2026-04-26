import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { decodeJwtPayload } from "../auth/jwt";
import type { PricingEntry, Qualification, TeacherProfile } from "../types/teacher";

type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

type UserProfile = {
  userId: string;
  email?: string;
  role?: string;
  roles?: string[];
};

const MAX_BIO_LENGTH = 500;
const VERIFICATION_TYPES = ["application/pdf", "image/jpeg", "image/png"];

function apiBase(): string {
  const base = import.meta.env.VITE_API_BASE_URL;
  if (!base) throw new Error("VITE_API_BASE_URL is not set");
  return base.replace(/\/$/, "");
}

function getUserIdFromToken(idToken: string): string | null {
  const payload = decodeJwtPayload(idToken);
  return typeof payload?.sub === "string" ? payload.sub : null;
}

function hasTeacherRole(user: UserProfile): boolean {
  const roles = user.roles ?? (user.role ? [user.role] : []);
  return roles.some((r) => r.toLowerCase() === "teacher");
}

export function TeacherSetupPage() {
  const navigate = useNavigate();
  const { getIdToken, logout } = useAuth();

  const [checking, setChecking] = useState(true);
  const [canSetup, setCanSetup] = useState(false);
  const [teacherId, setTeacherId] = useState<string | null>(null);

  const [location, setLocation] = useState("");
  const [bio, setBio] = useState("");
  const [pricing, setPricing] = useState<PricingEntry[]>([
    { subject: "", level: "", hourlyRate: 0, trialRate: 0 },
  ]);
  const [qualifications, setQualifications] = useState<Qualification[]>([
    { degree: "", institution: "", year: new Date().getFullYear() },
  ]);

  const [verificationDocUrl, setVerificationDocUrl] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "uploaded">("idle");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bioCount = useMemo(() => bio.length, [bio]);

  async function authedFetch(input: string, init?: RequestInit): Promise<Response> {
    const idToken = await getIdToken();
    if (!idToken) throw new Error("Session expired. Please log in again.");

    const headers = new Headers(init?.headers ?? {});
    headers.set("Authorization", `Bearer ${idToken}`);

    return fetch(input, { ...init, headers });
  }

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      setChecking(true);
      setError(null);

      try {
        const idToken = await getIdToken();
        if (!idToken) throw new Error("Session expired. Please log in again.");

        const userId = getUserIdFromToken(idToken);
        if (!userId) throw new Error("Unable to read user id from idToken.");

        const userRes = await authedFetch(`${apiBase()}/users/${encodeURIComponent(userId)}`);
        const userJson = (await userRes.json()) as ApiResponse<UserProfile>;
        if (!userRes.ok || !userJson.success || !userJson.data) {
          throw new Error(userJson.error ?? "Failed to load user profile");
        }

        if (!hasTeacherRole(userJson.data)) {
          navigate("/profile", { replace: true });
          return;
        }

        const teacherRes = await authedFetch(`${apiBase()}/teachers/${encodeURIComponent(userId)}`);
        if (teacherRes.status === 200) {
          navigate("/profile", { replace: true });
          return;
        }
        if (teacherRes.status !== 404) {
          const t = (await teacherRes.json()) as ApiResponse<TeacherProfile>;
          throw new Error(t.error ?? "Failed to check teacher profile");
        }

        if (cancelled) return;
        setTeacherId(userId);
        setCanSetup(true);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load setup form");
        }
      } finally {
        if (!cancelled) {
          setChecking(false);
        }
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [getIdToken, navigate]);

  function updatePricing(index: number, patch: Partial<PricingEntry>) {
    setPricing((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function updateQualification(index: number, patch: Partial<Qualification>) {
    setQualifications((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  async function onVerificationFileSelect(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !teacherId) return;

    setError(null);
    if (!VERIFICATION_TYPES.includes(file.type)) {
      setError("Please upload PDF, JPEG, or PNG documents only.");
      return;
    }

    setUploadStatus("uploading");

    try {
      const preRes = await authedFetch(
        `${apiBase()}/teachers/${encodeURIComponent(teacherId)}/verification-url`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileType: file.type }),
        }
      );

      const preJson = (await preRes.json()) as ApiResponse<{
        uploadUrl: string;
        docUrl: string;
        expiresIn: number;
      }>;

      if (!preRes.ok || !preJson.success || !preJson.data) {
        throw new Error(preJson.error ?? "Failed to get upload URL");
      }

      const putRes = await fetch(preJson.data.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!putRes.ok) {
        throw new Error("Failed to upload verification document");
      }

      setVerificationDocUrl(preJson.data.docUrl);
      setUploadStatus("uploaded");
    } catch (err) {
      setUploadStatus("idle");
      setError(err instanceof Error ? err.message : "Verification upload failed");
    } finally {
      e.target.value = "";
    }
  }

  function validateForm(): string | null {
    if (!teacherId) return "Missing teacher ID";
    if (!location.trim()) return "Location is required";
    if (pricing.length === 0) return "Add at least one subject pricing entry";

    for (const p of pricing) {
      if (!p.subject.trim() || !p.level.trim()) {
        return "Each pricing entry needs subject and level";
      }
      if (!Number.isFinite(p.hourlyRate) || !Number.isFinite(p.trialRate)) {
        return "Hourly and trial rates must be numbers";
      }
      if (p.hourlyRate < 0 || p.trialRate < 0) {
        return "Rates cannot be negative";
      }
    }

    for (const q of qualifications) {
      if (!q.degree.trim() || !q.institution.trim() || !Number.isFinite(q.year)) {
        return "Each qualification needs degree, institution, and year";
      }
    }

    return null;
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!teacherId) return;

    setSubmitting(true);
    try {
      const payload = {
        teacherId,
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
        ...(verificationDocUrl ? { verificationDocUrl } : {}),
      };

      const res = await authedFetch(`${apiBase()}/teachers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = (await res.json()) as ApiResponse<TeacherProfile>;
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Failed to create teacher profile");
      }

      navigate("/profile", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create teacher profile");
    } finally {
      setSubmitting(false);
    }
  }

  if (checking) {
    return (
      <div className="flex min-h-full items-center justify-center text-sm text-slate-600">
        <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-brand-700" />
        Loading setup...
      </div>
    );
  }

  if (!canSetup) {
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
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Teacher Profile Setup</h1>
          <p className="mt-1 text-sm text-slate-600">
            Complete your profile so students can discover and book your lessons.
          </p>

          <form className="mt-8 space-y-8" onSubmit={onSubmit}>
            <section className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-900">About You</h2>
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
                  className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm shadow-sm outline-none ring-brand-500 focus:border-brand-500 focus:ring-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700" htmlFor="bio">
                  Bio
                </label>
                <textarea
                  id="bio"
                  maxLength={MAX_BIO_LENGTH}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="mt-1.5 min-h-28 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm shadow-sm outline-none ring-brand-500 focus:border-brand-500 focus:ring-2"
                />
                <p className="mt-1 text-xs text-slate-500">{bioCount}/{MAX_BIO_LENGTH}</p>
              </div>
            </section>

            <section className="space-y-4 border-t border-slate-200 pt-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">Subjects & Pricing</h2>
                <button
                  type="button"
                  onClick={() =>
                    setPricing((prev) => [
                      ...prev,
                      { subject: "", level: "", hourlyRate: 0, trialRate: 0 },
                    ])
                  }
                  className="rounded-full border border-slate-300 px-4 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Add subject
                </button>
              </div>

              <div className="space-y-4">
                {pricing.map((entry, index) => (
                  <div key={index} className="rounded-xl border border-slate-200 p-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <input
                        type="text"
                        placeholder="Subject"
                        value={entry.subject}
                        onChange={(e) => updatePricing(index, { subject: e.target.value })}
                        className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none ring-brand-500 focus:border-brand-500 focus:ring-2"
                      />
                      <input
                        type="text"
                        placeholder="Level"
                        value={entry.level}
                        onChange={(e) => updatePricing(index, { level: e.target.value })}
                        className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none ring-brand-500 focus:border-brand-500 focus:ring-2"
                      />
                      <input
                        type="number"
                        min={0}
                        placeholder="Hourly rate (SGD)"
                        value={entry.hourlyRate}
                        onChange={(e) => updatePricing(index, { hourlyRate: Number(e.target.value) })}
                        className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none ring-brand-500 focus:border-brand-500 focus:ring-2"
                      />
                      <input
                        type="number"
                        min={0}
                        placeholder="Trial rate (SGD)"
                        value={entry.trialRate}
                        onChange={(e) => updatePricing(index, { trialRate: Number(e.target.value) })}
                        className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none ring-brand-500 focus:border-brand-500 focus:ring-2"
                      />
                    </div>
                    {pricing.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => setPricing((prev) => prev.filter((_, i) => i !== index))}
                        className="mt-3 text-sm font-medium text-red-600 hover:text-red-700"
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-4 border-t border-slate-200 pt-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">Qualifications</h2>
                <button
                  type="button"
                  onClick={() =>
                    setQualifications((prev) => [
                      ...prev,
                      { degree: "", institution: "", year: new Date().getFullYear() },
                    ])
                  }
                  className="rounded-full border border-slate-300 px-4 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Add qualification
                </button>
              </div>

              <div className="space-y-4">
                {qualifications.map((q, index) => (
                  <div key={index} className="rounded-xl border border-slate-200 p-4">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <input
                        type="text"
                        placeholder="Degree"
                        value={q.degree}
                        onChange={(e) => updateQualification(index, { degree: e.target.value })}
                        className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none ring-brand-500 focus:border-brand-500 focus:ring-2"
                      />
                      <input
                        type="text"
                        placeholder="Institution"
                        value={q.institution}
                        onChange={(e) => updateQualification(index, { institution: e.target.value })}
                        className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none ring-brand-500 focus:border-brand-500 focus:ring-2"
                      />
                      <input
                        type="number"
                        placeholder="Year"
                        value={q.year}
                        onChange={(e) => updateQualification(index, { year: Number(e.target.value) })}
                        className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none ring-brand-500 focus:border-brand-500 focus:ring-2"
                      />
                    </div>
                    {qualifications.length > 1 ? (
                      <button
                        type="button"
                        onClick={() =>
                          setQualifications((prev) => prev.filter((_, i) => i !== index))
                        }
                        className="mt-3 text-sm font-medium text-red-600 hover:text-red-700"
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-4 border-t border-slate-200 pt-6">
              <h2 className="text-lg font-semibold text-slate-900">Verification Document</h2>
              <label className="block">
                <input
                  type="file"
                  accept="application/pdf,image/jpeg,image/png"
                  className="hidden"
                  onChange={onVerificationFileSelect}
                  disabled={uploadStatus === "uploading"}
                />
                <span className="inline-flex cursor-pointer items-center justify-center rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                  Upload document
                </span>
              </label>

              <p className="text-sm text-slate-600">
                {uploadStatus === "uploading"
                  ? "Uploading..."
                  : uploadStatus === "uploaded"
                    ? "Document uploaded ✓"
                    : "No document uploaded yet"}
              </p>
            </section>

            {error ? <p className="text-sm font-medium text-red-700">{error}</p> : null}

            <div className="border-t border-slate-200 pt-6">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center justify-center rounded-full bg-brand-700 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Creating..." : "Create Teacher Profile"}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
