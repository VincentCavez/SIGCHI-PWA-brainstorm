// Accès aux données publiques (sans auth). URLs : voir src/config.ts et .env.
import { config } from "../config";
import type {
  Affiliation,
  Content,
  ConfEvent,
  ContentType,
  Floor,
  Id,
  Person,
  ProgramListEntry,
  RawProgram,
  Room,
  Session,
  TimeSlot,
  Track,
} from "./types";

export async function fetchProgramList(): Promise<ProgramListEntry[]> {
  const res = await fetch(config.programListUrl);
  if (!res.ok) throw new Error(`conference list: HTTP ${res.status}`);
  return res.json();
}

export async function fetchProgram(shortName: string, year: number): Promise<Program> {
  const res = await fetch(config.programUrl(shortName, year));
  if (!res.ok) throw new Error(`program ${shortName} ${year}: HTTP ${res.status}`);
  return new Program(await res.json());
}

function byId<T extends { id: Id }>(items: T[]): Map<Id, T> {
  return new Map(items.map((x) => [x.id, x]));
}

/**
 * Élément affichable dans le programme : une session (rattachée à un timeSlot)
 * ou un event (qui porte directement ses dates). Le PWA les mélange dans la même liste.
 */
export interface ScheduleItem {
  kind: "session" | "event";
  id: Id;
  name: string;
  description?: string;
  typeId: Id;
  roomId?: Id;
  /** chairs pour une session, presenters pour un event */
  peopleIds: Id[];
  contentIds: Id[];
  /** Présentations simultanées (posters, démos…) : toutes durent toute la session. */
  parallel: boolean;
  start?: number;
  end?: number;
}

/** Programme indexé : lookups O(1) et helpers pour construire des vues. */
export class Program {
  readonly raw: RawProgram;
  readonly conference: RawProgram["conference"];
  readonly sessions: Map<Id, Session>;
  readonly events: Map<Id, ConfEvent>;
  readonly contents: Map<Id, Content>;
  readonly people: Map<Id, Person>;
  readonly timeSlots: Map<Id, TimeSlot>;
  readonly rooms: Map<Id, Room>;
  readonly floors: Map<Id, Floor>;
  readonly tracks: Map<Id, Track>;
  readonly contentTypes: Map<Id, ContentType>;
  /** sessions + events, normalisés */
  readonly items: ScheduleItem[];
  readonly itemsById: Map<Id, ScheduleItem>;
  /** personId -> contenus dont la personne est autrice */
  readonly contentsByPerson: Map<Id, Content[]>;
  /**
   * personId -> affiliations distinctes. Dans le JSON, people[].affiliations est presque toujours vide
   * (30 / 9756 pour CHI 2026) : les affiliations sont portées par contents[].authors[].
   */
  readonly affiliationsByPerson: Map<Id, Affiliation[]>;

  constructor(raw: RawProgram) {
    this.raw = raw;
    this.conference = raw.conference;
    this.sessions = byId(raw.sessions);
    this.events = byId(raw.events);
    this.contents = byId(raw.contents);
    this.people = byId(raw.people);
    this.timeSlots = byId(raw.timeSlots);
    this.rooms = byId(raw.rooms);
    this.floors = byId(raw.floors);
    this.tracks = byId(raw.tracks);
    this.contentTypes = byId(raw.contentTypes);

    this.items = [
      ...raw.sessions.map((s): ScheduleItem => {
        const slot = s.timeSlotId != null ? this.timeSlots.get(s.timeSlotId) : undefined;
        return {
          kind: "session",
          id: s.id,
          name: s.name,
          description: s.description,
          typeId: s.typeId,
          roomId: s.roomId,
          peopleIds: s.chairIds,
          contentIds: s.contentIds,
          parallel: !!s.isParallelPresentation,
          start: slot?.startDate,
          end: slot?.endDate,
        };
      }),
      ...raw.events.map(
        (e): ScheduleItem => ({
          kind: "event",
          id: e.id,
          name: e.name,
          description: e.description,
          typeId: e.typeId,
          roomId: e.roomId,
          peopleIds: e.presenterIds.length ? e.presenterIds : e.chairIds,
          contentIds: e.contentIds,
          parallel: !!e.isParallelPresentation,
          start: e.startDate,
          end: e.endDate,
        }),
      ),
    ];
    this.itemsById = new Map(this.items.map((i) => [i.id, i]));

    this.contentsByPerson = new Map();
    this.affiliationsByPerson = new Map();
    const addAffiliations = (personId: Id, affs: Affiliation[] | undefined) => {
      const list = this.affiliationsByPerson.get(personId) ?? [];
      for (const a of affs ?? []) {
        if (!a.institution) continue;
        const k = JSON.stringify([a.institution, a.country, a.state, a.city, a.dsl]);
        if (!list.some((b) => JSON.stringify([b.institution, b.country, b.state, b.city, b.dsl]) === k)) list.push(a);
      }
      this.affiliationsByPerson.set(personId, list);
    };
    for (const person of raw.people) addAffiliations(person.id, person.affiliations);
    for (const c of raw.contents) {
      for (const a of c.authors) {
        const list = this.contentsByPerson.get(a.personId) ?? [];
        list.push(c);
        this.contentsByPerson.set(a.personId, list);
        addAffiliations(a.personId, a.affiliations);
      }
    }
  }

