// Calendrier interactif « Session plans » de My profile.
// - Sessions placées par jour et par heure (vrai programme de la conférence).
// - En édition : crayon par session → recherche dans le programme pour la remplacer ;
//   interrupteur « masquer » → session grisée avec un œil barré, invisible en aperçu.
// Le plan est initialisé avec les sessions « In my plan » de la démo plus quelques sessions tirées au hasard
// dans le programme, puis gardé dans le localStorage (le service simulé de la démo ne connaît que ses 17 sessions).
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, EyeOff, Pencil, Search, X } from "lucide-react";
import type { Program, ScheduleItem } from "../api/program";
import type { Content, Id } from "../api/types";

/** Entrée du plan : une session/un event (id > 0) ou une présentation seule (id = −contentId), comme
 *  « My Schedule » du PWA qui accepte des sessions entières ou des contenus isolés (myScheduleContents). */
type Entry = { id: Id; hidden: boolean; from?: Id };

/**
 * Élément affichable d'une entrée ; pour une présentation seule : son créneau dans sa session d'origine
 * (`from` ; une présentation peut appartenir à plusieurs sessions, sinon on prend la première).
 */
export function resolveEntry(p: Program, entry: Pick<Entry, "id" | "from">): ScheduleItem | undefined {
  const { id } = entry;
  if (id > 0) return p.itemsById.get(id);
  const content = p.contents.get(-id);
  const session = content && ((entry.from != null ? p.itemsById.get(entry.from) : undefined) ?? p.contentItem(content));
  const slot = session && p.presentationTimes(session).find((x) => x.content.id === content.id);
  if (!content || !session || !slot) return undefined;
  return {
    kind: session.kind,
    id,
    name: content.title,
    description: session.name,
    typeId: content.typeId,
    roomId: session.roomId,
    peopleIds: content.authors.map((a) => a.personId),
    contentIds: [content.id],
    parallel: true,
    start: slot.start,
    end: slot.end,
  };
}

/** Une couleur par salle (fond, bordure) ; attribuées dans l'ordre des salles du plan, puis en boucle. */
const ROOM_COLORS: [string, string][] = [
  ["#e8efff", "#c9d8ff"],
  ["#e4f5ec", "#bfe5cf"],
  ["#fff3dc", "#f3d9a4"],
  ["#fde8ef", "#f5c3d3"],
  ["#f0e9ff", "#d7c7fb"],
  ["#e0f5f6", "#b5e3e6"],
  ["#ffeadd", "#f7c9a8"],
  ["#eff7dc", "#d3e7a6"],
  ["#fde6e4", "#f3bdb8"],
  ["#e3f3ff", "#b8dcf7"],
  ["#fbe7f6", "#efc0e2"],
  ["#eceff4", "#cfd6e2"],
];
const HOUR_PX = 44;

