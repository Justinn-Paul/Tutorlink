import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { decodeJwtPayload } from "../auth/jwt";
import { AppNav } from "../components/AppNav";
import { DeckCard } from "../components/DeckCard";
import { apiBase, type ApiResponse } from "../lib/api";
import { authedFetch } from "../lib/authFetch";
import type { DeckItem, DeckResponse, DeckStatus } from "../types/deck";

function getStudentIdFromToken(idToken: string): string | null {
  const payload = decodeJwtPayload(idToken);
  const sub = payload?.sub;
  return typeof sub === "string" ? sub : null;
}

function reorderDeckItems(items: DeckItem[], fromIndex: number, toIndex: number): DeckItem[] {
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  if (!moved) return items;
  next.splice(toIndex, 0, moved);
  return next.map((item, index) => ({ ...item, sortOrder: index }));
}

export function DeckPage() {
  const { getIdToken } = useAuth();

  const [studentId, setStudentId] = useState<string | null>(null);
  const [deck, setDeck] = useState<DeckItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2500);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadDeck() {
      setLoading(true);
      setError(null);

      try {
        const idToken = await getIdToken();
        if (!idToken) {
          throw new Error("Session expired. Please log in again.");
        }

        const sid = getStudentIdFromToken(idToken);
        if (!sid) {
          throw new Error("Could not read your account ID from session.");
        }

        if (!cancelled) setStudentId(sid);

        const res = await authedFetch(getIdToken, `${apiBase()}/decks/${encodeURIComponent(sid)}`);
        const json = (await res.json()) as ApiResponse<DeckResponse>;

        if (!res.ok || !json.success || !json.data) {
          throw new Error(json.error ?? "Failed to load deck");
        }

        if (!cancelled) {
          const sorted = [...json.data.deck].sort((a, b) => a.sortOrder - b.sortOrder);
          setDeck(sorted);
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : "Failed to load deck";
          setError(message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadDeck();

    return () => {
      cancelled = true;
    };
  }, [getIdToken]);

  const handleStatusChange = async (teacherId: string, status: DeckStatus) => {
    if (!studentId) return;

    const previous = deck.find((item) => item.teacherId === teacherId);
    if (!previous || previous.status === status) return;

    setDeck((items) =>
      items.map((item) =>
        item.teacherId === teacherId ? { ...item, status } : item
      )
    );

    try {
      const res = await authedFetch(
        getIdToken,
        `${apiBase()}/decks/${encodeURIComponent(studentId)}/${encodeURIComponent(teacherId)}/status`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        }
      );

      const json = (await res.json()) as ApiResponse<{ message: string; status: string }>;
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Failed to update status");
      }
    } catch (err) {
      setDeck((items) =>
        items.map((item) =>
          item.teacherId === teacherId ? { ...item, status: previous.status } : item
        )
      );
      const message = err instanceof Error ? err.message : "Failed to update status";
      setError(message);
    }
  };

  const handleNoteSave = async (teacherId: string, note: string) => {
    if (!studentId) {
      throw new Error("Session not ready");
    }

    const previous = deck.find((item) => item.teacherId === teacherId);
    if (!previous) {
      throw new Error("Teacher not found in deck");
    }

    setDeck((items) =>
      items.map((item) =>
        item.teacherId === teacherId ? { ...item, userNotes: note } : item
      )
    );

    const res = await authedFetch(
      getIdToken,
      `${apiBase()}/decks/${encodeURIComponent(studentId)}/${encodeURIComponent(teacherId)}/note`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      }
    );

    const json = (await res.json()) as ApiResponse<{ message: string }>;
    if (!res.ok || !json.success) {
      setDeck((items) =>
        items.map((item) =>
          item.teacherId === teacherId
            ? { ...item, userNotes: previous.userNotes }
            : item
        )
      );
      throw new Error(json.error ?? "Failed to save note");
    }
  };

  const handleRemove = async (teacherId: string) => {
    if (!studentId) return;

    const previousDeck = deck;
    setDeck((items) => items.filter((item) => item.teacherId !== teacherId));

    try {
      const res = await authedFetch(
        getIdToken,
        `${apiBase()}/decks/${encodeURIComponent(studentId)}/${encodeURIComponent(teacherId)}`,
        { method: "DELETE" }
      );

      const json = (await res.json()) as ApiResponse<{ message: string }>;
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Failed to remove teacher");
      }
    } catch (err) {
      setDeck(previousDeck);
      const message = err instanceof Error ? err.message : "Failed to remove teacher";
      setError(message);
    }
  };

  const handleDrop = async (targetIndex: number) => {
    if (!draggedId || !studentId) {
      setDraggedId(null);
      setDropTargetIndex(null);
      return;
    }

    const fromIndex = deck.findIndex((item) => item.teacherId === draggedId);
    if (fromIndex === -1 || fromIndex === targetIndex) {
      setDraggedId(null);
      setDropTargetIndex(null);
      return;
    }

    const previousDeck = deck;
    const reordered = reorderDeckItems(deck, fromIndex, targetIndex);
    setDeck(reordered);
    setDraggedId(null);
    setDropTargetIndex(null);

    try {
      const res = await authedFetch(
        getIdToken,
        `${apiBase()}/decks/${encodeURIComponent(studentId)}/reorder`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            order: reordered.map((item, sortOrder) => ({
              teacherId: item.teacherId,
              sortOrder,
            })),
          }),
        }
      );

      const json = (await res.json()) as ApiResponse<{ message: string }>;
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Failed to save deck order");
      }

      showToast("Deck order saved");
    } catch (err) {
      setDeck(previousDeck);
      const message = err instanceof Error ? err.message : "Failed to save deck order";
      setError(message);
    }
  };

  return (
    <div className="flex min-h-full flex-col">
      <AppNav maxWidth="max-w-3xl" />

      {toast ? (
        <div
          className="fixed left-1/2 top-20 z-50 -translate-x-1/2 rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg"
          role="status"
        >
          {toast}
        </div>
      ) : null}

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">My Deck</h1>
            <p className="mt-1 text-sm text-slate-600">
              {deck.length} saved teacher{deck.length === 1 ? "" : "s"}
            </p>
          </div>
          <Link
            to="/discovery"
            className="text-sm font-medium text-brand-700 hover:text-brand-800"
          >
            Find more teachers →
          </Link>
        </div>

        {error ? (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="mt-12 flex items-center justify-center gap-3 text-sm text-slate-600">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-brand-700" />
            Loading your deck...
          </div>
        ) : deck.length === 0 ? (
          <div className="mt-12 rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center shadow-card">
            <p className="text-lg font-medium text-slate-800">Your deck is empty</p>
            <p className="mt-2 text-sm text-slate-600">
              Save teachers from discovery to keep track of tutors you like.
            </p>
            <Link
              to="/discovery"
              className="mt-6 inline-flex items-center justify-center rounded-full bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-800"
            >
              Browse Teachers
            </Link>
          </div>
        ) : (
          <div className="mt-8 flex flex-col gap-4">
            {deck.map((item, index) => (
              <DeckCard
                key={item.teacherId}
                item={item}
                index={index}
                isDragging={draggedId === item.teacherId}
                showDropIndicator={
                  draggedId !== null &&
                  draggedId !== item.teacherId &&
                  dropTargetIndex === index
                }
                onStatusChange={(teacherId, status) => void handleStatusChange(teacherId, status)}
                onNoteSave={handleNoteSave}
                onRemove={(teacherId) => void handleRemove(teacherId)}
                onDragStart={setDraggedId}
                onDragEnd={() => {
                  setDraggedId(null);
                  setDropTargetIndex(null);
                }}
                onDragOver={setDropTargetIndex}
                onDrop={handleDrop}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
