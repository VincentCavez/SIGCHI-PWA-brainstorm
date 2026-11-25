import { people, backgrounds, type Person } from "./demo-fixtures";
import { defaultConference } from "./conferences";
import type { RoomBoard } from "./room-status";
export type Identity = { id: string; name: string };
export type Audience = {
  mode: "private" | "attendees" | "selected";
  people: string[];
};
export type Preference = { person: string; field: string; value: string };
export type ReadingList = {
  id: string;
  name: string;
  paperIds: string[];
  visible: boolean;
};
export type CheckIn = { room: string; expiresAt: number; countMe?: boolean };
export type DemoPerson = Person & {
  reminderMinutes: number;
  lists: ReadingList[];
  rules: Record<string, Audience>;
  checkIn: CheckIn | null;
};
export type Profile = Pick<
  Person,
  | "id"
  | "name"
  | "affiliation"
  | "role"
  | "city"
  | "bio"
  | "topics"
  | "color"
  | "links"
  | "authorKey"
> & {
  authored: string[];
  lists: ReadingList[];
  shared: string[];
  checkIn: CheckIn | null;
  publicResearch?: { source: string; recommended: string[] };
};
export type Message = {
  id: number;
  sender: string;
  recipient: string;
  body: string;
  sent: string;
};
export type View = {
  roomBoard: RoomBoard;
  viewer: string;
  own: DemoPerson | null;
  directory: Profile[];
  messages: Message[];
  identities: Identity[];
};
export const audience = (on: boolean): Audience => ({
  mode: on ? "attendees" : "private",
  people: [],
});
export const audienceName = (a: Audience) =>
  a.mode === "attendees"
    ? "Conference attendees"
    : a.mode === "selected"
      ? "Selected people"
      : "Only me";
export function permits(a: Audience | undefined, id: string) {
  return (
    !!a &&
    id !== "guest" &&
    (a.mode === "attendees" || (a.mode === "selected" && a.people.includes(id)))
  );
}
export function identities(rows: Preference[]): Identity[] {
  return [
    ...people.map(({ id, name }) => ({ id, name })),
    ...rows
      .filter((r) => r.field === "identity")
      .map((r) => ({ id: r.person, name: JSON.parse(r.value) })),
  ];
}
function customPerson(id: string, name: string): Person {
  return {
    id,
    name,
    affiliation: "",
    bio: "",
    topics: [],
    color: "blue",
    authorKey: "",
    links: { website: "", scholar: "" },
    profileVisible: false,
    listVisible: false,
    listName: "My reading list",
    saved: [],
    going: [],
    shared: [],
  };
}
export function restore(
  rows: Preference[],
  now = Date.now(),
  event = defaultConference,
): DemoPerson[] {
  const { papers, sessions, rooms } = event;
  const legacyDemo = event.id === defaultConference.id;
  return identities(rows).map(({ id, name }) => {
    const p = structuredClone(
      people.find((x) => x.id === id) ?? customPerson(id, name),
    );
    if (!legacyDemo) {
      p.profileVisible = false;
      p.listVisible = false;
      p.saved = [];
      p.going = [];
      p.shared = [];
      p.authorKey = "";
      if (people.some((person) => person.id === id)) {
        const paper = papers.find((a) => a.authorNames.includes(name));
        if (paper) p.authorKey = paper.authors[paper.authorNames.indexOf(name)];
      }
    }
    const rules: Record<string, Audience> = {
      profile: audience(p.profileVisible),
      links: audience(legacyDemo),
      currentRoom: audience(false),
      "list.reading": audience(p.listVisible),
      "list.later": audience(false),
    };
    for (const s of sessions)
      rules["session." + s.id] = audience(p.shared.includes(s.id));
    const byKey = new Map(
      rows
        .filter((r) => r.person === id)
        .map((r) => [r.field, JSON.parse(r.value)]),
    );
    const lists = [
      {
        id: "reading",
        name: p.listName,
        paperIds: byKey.get("papers.reading") ?? p.saved,
        visible: false,
      },
      {
        id: "later",
        name: "Read after the conference",
        paperIds: byKey.get("papers.later") ?? [],
        visible: false,
      },
    ];
    for (const k of Object.keys(rules)) {
      const override = byKey.get("audience." + k);
      if (override) rules[k] = override;
    }
    for (const s of sessions) {
      const going = byKey.get("going." + s.id);
      if (going !== undefined) {
        p.going = p.going.filter((x) => x !== s.id);
        if (going) p.going.push(s.id);
      }
    }
    p.shared = p.going.filter(
      (id) => rules["session." + id].mode !== "private",
    );
    p.profileVisible = rules.profile.mode !== "private";
    for (const list of lists)
      list.visible = rules["list." + list.id].mode !== "private";
    p.links = byKey.get("links") ?? p.links;
    // Ajout du prototype : centres d'intérêt modifiables depuis My profile.
    p.topics = byKey.get("topics") ?? p.topics;
    const checkIn = byKey.get("checkIn") as CheckIn | null | undefined;
    return {
      ...p,
      reminderMinutes: byKey.get("reminderMinutes") ?? 10,
      lists,
      rules,
      checkIn:
        checkIn && checkIn.expiresAt > now && rooms.includes(checkIn.room)
          ? checkIn
          : null,
    };
  });
}
export function publicProfile(
  p: DemoPerson,
  viewer: string,
  event = defaultConference,
): Profile {
  const { papers } = event;
  const see = (field: string) => permits(p.rules[field], viewer);
  const background = backgrounds.find((b) => b.id === p.id);
  return {
    ...(background && see("links")
      ? {
          publicResearch: {
            source: background.source,
            recommended: background.recommended.filter((id) =>
              papers.some((paper) => paper.id === id),
            ),
          },
        }
      : {}),
    id: p.id,
    name: p.name,
    affiliation: p.affiliation,
    role: p.role,
    city: p.city,
    bio: p.bio,
    topics: p.topics,
    color: p.color,
    links: see("links") ? p.links : { website: "", scholar: "" },
    authorKey: p.authorKey,
    authored: p.authorKey
      ? papers.filter((a) => a.authors.includes(p.authorKey)).map((a) => a.id)
      : [],
    lists: p.lists.filter((l) => see("list." + l.id)),
    shared: p.going.filter((id) => see("session." + id)),
    checkIn: see("currentRoom") && p.checkIn ? { room: p.checkIn.room, expiresAt: p.checkIn.expiresAt } : null,
  };
}
export function overlap(own: DemoPerson, p: Profile) {
  const interests = p.topics.filter((t) => own.topics.includes(t)),
    saved = new Set(own.lists.flatMap((l) => l.paperIds));
  const commonPapers = [...new Set(p.lists.flatMap((l) => l.paperIds))].filter(
    (id) => saved.has(id),
  );
  const commonSessions = p.shared.filter((id) => own.going.includes(id));
  return {
    interests,
    commonPapers,
    commonSessions,
    score: interests.length + commonPapers.length + commonSessions.length,
  };
}