/** Générateur pseudo-aléatoire déterministe (même tirage pour un même plan). */
function rng(seedText: string) {
  let h = 2166136261;
  for (const ch of seedText) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

/**
 * Ajoute au plan des sessions tirées au hasard dans le programme : PER_DAY par jour, entre 9 h et 18 h,
 * sans chevauchement avec le plan existant, hors pauses. Fait une seule fois par plan (drapeau `:random`).
 */
const PER_DAY = 2;
function withRandomSessions(p: Program, key: string, entries: Entry[]): Entry[] {
  const random = rng(key);
  const taken = entries.map((e) => resolveEntry(p, e)).filter((i): i is ScheduleItem => !!i?.start && !!i.end);
  const overlaps = (a: ScheduleItem) => taken.some((b) => a.start! < b.end! && a.end! > b.start!);
  const out = [...entries];
  for (const day of p.days()) {
    const pool = p.items.filter(
      (i) =>
        i.kind === "session" &&
        i.start != null &&
        i.end != null &&
        p.dayKey(i.start) === day &&
        hourOf(i.start) >= 9 &&
        hourOf(i.end) <= 18 &&
        !/break|lunch|coffee|registration/i.test(i.name) &&
        !out.some((e) => e.id === i.id),
    );
    for (let n = 0; n < PER_DAY && pool.length; ) {
      const pick = pool.splice(Math.floor(random() * pool.length), 1)[0];
      if (overlaps(pick)) continue;
      taken.push(pick);
      out.push({ id: pick.id, hidden: false });
      n++;
    }
  }
  return out;
}

// ---------- Conflits entre présentations ----------
export type Slot = { content: Content | null; start: number; end: number; conflictsWith: string[] };
export type Analysis = { slots: Slot[]; allConflict: boolean };

/** Présentations d'un event avec leur horaire (l'event entier s'il n'a pas de contenu). */
function slotsOf(p: Program, item: ScheduleItem): Omit<Slot, "conflictsWith">[] {
  const times = p.presentationTimes(item);
  return times.length ? times : [{ content: null, start: item.start!, end: item.end! }];
}

/**
 * Une présentation est en conflit si elle chevauche une présentation d'un autre event du plan.
 * Un event dont toutes les présentations sont en conflit reçoit une icône d'alerte.
 */
export function analyzeConflicts(p: Program, items: ScheduleItem[]): Map<Id, Analysis> {
  const all = items.map((item) => ({ item, slots: slotsOf(p, item) }));
  const out = new Map<Id, Analysis>();
  for (const { item, slots } of all) {
    const analysed = slots.map((s) => ({
      ...s,
      conflictsWith: all
        .filter((o) => o.item.id !== item.id && o.slots.some((x) => x.start < s.end && x.end > s.start))
        .map((o) => o.item.name),
    }));
    out.set(item.id, { slots: analysed, allConflict: analysed.length > 0 && analysed.every((x) => x.conflictsWith.length > 0) });
  }
  return out;
}

/**
 * Simulation de conflits (vraies données) : pour chaque cas, une session de papiers « cible » et, à côté,
 * une présentation seule prise dans une autre session du même créneau, choisie pour que la cible ait
 * exactement 0, 1 ou 2 présentations en conflit ; plus deux sessions entières qui se chevauchent
 * (toutes les présentations en conflit → icône d'alerte). Chaque cas est placé sur un créneau libre du plan.
 * Fait une seule fois par plan (drapeau `:conflict-cases`).
 */
function withConflictScenarios(p: Program, entries: Entry[]): Entry[] {
  const out = [...entries];
  const busy = () => out.map((e) => resolveEntry(p, e)).filter((i): i is ScheduleItem => !!i?.start && !!i.end);
  const free = (i: ScheduleItem) => !busy().some((b) => i.start! < b.end! && i.end! > b.start!);
  const used = (id: Id) => out.some((e) => e.id === id);
  const papers = p.items
    .filter(
      (i) =>
        i.kind === "session" &&
        !i.parallel &&
        i.start != null &&
        i.end != null &&
        p.itemContents(i).length >= 3 &&
        !/break|lunch|coffee|registration/i.test(i.name),
    )
    .sort((a, b) => a.start! - b.start! || a.id - b.id);

  for (const want of [0, 1, 2] as const) {
    let found: Entry[] | undefined;
    // D'abord des présentations d'au moins 10 min (lisibles dans le calendrier), sinon n'importe laquelle.
    for (const minMinutes of [10, 0]) {
      for (const t of papers) {
        if (used(t.id) || !free(t)) continue;
        const tSlots = p.presentationTimes(t);
        for (const o of papers) {
          if (o.id === t.id || !(o.start! < t.end! && o.end! > t.start!)) continue;
          for (const slot of p.presentationTimes(o)) {
            if (slot.end - slot.start < minMinutes * 60_000) continue;
            if (!(slot.start < t.end! && slot.end > t.start!) || used(-slot.content.id)) continue;
            const n = tSlots.filter((x) => x.start < slot.end && x.end > slot.start).length;
            if (n === want) {
              found = [
                { id: t.id, hidden: false },
                { id: -slot.content.id, hidden: false, from: o.id },
              ];
              break;
            }
          }
          if (found) break;
        }
        if (found) break;
      }
      if (found) break;
    }
    if (found) out.push(...found);
  }

  // Deux sessions entières dans le même créneau : toutes les présentations en conflit.
  for (const t of papers) {
    if (used(t.id) || !free(t)) continue;
    const o = papers.find(
      (x) => x.id !== t.id && !used(x.id) && x.start! < t.end! && x.end! > t.start! && analyzeConflicts(p, [t, x]).get(t.id)!.allConflict,
    );
    if (o) {
      out.push({ id: t.id, hidden: false }, { id: o.id, hidden: false });
      break;
    }
  }
  return out;
}

function load(p: Program, key: string, seed: Id[]): Entry[] {
  let entries: Entry[] = seed.map((id) => ({ id, hidden: false }));
  try {
    const raw = localStorage.getItem(key);
    if (raw) entries = JSON.parse(raw);
    if (!localStorage.getItem(key + ":random")) {
      entries = withRandomSessions(p, key, entries);
      localStorage.setItem(key, JSON.stringify(entries));
      localStorage.setItem(key + ":random", "1");
    }
    if (!localStorage.getItem(key + ":conflict-cases")) {
      entries = withConflictScenarios(p, entries);
      localStorage.setItem(key, JSON.stringify(entries));
      localStorage.setItem(key + ":conflict-cases", "1");
    }
  } catch {
    /* ignore */
  }
  return entries;
}

/** Heure murale (les timestamps du JSON sont l'heure locale de la conférence notée en UTC). */
const hourOf = (ts: number) => new Date(ts).getUTCHours() + new Date(ts).getUTCMinutes() / 60;

export function PlanCalendar({
  p,
  storageKey,
  seed,
  editable,
}: {
  p: Program;
  storageKey: string;
  seed: Id[];
  editable: boolean;
}) {
  const [entries, setEntries] = useState<Entry[]>(() => load(p, storageKey, seed));
  const [replacing, setReplacing] = useState<Id | null>(null);

  useEffect(() => setEntries(load(p, storageKey, seed)), [storageKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = (next: Entry[]) => {
    setEntries(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const entryItem = (id: Id) => {
    const e = entries.find((x) => x.id === id);
    return e && resolveEntry(p, e);
  };
  const items = entries
    .map((e) => ({ ...e, item: resolveEntry(p, e) }))
    .filter((e): e is Entry & { item: ScheduleItem } => !!e.item && e.item.start != null && e.item.end != null)
    .filter((e) => editable || !e.hidden);

  // Conflits calculés sur les sessions affichées (en aperçu, les sessions masquées ne comptent pas).
  const conflicts = useMemo(() => analyzeConflicts(p, items.map((e) => e.item)), [p, items]);
  // Aperçu ouvert au survol (ou au focus) d'un event ; il reste ouvert quand la souris en sort, pour
  // pouvoir faire défiler la liste. Fermeture : croix, Échap, clic ailleurs, défilement de la page.
  const [hover, setHover] = useState<{ id: Id; rect: DOMRect } | null>(null);
  useEffect(() => {
    if (!hover) return;
    const close = () => setHover(null);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest(".planPreview") && !t.closest(".planEvent")) close();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("scroll", close);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("scroll", close);
    };
  }, [hover]);

  const roomColor = useMemo(() => {
    const rooms = [...new Set(items.map((e) => p.itemRoom(e.item)?.name ?? ""))].sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true }),
    );
    return new Map(rooms.map((r, i) => [r, ROOM_COLORS[i % ROOM_COLORS.length]]));
  }, [items, p]);

  const days = p.days();
  const [startHour, endHour] = useMemo(() => {
    if (!items.length) return [9, 18];
    const s = Math.min(...items.map((e) => Math.floor(hourOf(e.item.start!))));
    const t = Math.max(...items.map((e) => Math.ceil(hourOf(e.item.end!))));
    return [Math.min(s, 9), Math.max(t, 18)];
  }, [items]);

  if (!items.length)
    return <small>{editable ? "No session in your plan." : "No session plans shared."}</small>;

  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);

  return (
    <div className="planCal">
      <div className="planCalScroll">
        <div className="planCalGrid" style={{ gridTemplateColumns: `44px repeat(${days.length}, minmax(120px, 1fr))` }}>
          <div className="planCalCorner" />
          {days.map((d) => (
            <div key={d} className="planCalDay">
              {p.formatDay(d)}
            </div>
          ))}
          <div className="planCalHours" style={{ height: hours.length * HOUR_PX }}>
            {hours.map((h) => (
              <span key={h} style={{ top: (h - startHour) * HOUR_PX }}>
                {h}:00
              </span>
            ))}
          </div>
          {days.map((d) => (
            <DayColumn
              key={d}
              p={p}
              entries={items.filter((e) => p.dayKey(e.item.start!) === d)}
              startHour={startHour}
              height={hours.length * HOUR_PX}
              editable={editable}
              onReplace={(id) => setReplacing(id)}
              onToggle={(id) => save(entries.map((e) => (e.id === id ? { ...e, hidden: !e.hidden } : e)))}
              roomColor={roomColor}
              conflicts={conflicts}
              onHover={(id, el) => setHover(id == null || !el ? null : { id, rect: el.getBoundingClientRect() })}
            />
          ))}
        </div>
      </div>
      {editable && <p className="planCalHint">Hidden sessions are greyed here and do not appear to other attendees.</p>}
      {hover && entryItem(hover.id) && (
        <EventPreview
          p={p}
          item={entryItem(hover.id)!}
          analysis={conflicts.get(hover.id)}
          rect={hover.rect}
          onClose={() => setHover(null)}
        />
      )}
      {replacing != null && (
        <ReplaceDialog
          p={p}
          current={entryItem(replacing)!}
          exclude={new Set(entries.map((e) => e.id))}
          onClose={() => setReplacing(null)}
          onPick={(next) => {
            save(entries.map((e) => (e.id === replacing ? { id: next.id, hidden: e.hidden } : e)));
            setReplacing(null);
          }}
        />
      )}
    </div>
  );
}