  /**
   * Les horaires du programme sont exprimés en heure locale de la conférence :
   * on les formate en UTC pour les afficher tels quels.
   */
  get timeZone(): string {
    return "UTC";
  }

  personName(id: Id): string {
    const p = this.people.get(id);
    if (!p) return `#${id}`;
    return [p.firstName, p.middleInitial, p.lastName].filter(Boolean).join(" ");
  }

  itemContents(item: ScheduleItem): Content[] {
    return item.contentIds.map((id) => this.contents.get(id)).filter((c): c is Content => !!c);
  }

  /**
   * Horaire de chaque présentation d'une session, calculé comme le PWA : début de la session + durées
   * (contentTypes[].duration, en minutes) des présentations précédentes. Vérifié sur CHI 2026 :
   * 4e papier de « Algorithmic Power… » (11:15) → 11:51–12:03, comme sur programs.sigchi.org.
   * Session parallèle (isParallelPresentation : posters, démos) ou type sans durée (0) : la présentation
   * occupe toute la session. Rien ne dépasse la fin de la session.
   */
  presentationTimes(item: ScheduleItem): { content: Content; start: number; end: number }[] {
    if (item.start == null || item.end == null) return [];
    let t = item.start;
    return this.itemContents(item).map((content) => {
      const minutes = this.contentTypes.get(content.typeId)?.duration ?? 0;
      if (item.parallel || !minutes) return { content, start: item.start!, end: item.end! };
      const start = Math.min(t, item.end!);
      const end = Math.min(start + minutes * 60_000, item.end!);
      t = end;
      return { content, start, end };
    });
  }

  itemRoom(item: ScheduleItem): Room | undefined {
    return item.roomId != null ? this.rooms.get(item.roomId) : undefined;
  }

  /** Session ou event principal d'un contenu. */
  contentItem(c: Content): ScheduleItem | undefined {
    const id = c.sessionIds[0] ?? c.eventIds[0];
    return id != null ? this.itemsById.get(id) : undefined;
  }

  /** Clé de jour "YYYY-MM-DD". */
  dayKey(ts: number): string {
    return new Date(ts).toISOString().slice(0, 10);
  }

  /** Jours de la conférence, triés. */
  days(): string[] {
    const keys = new Set<string>();
    for (const i of this.items) if (i.start != null) keys.add(this.dayKey(i.start));
    return [...keys].sort();
  }

  /** Éléments d'un jour, groupés par plage horaire (début–fin) et triés. */
  scheduleForDay(day: string): { start: number; end: number; items: ScheduleItem[] }[] {
    const groups = new Map<string, { start: number; end: number; items: ScheduleItem[] }>();
    for (const i of this.items) {
      if (i.start == null || i.end == null || this.dayKey(i.start) !== day) continue;
      const key = `${i.start}-${i.end}`;
      const g = groups.get(key) ?? { start: i.start, end: i.end, items: [] };
      g.items.push(i);
      groups.set(key, g);
    }
    return [...groups.values()]
      .map((g) => ({ ...g, items: g.items.sort((a, b) => a.name.localeCompare(b.name)) }))
      .sort((a, b) => a.start - b.start || a.end - b.end);
  }

  /** Éléments sans date (onglet "Other" du PWA). */
  unscheduledItems(): ScheduleItem[] {
    return this.items.filter((i) => i.start == null);
  }

  /** Libellé de type tel qu'affiché par le PWA ("Papers", "Plenary And Keynote"). */
  typeLabel(typeId: Id): string {
    const t = this.contentTypes.get(typeId);
    if (!t) return "";
    return t.displayName || t.name.replace(/\b\w/g, (c) => c.toUpperCase());
  }

  /** "11:15 AM" */
  formatTime(ts: number): string {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: this.timeZone,
      hour: "numeric",
      minute: "2-digit",
    }).format(ts);
  }

  formatRange(start: number, end: number): string {
    return start === end ? this.formatTime(start) : `${this.formatTime(start)} - ${this.formatTime(end)}`;
  }

  private dayParts(day: string, style: "short" | "long") {
    const parts = new Intl.DateTimeFormat("en-GB", {
      weekday: style,
      day: "numeric",
      month: style,
      timeZone: "UTC",
    }).formatToParts(new Date(`${day}T12:00:00Z`));
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    return `${get("weekday")}, ${get("day")} ${get("month")}`;
  }

  /** "Mon, 13 Apr" */
  formatDay(day: string): string {
    return this.dayParts(day, "short");
  }

  /** "Monday, 13 April" */
  formatDayLong(day: string): string {
    return this.dayParts(day, "long");
  }

  /** "UTC +02:00" d'après conference.timeZoneOffset (minutes). */
  utcOffsetLabel(): string {
    const o = this.conference.timeZoneOffset;
    const abs = Math.abs(o);
    const hh = String(Math.floor(abs / 60)).padStart(2, "0");
    const mm = String(abs % 60).padStart(2, "0");
    return `UTC ${o < 0 ? "-" : "+"}${hh}:${mm}`;
  }
}
