import { useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronDown, Clock, ExternalLink, MapPin, MoreVertical, Pencil, StickyNote, Trophy } from "lucide-react";
import { useNav } from "../nav";
import { useNotes } from "../notes";
import type { Program, ScheduleItem } from "../api/program";
import type { Content, Id } from "../api/types";

export function TypeChip({ p, typeId }: { p: Program; typeId: Id }) {
  const color = p.contentTypes.get(typeId)?.color;
  return (
    <span className="type-chip">
      <span className="type-dot" style={{ background: color }} />
      {p.typeLabel(typeId)}
    </span>
  );
}

function PeopleLinks({ p, ids }: { p: Program; ids: Id[] }) {
  const nav = useNav();
  if (!ids.length) return null;
  return (
    <div className="card-people">
      {ids.map((id, i) => (
        <span key={id}>
          {i > 0 && ", "}
          <a
            href={`#person-${id}`}
            onClick={(e) => {
              e.preventDefault();
              nav.go("people", { personId: id });
            }}
          >
            {p.personName(id)}
          </a>
        </span>
      ))}
    </div>
  );
}

/** Menu ⋮ d'un contenu. Seul « Add note » est branché (les autres actions du PWA écrivent sur le compte). */
function ContentMenu({ p, c }: { p: Program; c: Content }) {
  const notes = useNotes();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const has = !!notes.get(p.conference.id, c.id);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  return (
    <div className="card-menu" ref={ref}>
      <button className="icon-btn" title="More" aria-label="More" aria-expanded={open} onClick={() => setOpen(!open)}>
        <MoreVertical size={20} />
      </button>
      {open && (
        <div className="card-menu-pop" role="menu">
          <button
            role="menuitem"
            onClick={() => {
              setOpen(false);
              notes.edit(p.conference.id, c.id, c.title);
            }}
          >
            <Pencil size={16} /> {has ? "Edit note" : "Add note"}
          </button>
        </div>
      )}
    </div>
  );
}

export function SessionCard({
  p,
  s,
  added,
  inSchedule,
  onToggleSchedule,
}: {
  p: Program;
  s: ScheduleItem;
  /** contenus de la session présents dans "mon programme" */
  added: number;
  inSchedule: boolean;
  onToggleSchedule: () => void;
}) {
  const [open, setOpen] = useState(false);
  const room = p.itemRoom(s);
  const contents = p.itemContents(s);
  const color = p.contentTypes.get(s.typeId)?.color;

  return (
    <article className={`session-card${open ? " open" : ""}`}>
      <div className="session-main">
        <span className="type-stripe" style={{ background: color }} />
        <div className="session-data">
          <div className="session-top">
            <h4 className="card-title">{s.name}</h4>
            <div className="card-actions">
              <button
                className={`icon-btn${inSchedule ? " on" : ""}`}
                aria-pressed={inSchedule}
                title={inSchedule ? "Remove from my schedule" : "Add to my schedule"}
                onClick={onToggleSchedule}
              >
                <Clock size={20} />
              </button>
              <button className="icon-btn" title="More" aria-label="More">
                <MoreVertical size={20} />
              </button>
            </div>
          </div>
          <div className="card-info">
            <TypeChip p={p} typeId={s.typeId} />
            <span className="muted">
              {contents.length} items / {added} added
            </span>
          </div>
          <PeopleLinks p={p} ids={s.peopleIds} />
          {s.start != null && s.end != null && (
            <div className="card-date">
              <CalendarDays size={14} />
              {p.formatDay(p.dayKey(s.start))} | {p.formatRange(s.start, s.end)}
            </div>
          )}
        </div>
        <div className="session-right">
          {room && (
            <span className="room">
              <MapPin size={18} />
              {room.name}
            </span>
          )}
        </div>
      </div>

      {contents.length > 0 && (
        <button
          className="toggle-card"
          aria-expanded={open}
          aria-label={open ? "Hide contents" : "Show contents"}
          onClick={() => setOpen(!open)}
        >
          <ChevronDown size={16} />
        </button>
      )}

      {open && (
        <div className="session-contents">
          {s.description && <p className="session-desc">{s.description}</p>}
          {contents.map((c) => (
            <ContentCard key={c.id} p={p} c={c} nested />
          ))}
        </div>
      )}
    </article>
  );
}

export function ContentCard({ p, c, nested }: { p: Program; c: Content; nested?: boolean }) {
  const [showAbstract, setShowAbstract] = useState(false);
  const note = useNotes().get(p.conference.id, c.id);
  const session = !nested ? p.contentItem(c) : undefined;
  const room = session ? p.itemRoom(session) : undefined;
  const doi = c.addons?.doi?.url;
  const color = p.contentTypes.get(c.typeId)?.color;

  return (
    <article className={`content-card${nested ? " nested" : ""}`}>
      {!nested && <span className="type-stripe" style={{ background: color }} />}
      <div className="content-data">
        <div className="session-top">
          <h4 className="card-title">
            {c.title}
            {c.award && (
              <span className="award" title={c.award}>
                <Trophy size={13} /> {c.award.replace(/_/g, " ").toLowerCase()}
              </span>
            )}
          </h4>
          <ContentMenu p={p} c={c} />
        </div>
        <div className="card-info">
          <TypeChip p={p} typeId={c.typeId} />
          {doi && (
            <a className="doi" href={doi} target="_blank" rel="noreferrer">
              DOI <ExternalLink size={12} />
            </a>
          )}
        </div>
        <PeopleLinks p={p} ids={c.authors.map((a) => a.personId)} />
        {session && (
          <div className="card-date">
            <CalendarDays size={14} />
            {session.start != null &&
              session.end != null &&
              `${p.formatDay(p.dayKey(session.start))} | ${p.formatRange(session.start, session.end)} · `}
            {session.name}
            {room && ` · ${room.name}`}
          </div>
        )}
        {c.abstract && (
          <>
            <button className="text-btn" onClick={() => setShowAbstract(!showAbstract)}>
              {showAbstract ? "Hide abstract" : "Abstract"}
            </button>
            {showAbstract && <p className="abstract">{c.abstract}</p>}
          </>
        )}
        {note && (
          <p className="card-note">
            <StickyNote size={14} /> {note.text}
          </p>
        )}
      </div>
    </article>
  );
}