function DayColumn({
  p,
  entries,
  startHour,
  height,
  editable,
  onReplace,
  onToggle,
  roomColor,
  conflicts,
  onHover,
}: {
  p: Program;
  entries: (Entry & { item: ScheduleItem })[];
  startHour: number;
  height: number;
  editable: boolean;
  onReplace: (id: Id) => void;
  onToggle: (id: Id) => void;
  roomColor: Map<string, [string, string]>;
  conflicts: Map<Id, Analysis>;
  onHover: (id: Id | null, el?: HTMLElement) => void;
}) {
  // Sessions qui se chevauchent : réparties en couloirs côte à côte, mais seulement au sein de leur
  // groupe de chevauchement (une session sans conflit garde toute la largeur).
  const sorted = [...entries].sort((a, b) => a.item.start! - b.item.start! || a.item.end! - b.item.end!);
  const placed: ((typeof sorted)[number] & { lane: number; lanes: number })[] = [];
  let group: typeof placed = [];
  let groupEnd = -Infinity;
  let lanes: number[] = [];
  const closeGroup = () => {
    for (const g of group) g.lanes = Math.max(1, lanes.length);
    group = [];
    lanes = [];
  };
  for (const e of sorted) {
    if (e.item.start! >= groupEnd) {
      closeGroup();
      groupEnd = -Infinity;
    }
    let lane = lanes.findIndex((end) => end <= e.item.start!);
    if (lane === -1) lane = lanes.push(0) - 1;
    lanes[lane] = e.item.end!;
    groupEnd = Math.max(groupEnd, e.item.end!);
    const item = { ...e, lane, lanes: 1 };
    group.push(item);
    placed.push(item);
  }
  closeGroup();

  return (
    <div className="planCalCol" style={{ height }}>
      {placed.map((e) => {
        const top = (hourOf(e.item.start!) - startHour) * HOUR_PX;
        const h = Math.max(28, (hourOf(e.item.end!) - hourOf(e.item.start!)) * HOUR_PX);
        const room = p.itemRoom(e.item);
        const [bg, border] = roomColor.get(room?.name ?? "") ?? ROOM_COLORS[0];
        return (
          <div
            key={e.id}
            className={`planEvent${e.hidden ? " hiddenEvent" : ""}${editable ? " withTools" : ""}`}
            style={{
              ...(e.hidden ? {} : { background: bg, borderColor: border }),
              top,
              height: h,
              left: `calc(${(100 / e.lanes) * e.lane}% + 2px)`,
              width: `calc(${100 / e.lanes}% - 4px)`,
            }}
            tabIndex={0}
            data-conflicts={`${conflicts.get(e.id)?.slots.filter((x) => x.conflictsWith.length).length ?? 0}/${conflicts.get(e.id)?.slots.length ?? 0}`}
            onMouseEnter={(ev) => onHover(e.id, ev.currentTarget)}
            onFocus={(ev) => onHover(e.id, ev.currentTarget)}
            aria-label={`${e.item.name}, ${p.formatRange(e.item.start!, e.item.end!)}${room ? ", " + room.name : ""}${conflicts.get(e.id)?.allConflict ? ", all presentations in conflict" : ""}`}
          >
            {editable && (
              <div className="planEventTools">
                <button className="planTool" aria-label={`Change ${e.item.name}`} title="Change session" onClick={() => onReplace(e.id)}>
                  <Pencil size={12} />
                </button>
                <label className="planSwitch" title={e.hidden ? "Hidden from others" : "Visible to others"}>
                  <input
                    type="checkbox"
                    role="switch"
                    checked={e.hidden}
                    aria-label={`Hide ${e.item.name} from others`}
                    onChange={() => onToggle(e.id)}
                  />
                  <span />
                </label>
              </div>
            )}
            <span className="planEventTime">
              {conflicts.get(e.id)?.allConflict && (
                <AlertTriangle size={12} className="planWarn" aria-label="All presentations in conflict" />
              )}
              {e.hidden && <EyeOff size={12} aria-label="Hidden from others" />} {p.formatRange(e.item.start!, e.item.end!)}
            </span>
            <span className="planEventName">{e.item.name}</span>
            {room && <span className="planEventRoom">{room.name}</span>}
          </div>
        );
      })}
    </div>
  );
}

