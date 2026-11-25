// Notes sur les contenus (page My Notes), gardées dans le localStorage.
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import type { Id } from "./api/types";

export type Note = { conferenceId: Id; contentId: Id; text: string; updatedAt: number };
const KEY = "my-notes";
const key = (conferenceId: Id, contentId: Id) => `${conferenceId}:${contentId}`;

function load(): Record<string, Note> {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
}

type NotesApi = {
  notes: Record<string, Note>;
  get: (conferenceId: Id, contentId: Id) => Note | undefined;
  /** Ouvre l'éditeur de note pour un contenu. */
  edit: (conferenceId: Id, contentId: Id, title: string) => void;
};
const Ctx = createContext<NotesApi | null>(null);

export function NotesProvider({ children }: { children: ReactNode }) {
  const [notes, setNotes] = useState<Record<string, Note>>(load);
  const [editing, setEditing] = useState<{ conferenceId: Id; contentId: Id; title: string } | null>(null);

  const save = useCallback((conferenceId: Id, contentId: Id, text: string) => {
    setNotes((prev) => {
      const next = { ...prev };
      if (text.trim()) next[key(conferenceId, contentId)] = { conferenceId, contentId, text: text.trim(), updatedAt: Date.now() };
      else delete next[key(conferenceId, contentId)];
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const api: NotesApi = {
    notes,
    get: (conferenceId, contentId) => notes[key(conferenceId, contentId)],
    edit: (conferenceId, contentId, title) => setEditing({ conferenceId, contentId, title }),
  };

  return (
    <Ctx.Provider value={api}>
      {children}
      {editing && (
        <NoteEditor
          title={editing.title}
          initial={notes[key(editing.conferenceId, editing.contentId)]?.text ?? ""}
          onClose={() => setEditing(null)}
          onSave={(text) => {
            save(editing.conferenceId, editing.contentId, text);
            setEditing(null);
          }}
        />
      )}
    </Ctx.Provider>
  );
}

export function useNotes(): NotesApi {
  const v = useContext(Ctx);
  if (!v) throw new Error("useNotes outside NotesProvider");
  return v;
}

function NoteEditor({
  title,
  initial,
  onClose,
  onSave,
}: {
  title: string;
  initial: string;
  onClose: () => void;
  onSave: (text: string) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [text, setText] = useState(initial);
  const area = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    el?.showModal();
    // showModal() donne le focus au premier bouton (fermer) : on le met dans la zone de texte.
    area.current?.focus();
    return () => el?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="note-dialog"
      aria-label="Note"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(text);
        }}
      >
        <div className="note-dialog-top">
          <strong>{initial ? "Edit note" : "Add note"}</strong>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <p className="note-dialog-title">{title}</p>
        <textarea
          ref={area}
          value={text}
          maxLength={5000}
          rows={6}
          placeholder="Write a note"
          onChange={(e) => setText(e.target.value)}
        />
        <div className="note-dialog-actions">
          {initial && (
            <button type="button" className="btn-text danger" onClick={() => onSave("")}>
              Delete note
            </button>
          )}
          <button type="button" className="btn-text" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary">
            Save
          </button>
        </div>
      </form>
    </dialog>
  );
}
