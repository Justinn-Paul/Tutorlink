import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { decodeJwtPayload } from "../auth/jwt";

type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

type ProfileData = {
  userId: string;
  email?: string;
  role?: string;
  roles?: string[];
  name?: string;
  phone?: string;
  location?: string;
  photoUrl?: string;
};

const ACCEPTED_FILE_TYPES = ["image/jpeg", "image/png", "image/webp"];

function apiBase(): string {
  const base = import.meta.env.VITE_API_BASE_URL;
  if (!base) throw new Error("VITE_API_BASE_URL is not set");
  return base.replace(/\/$/, "");
}

function getUserIdFromIdToken(idToken: string): string | null {
  const payload = decodeJwtPayload(idToken);
  const sub = payload?.sub;
  return typeof sub === "string" ? sub : null;
}

function roleLabel(role: string): string {
  if (role.toLowerCase() === "teacher") return "Teacher";
  return "Student";
}

export function ProfilePage() {
  const { getIdToken, logout, userEmail } = useAuth();

  const [fetching, setFetching] = useState(true);
  const [saving, setSaving] = useState(false);
  const [switchingRole, setSwitchingRole] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [roleMessage, setRoleMessage] = useState<string | null>(null);

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");

  const roles = useMemo(() => {
    const raw = profile?.roles ?? (profile?.role ? [profile.role] : []);
    return [...new Set(raw.map((r) => r.toLowerCase()))];
  }, [profile]);

  const hasTeacherRole = roles.includes("teacher");

  async function authedFetch(input: string, init?: RequestInit): Promise<Response> {
    const idToken = await getIdToken();
    if (!idToken) {
      throw new Error("Session expired. Please log in again.");
    }

    const headers = new Headers(init?.headers ?? {});
    headers.set("Authorization", `Bearer ${idToken}`);

    return fetch(input, {
      ...init,
      headers,
    });
  }

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      setFetching(true);
      setError(null);
      setSaveMessage(null);
      setRoleMessage(null);

      try {
        const idToken = await getIdToken();
        if (!idToken) throw new Error("Session expired. Please log in again.");

        const userId = getUserIdFromIdToken(idToken);
        if (!userId) throw new Error("Unable to determine user id from token.");

        const res = await authedFetch(`${apiBase()}/users/${encodeURIComponent(userId)}`);
        const json = (await res.json()) as ApiResponse<ProfileData>;

        if (!res.ok || !json.success || !json.data) {
          throw new Error(json.error ?? "Failed to load profile");
        }

        if (cancelled) return;

        setProfile(json.data);
        setName(json.data.name ?? "");
        setPhone(json.data.phone ?? "");
        setLocation(json.data.location ?? "");
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : "Failed to load profile";
          setError(message);
        }
      } finally {
        if (!cancelled) {
          setFetching(false);
        }
      }
    }

    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, [getIdToken]);

  async function saveProfile(payload: Record<string, unknown>) {
    if (!profile?.userId) return;

    setSaving(true);
    setError(null);
    setSaveMessage(null);

    try {
      const res = await authedFetch(
        `${apiBase()}/users/${encodeURIComponent(profile.userId)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const json = (await res.json()) as ApiResponse<{ message: string; userId: string }>;
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Failed to save profile");
      }

      setProfile((prev) =>
        prev
          ? {
              ...prev,
              ...payload,
            }
          : prev
      );
      setSaveMessage("Profile saved");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save profile";
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  async function onSubmitProfile(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await saveProfile({ name, phone, location });
  }

  async function onSelectPhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !profile?.userId) return;

    setError(null);
    setSaveMessage(null);

    if (!ACCEPTED_FILE_TYPES.includes(file.type)) {
      setError("Please select a JPEG, PNG, or WEBP image.");
      return;
    }

    setUploadingPhoto(true);

    try {
      const urlRes = await authedFetch(
        `${apiBase()}/users/${encodeURIComponent(profile.userId)}/photo-upload-url`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileType: file.type }),
        }
      );

      const urlJson = (await urlRes.json()) as ApiResponse<{
        uploadUrl: string;
        photoUrl: string;
        expiresIn: number;
      }>;

      if (!urlRes.ok || !urlJson.success || !urlJson.data) {
        throw new Error(urlJson.error ?? "Failed to prepare photo upload");
      }
      const uploadData = urlJson.data;

      const uploadRes = await fetch(uploadData.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!uploadRes.ok) {
        throw new Error("Photo upload failed");
      }

      await saveProfile({ photoUrl: uploadData.photoUrl });
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              photoUrl: uploadData.photoUrl,
            }
          : prev
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to upload photo";
      setError(message);
    } finally {
      setUploadingPhoto(false);
      e.target.value = "";
    }
  }

  async function onSwitchRole() {
    if (!profile?.userId) return;

    setSwitchingRole(true);
    setError(null);
    setRoleMessage(null);

    try {
      const res = await authedFetch(
        `${apiBase()}/users/${encodeURIComponent(profile.userId)}/switch-role`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: "teacher" }),
        }
      );

      const json = (await res.json()) as ApiResponse<{ message: string; userId?: string }>;
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Failed to switch role");
      }

      setProfile((prev) => {
        if (!prev) return prev;
        const existing = prev.roles ?? (prev.role ? [prev.role] : []);
        const merged = existing.map((r) => r.toLowerCase());
        if (!merged.includes("teacher")) merged.push("teacher");
        return {
          ...prev,
          roles: merged,
        };
      });
      setRoleMessage("You are now registered as a teacher");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to switch role";
      setError(message);
    } finally {
      setSwitchingRole(false);
    }
  }

  const displayEmail = profile?.email ?? userEmail ?? "—";

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
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">My Profile</h1>
          <p className="mt-1 text-sm text-slate-600">Manage your TutorLink profile details.</p>

          {fetching ? (
            <div className="mt-8 flex items-center gap-3 text-sm text-slate-600">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-brand-700" />
              Loading profile...
            </div>
          ) : (
            <div className="mt-8 grid gap-8 lg:grid-cols-[260px_1fr]">
              <aside className="space-y-4">
                <div className="mx-auto h-44 w-44 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                  {profile?.photoUrl ? (
                    <img
                      src={profile.photoUrl}
                      alt="Profile"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-4xl text-slate-400">
                      <span>👤</span>
                    </div>
                  )}
                </div>

                <label className="block">
                  <span className="sr-only">Change photo</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={onSelectPhoto}
                    className="hidden"
                    disabled={uploadingPhoto}
                  />
                  <span className="inline-flex w-full cursor-pointer items-center justify-center rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
                    {uploadingPhoto ? "Uploading..." : "Change photo"}
                  </span>
                </label>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Email</p>
                  <p className="mt-1 text-sm text-slate-900">{displayEmail}</p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Role(s)</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(roles.length ? roles : ["student"]).map((role) => (
                      <span
                        key={role}
                        className="rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-800"
                      >
                        {roleLabel(role)}
                      </span>
                    ))}
                  </div>
                </div>
              </aside>

              <section>
                <form onSubmit={onSubmitProfile} className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-slate-700" htmlFor="name">
                      Name
                    </label>
                    <input
                      id="name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none ring-brand-500 transition focus:border-brand-500 focus:ring-2"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700" htmlFor="phone">
                      Phone
                    </label>
                    <input
                      id="phone"
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none ring-brand-500 transition focus:border-brand-500 focus:ring-2"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700" htmlFor="location">
                      Location
                    </label>
                    <input
                      id="location"
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="Tampines"
                      className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none ring-brand-500 transition focus:border-brand-500 focus:ring-2"
                    />
                  </div>

                  {error ? <p className="text-sm font-medium text-red-700">{error}</p> : null}
                  {saveMessage ? <p className="text-sm font-medium text-emerald-700">{saveMessage}</p> : null}
                  {roleMessage ? <p className="text-sm font-medium text-emerald-700">{roleMessage}</p> : null}

                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center justify-center rounded-full bg-brand-700 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving ? "Saving..." : "Save"}
                  </button>
                </form>

                {!hasTeacherRole ? (
                  <div className="mt-8 border-t border-slate-200 pt-6">
                    <button
                      type="button"
                      onClick={() => void onSwitchRole()}
                      disabled={switchingRole}
                      className="inline-flex items-center justify-center rounded-full border border-brand-700 px-6 py-2.5 text-sm font-semibold text-brand-700 transition hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {switchingRole ? "Updating..." : "Become a Teacher"}
                    </button>
                  </div>
                ) : null}
              </section>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
