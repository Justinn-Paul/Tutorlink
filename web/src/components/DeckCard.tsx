import { useState } from "react";
import { Link } from "react-router-dom";
import type { DeckItem, DeckStatus } from "../types/deck";

const STATUS_OPTIONS: DeckStatus[] = ["interested", "contacted", "active", "past"];

const STATUS_STYLES: Record<DeckStatus, string> = {
  interested: "bg-blue-50 text-blue-700",
  contacted: "bg-amber-50 text-amber-800",
  active: "bg-emerald-50 text-emerald-700",
  past: "bg-slate-100 text-slate-600",
};

const MAX_NOTE_LENGTH = 500;

type DeckCardProps = {
  item: DeckItem;
  isDragging: boolean;
  showDropIndicator: boolean;
  onStatusChange: (teacherId: string, status: DeckStatus) => void;
  onNoteSave: (teacherId: string, note: string) => Promise<void>;
  onRemove: (teacherId: string) => void;
  onDragStart: (teacherId: string) => void;
  onDragEnd: () => void;
  onDragOver: (index: number) => void;
  onDrop: (index: number) => void;
  index: number;
};

export function DeckCard({
  item,
  isDragging,
  showDropIndicator,
  onStatusChange,
  onNoteSave,
  onRemove,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  index,
}: DeckCardProps) {
  const [editingNote, setEditingNote] = useState(false);
  const [noteDraft, setNoteDraft] = useState(item.userNotes ?? "");
  const [savingNote, setSavingNote] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);

  const displayName = item.name?.trim() || "Tutor";
  const subjects =
    Array.isArray(item.subjects) && item.subjects.length > 0
      ? item.subjects
      : item.subject
        ? [item.subject]
        : [];

  const handleRemoveClick = () => {
    if (window.confirm("Remove this teacher from your deck?")) {
      onRemove(item.teacherId);
    }
  };

  const startEditingNote = () => {
    setNoteDraft(item.userNotes ?? "");
    setNoteError(null);
    setEditingNote(true);
  };

  const cancelEditingNote = () => {
    setNoteDraft(item.userNotes ?? "");
    setNoteError(null);
    setEditingNote(false);
  };

  const handleSaveNote = async () => {
    const trimmed = noteDraft.trim();
    if (trimmed.length > MAX_NOTE_LENGTH) {
      setNoteError(`Note must be ${MAX_NOTE_LENGTH} characters or fewer`);
      return;
    }

    setSavingNote(true);
    setNoteError(null);
    try {
      await onNoteSave(item.teacherId, trimmed);
      setEditingNote(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save note";
      setNoteError(message);
    } finally {
      setSavingNote(false);
    }
  };

  return (
    <div
      className={`relative ${showDropIndicator ? "pt-2" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOver(index);
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDrop(index);
      }}
    >
      {showDropIndicator ? (
        <div className="absolute left-0 right-0 top-0 h-1 rounded-full bg-brand-600" />
      ) : null}

      <article
        draggable
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", item.teacherId);
          onDragStart(item.teacherId);
        }}
        onDragEnd={onDragEnd}
        className={`relative rounded-2xl border border-slate-200 bg-white p-4 shadow-card sm:p-5 ${
          isDragging ? "opacity-50" : ""
        }`}
      >
        <button
          type="button"
          onClick={handleRemoveClick}
          className="absolute right-3 top-3 rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
          aria-label="Remove from deck"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="h-4 w-4"
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
        </button>

        <div className="flex gap-3 sm:gap-4">
          <div
            className="mt-1 shrink-0 cursor-grab select-none text-xl leading-none text-slate-400 active:cursor-grabbing"
            aria-hidden
          >
            ⠿
          </div>

          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full border border-slate-200 bg-slate-100 sm:h-14 sm:w-14">
            {item.photoUrl ? (
              <img
                src={item.photoUrl}
                alt={displayName}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-lg text-slate-400">
                👤
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1 pr-8">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <Link
                  to={`/teachers/${encodeURIComponent(item.teacherId)}`}
                  className="truncate text-base font-semibold text-slate-900 hover:text-brand-800 sm:text-lg"
                >
                  {displayName}
                </Link>
                <p className="mt-0.5 text-sm text-slate-600">{item.location ?? "—"}</p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${STATUS_STYLES[item.status]}`}
                >
                  {item.status}
                </span>
                <select
                  value={item.status}
                  onChange={(e) =>
                    onStatusChange(item.teacherId, e.target.value as DeckStatus)
                  }
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700"
                  aria-label="Change status"
                >
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {subjects.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {subjects.map((subject) => (
                  <span
                    key={subject}
                    className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700"
                  >
                    {subject}
                  </span>
                ))}
              </div>
            ) : null}

            <div className="mt-4">
              {editingNote ? (
                <div>
                  <textarea
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value.slice(0, MAX_NOTE_LENGTH))}
                    rows={3}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
                    placeholder="Add a private note..."
                    autoFocus
                  />
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <span className="text-xs text-slate-500">
                      {noteDraft.length}/{MAX_NOTE_LENGTH}
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={cancelEditingNote}
                        className="rounded-full px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleSaveNote()}
                        disabled={savingNote}
                        className="rounded-full bg-brand-700 px-3 py-1 text-xs font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
                      >
                        {savingNote ? "Saving..." : "Save"}
                      </button>
                    </div>
                  </div>
                  {noteError ? (
                    <p className="mt-1 text-xs text-red-600">{noteError}</p>
                  ) : null}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={startEditingNote}
                  className="w-full rounded-xl border border-dashed border-slate-200 px-3 py-2 text-left text-sm text-slate-600 transition hover:border-brand-300 hover:bg-brand-50/50"
                >
                  {item.userNotes?.trim()
                    ? item.userNotes
                    : "Add a private note..."}
                </button>
              )}
            </div>
          </div>
        </div>
      </article>
    </div>
  );
}