/** Aperçu au survol : présentations de l'event avec leur horaire ; celles en conflit en rouge. */
function EventPreview({
  p,
  item,
  analysis,
  rect,
  onClose,
}: {
  p: Program;
  item: ScheduleItem;
  analysis?: Analysis;
  rect: DOMRect;
  onClose: () => void;
}) {
  const width = 340;
  const room = p.itemRoom(item);
  // À droite de l'event, ou à gauche s'il n'y a pas la place ; reste dans la fenêtre verticalement.
  const left = rect.right + 8 + width <= window.innerWidth ? rect.right + 8 : Math.max(8, rect.left - 8 - width);
  const top = Math.max(8, Math.min(rect.top, window.innerHeight - 380));
  const slots = analysis?.slots ?? [];
  const inConflict = slots.filter((s) => s.conflictsWith.length).length;
  return (
    <div className="planPreview" role="dialog" aria-label={`Presentations of ${item.name}`} style={{ left, top, width }}>
      <div className="planPreviewHead">
        {analysis?.allConflict && <AlertTriangle size={15} className="planWarn" aria-hidden="true" />}
        <strong>{item.name}</strong>
        <button className="iconBtn planPreviewClose" aria-label="Close" onClick={onClose}>
          <X size={15} />
        </button>
      </div>
      <small>
        {p.formatDay(p.dayKey(item.start!))} · {p.formatRange(item.start!, item.end!)}
        {room ? ` · ${room.name}` : ""}
      </small>
      {item.id < 0 && item.description && <small>Single presentation from “{item.description}”</small>}
      {inConflict > 0 && (
        <small className="planPreviewConflict">
          {analysis?.allConflict ? "All presentations are in conflict" : `${inConflict} of ${slots.length} presentations in conflict`}
        </small>
      )}
      <ul>
        {slots.map((s, i) => (
          <li key={s.content?.id ?? i} className={s.conflictsWith.length ? "conflict" : ""}>
            <span className="planPreviewTime">{p.formatRange(s.start, s.end)}</span>
            <span>
              {s.content?.title ?? "Whole session"}
              {s.conflictsWith.length > 0 && <em>Conflicts with {s.conflictsWith.join(", ")}</em>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Recherche dans le programme de la conférence pour remplacer une session du plan. */
function ReplaceDialog({
  p,
  current,
  exclude,
  onClose,
  onPick,
}: {
  p: Program;
  current: ScheduleItem;
  exclude: Set<Id>;
  onClose: () => void;
  onPick: (item: ScheduleItem) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  useEffect(() => {
    const el = ref.current;
    el?.showModal();
    input.current?.focus();
    return () => el?.close();
  }, []);

  const results = useMemo(() => {
    const query = q.trim().toLowerCase();
    const scheduled = p.items.filter((i) => i.start != null && i.end != null && !exclude.has(i.id));
    // Sans recherche : les sessions du même créneau, alternatives naturelles.
    const list = !query
      ? scheduled.filter((i) => i.start! < current.end! && i.end! > current.start!)
      : scheduled.filter(
          (i) =>
            i.name.toLowerCase().includes(query) ||
            (p.itemRoom(i)?.name.toLowerCase().includes(query) ?? false) ||
            i.peopleIds.some((id) => p.personName(id).toLowerCase().includes(query)) ||
            p.itemContents(i).some((c) => c.title.toLowerCase().includes(query)),
        );
    return list.sort((a, b) => a.start! - b.start! || a.name.localeCompare(b.name)).slice(0, 60);
  }, [p, q, current, exclude]);

  return (
    <dialog
      ref={ref}
      className="planSearch"
      aria-label="Change session"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="planSearchTop">
        <strong>Change “{current.name}”</strong>
        <button className="iconBtn" aria-label="Close" onClick={onClose}>
          <X size={18} />
        </button>
      </div>
      <label className="search planSearchField">
        <Search size={18} className="muted" />
        <input
          ref={input}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search sessions, contents, people, rooms"
          aria-label="Search the conference program"
        />
      </label>
      <small className="planSearchHint">
        {q.trim() ? `${results.length}${results.length === 60 ? "+" : ""} result(s)` : "Sessions at the same time"}
      </small>
      <ul className="planSearchResults">
        {results.map((i) => {
          const room = p.itemRoom(i);
          return (
            <li key={`${i.kind}-${i.id}`}>
              <button onClick={() => onPick(i)}>
                <span className="type-dot" style={{ background: p.contentTypes.get(i.typeId)?.color }} />
                <span className="planSearchMain">
                  <b>{i.name}</b>
                  <small>
                    {p.formatDay(p.dayKey(i.start!))} · {p.formatRange(i.start!, i.end!)}
                    {room ? ` · ${room.name}` : ""} · {p.typeLabel(i.typeId)}
                  </small>
                </span>
              </button>
            </li>
          );
        })}
        {!results.length && <li className="muted planSearchEmpty">No matching session.</li>}
      </ul>
    </dialog>
  );
}
