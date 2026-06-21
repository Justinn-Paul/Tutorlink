import {
  type FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useAuth } from "../auth/AuthContext";
import { decodeJwtPayload } from "../auth/jwt";
import { AppNav } from "../components/AppNav";
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

type Filters = {
  subject: string;
  location: string;
  maxRate: number;
};

type Toast = {
  message: string;
  type: "success" | "error";
};

const CARD_ANIM_MS = 320;
const DEFAULT_MAX_RATE = 200;

function getStudentIdFromToken(idToken: string): string | null {
  const payload = decodeJwtPayload(idToken);
  const sub = payload?.sub;
  return typeof sub === "string" ? sub : null;
}

export function DiscoveryPage() {
  const { getIdToken } = useAuth();

  const [filterInputs, setFilterInputs] = useState<Filters>({
    subject: "",
    location: "",
    maxRate: DEFAULT_MAX_RATE,
  });
  const [filters, setFilters] = useState<Filters | null>(null);

  const [teachers, setTeachers] = useState<DiscoveryTeacher[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [nextToken, setNextToken] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [filterError, setFilterError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  const [exitAnimation, setExitAnimation] = useState<"left" | "right" | null>(
    null
  );
  const [isAnimating, setIsAnimating] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const studentIdRef = useRef<string | null>(null);

  const showToast = useCallback((message: string, type: Toast["type"]) => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 2800);
  }, []);

  const fetchDiscovery = useCallback(
    async (opts: {
      activeFilters: Filters;
      append: boolean;
      token?: string | null;
    }) => {
      const { activeFilters, append, token } = opts;
      const trimmedSubject = activeFilters.subject.trim();
      const trimmedLocation = activeFilters.location.trim();

      if (!trimmedSubject && !trimmedLocation) {
        setFilterError("Enter a subject or location to find teachers.");
        return;
      }

      if (append) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
        setApiError(null);
        setFilterError(null);
      }

      try {
        const idToken = await getIdToken();
        if (!idToken) throw new Error("Session expired. Please log in again.");

        const studentId = getStudentIdFromToken(idToken);
        studentIdRef.current = studentId;

        const params = new URLSearchParams();
        if (trimmedSubject) params.set("subject", trimmedSubject);
        if (trimmedLocation) params.set("location", trimmedLocation);
        if (activeFilters.maxRate < DEFAULT_MAX_RATE) {
          params.set("maxRate", String(activeFilters.maxRate));
        }
        if (studentId) params.set("studentId", studentId);
        params.set("limit", "20");
        if (token) params.set("nextToken", token);

        const res = await authedFetch(
          getIdToken,
          `${apiBase()}/discovery?${params.toString()}`
        );
        const json = (await res.json()) as ApiResponse<DiscoveryData>;

        if (!res.ok || !json.success || !json.data) {
          throw new Error(json.error ?? "Failed to load tutors");
        }

        setTeachers((prev) =>
          append ? [...prev, ...json.data!.teachers] : json.data!.teachers
        );
        setNextToken(json.data.nextToken);
        if (!append) {
          setCurrentIndex(0);
        }
        setHasSearched(true);
      } catch {
        if (append) {
          showToast("Something went wrong. Please try again.", "error");
        } else {
          setApiError("Something went wrong. Please try again.");
          setTeachers([]);
          setCurrentIndex(0);
          setNextToken(null);
          setHasSearched(true);
        }
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [getIdToken, showToast]
  );

  const loadMore = useCallback(() => {
    if (!filters || !nextToken || isLoadingMore || isLoading) return;
    void fetchDiscovery({
      activeFilters: filters,
      append: true,
      token: nextToken,
    });
  }, [filters, nextToken, isLoadingMore, isLoading, fetchDiscovery]);

  useEffect(() => {
    if (!hasSearched || isLoading || isLoadingMore) return;
    if (teachers.length === 0) return;
    if (currentIndex < teachers.length - 1) return;
    if (!nextToken) return;
    loadMore();
  }, [
    currentIndex,
    teachers.length,
    nextToken,
    hasSearched,
    isLoading,
    isLoadingMore,
    loadMore,
  ]);

  function onSearch(e: FormEvent) {
    e.preventDefault();
    const trimmedSubject = filterInputs.subject.trim();
    const trimmedLocation = filterInputs.location.trim();

    if (!trimmedSubject && !trimmedLocation) {
      setFilterError("Enter a subject or location to find teachers.");
      return;
    }

    const activeFilters: Filters = {
      subject: filterInputs.subject,
      location: filterInputs.location,
      maxRate: filterInputs.maxRate,
    };

    setFilters(activeFilters);
    setTeachers([]);
    setCurrentIndex(0);
    setNextToken(null);
    setHasSearched(false);
    void fetchDiscovery({ activeFilters, append: false });
  }

  function advanceAfterAnimation() {
    window.setTimeout(() => {
      setCurrentIndex((i) => i + 1);
      setExitAnimation(null);
      setIsAnimating(false);
    }, CARD_ANIM_MS);
  }

  function onSkip() {
    if (isAnimating || isSaving || isLoading) return;
    if (currentIndex >= teachers.length) return;

    setIsAnimating(true);
    setExitAnimation("left");
    advanceAfterAnimation();
  }

  async function onSave() {
    if (isAnimating || isSaving || isLoading) return;

    const teacher = teachers[currentIndex];
    const studentId = studentIdRef.current;
    if (!teacher || !studentId) {
      showToast("Something went wrong. Please try again.", "error");
      return;
    }

    setIsSaving(true);
    try {
      const res = await authedFetch(getIdToken, `${apiBase()}/decks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          teacherId: teacher.teacherId,
          status: "interested",
        }),
      });

      const json = (await res.json()) as ApiResponse<unknown>;
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Failed to save");
      }

      showToast("Saved to your deck ✓", "success");
      setIsAnimating(true);
      setExitAnimation("right");
      advanceAfterAnimation();
    } catch {
      showToast("Something went wrong. Please try again.", "error");
    } finally {
      setIsSaving(false);
    }
  }

  const currentTeacher = teachers[currentIndex];
  const nextTeacher = teachers[currentIndex + 1];
  const atEnd = hasSearched && !isLoading && currentIndex >= teachers.length;
  const noResults =
    hasSearched && !isLoading && teachers.length === 0 && !apiError;

  let feedMessage: string | null = null;
  if (!hasSearched && !isLoading) {
    feedMessage = "Enter a subject or location to find teachers";
  } else if (noResults) {
    feedMessage = "No teachers found for these filters. Try adjusting your search.";
  } else if (atEnd && nextToken && isLoadingMore) {
    feedMessage = null;
  } else if (atEnd && !nextToken && teachers.length > 0) {
    feedMessage = "You've seen all available teachers in this search.";
  } else if (atEnd && !nextToken && teachers.length === 0) {
    feedMessage = "No more teachers found";
  } else if (atEnd && isLoadingMore) {
    feedMessage = null;
  }

  const cardTransform =
    exitAnimation === "left"
      ? "-translate-x-[120%] rotate-[-12deg] opacity-0"
      : exitAnimation === "right"
        ? "translate-x-[120%] rotate-[12deg] opacity-0"
        : "translate-x-0 rotate-0 opacity-100";

  return (
    <div className="flex min-h-full flex-col">
      <AppNav maxWidth="max-w-2xl" />

      {toast ? (
        <div
          className={`fixed left-1/2 top-20 z-50 -translate-x-1/2 rounded-full px-5 py-2.5 text-sm font-semibold shadow-lg ${
            toast.type === "success"
              ? "bg-emerald-600 text-white"
              : "bg-red-600 text-white"
          }`}
          role="status"
        >
          {toast.message}
        </div>
      ) : null}

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-6 sm:px-6">
        <form
          onSubmit={onSearch}
          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card sm:p-5"
        >
          <h1 className="text-lg font-bold text-slate-900">Find a tutor</h1>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="subject">
                Subject
              </label>
              <input
                id="subject"
                type="text"
                placeholder="Primary Maths"
                value={filterInputs.subject}
                onChange={(e) =>
                  setFilterInputs((f) => ({ ...f, subject: e.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-brand-500 focus:border-brand-500 focus:ring-2"
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
                value={filterInputs.location}
                onChange={(e) =>
                  setFilterInputs((f) => ({ ...f, location: e.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-brand-500 focus:border-brand-500 focus:ring-2"
              />
            </div>
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between text-sm">
              <label className="font-medium text-slate-700" htmlFor="maxRate">
                Max rate (SGD/hr)
              </label>
              <span className="font-semibold text-brand-700">${filterInputs.maxRate}</span>
            </div>
            <input
              id="maxRate"
              type="range"
              min={20}
              max={200}
              step={5}
              value={filterInputs.maxRate}
              onChange={(e) =>
                setFilterInputs((f) => ({
                  ...f,
                  maxRate: Number(e.target.value),
                }))
              }
              className="mt-2 w-full accent-brand-700"
            />
            <div className="mt-1 flex justify-between text-xs text-slate-500">
              <span>$20</span>
              <span>$200</span>
            </div>
          </div>

          {filterError ? (
            <p className="mt-3 text-sm font-medium text-red-700" role="alert">
              {filterError}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isLoading}
            className="mt-4 w-full rounded-full bg-brand-700 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:px-8"
          >
            {isLoading ? "Searching..." : "Search"}
          </button>
        </form>

        <div className="relative mt-8 flex flex-1 flex-col">
          {isLoading ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16">
              <span className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-brand-700" />
              <p className="text-sm text-slate-600">Finding tutors...</p>
            </div>
          ) : currentTeacher ? (
            <>
              <div className="relative mx-auto h-[min(520px,70vh)] w-full max-w-md">
                {nextTeacher ? (
                  <div
                    className="pointer-events-none absolute inset-x-0 top-2 mx-auto w-[92%] scale-[0.96] opacity-50"
                    aria-hidden
                  >
                    <TeacherCard teacherProfile={nextTeacher} hideActions />
                  </div>
                ) : null}

                <div
                  className={`absolute inset-x-0 top-0 z-10 transition-all duration-300 ease-out ${cardTransform}`}
                >
                  {exitAnimation === "right" ? (
                    <span className="pointer-events-none absolute right-6 top-6 z-20 text-3xl text-rose-500">
                      ♥
                    </span>
                  ) : null}
                  <TeacherCard teacherProfile={currentTeacher} hideActions />
                </div>
              </div>

              <div className="mx-auto mt-6 flex items-center justify-center gap-8">
                <button
                  type="button"
                  onClick={onSkip}
                  disabled={isAnimating || isSaving}
                  aria-label="Skip"
                  className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-slate-300 bg-white text-2xl text-slate-500 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  ✕
                </button>
                <button
                  type="button"
                  onClick={() => void onSave()}
                  disabled={isAnimating || isSaving}
                  aria-label="Save to deck"
                  className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-rose-400 bg-white text-2xl text-rose-500 shadow-sm transition hover:border-rose-500 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  ♥
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center py-16 text-center">
              {apiError ? (
                <p className="text-sm font-medium text-red-700">{apiError}</p>
              ) : feedMessage ? (
                <p className="max-w-sm text-sm text-slate-600">{feedMessage}</p>
              ) : null}
            </div>
          )}

          {isLoadingMore ? (
            <p className="mt-6 text-center text-sm text-slate-500">Loading more...</p>
          ) : null}

          {atEnd && !isLoadingMore && teachers.length > 0 && !nextToken ? (
            <p className="mt-4 text-center text-sm font-medium text-slate-600">
              You&apos;ve seen all available teachers in this search.
            </p>
          ) : null}
        </div>
      </main>
    </div>
  );
}
