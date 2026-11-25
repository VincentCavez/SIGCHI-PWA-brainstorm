import {
  conferenceForPath,
  conferencePrefix,
  defaultConference,
} from "./conferences";
import {
  restore,
  publicProfile,
  permits,
  audience,
  identities,
  type Audience,
  type Message,
  type Preference,
} from "./network-model";
import { badgeField, demoSensor, hasDemoCounter, isSeatReport, reportField, roomBoard } from "./room-status";
import { validReminder } from "./session-reminders";
export type DemoStore = {
  rows: Preference[];
  messages: (Message & { conferenceId?: string })[];
};
export type Change = { person: string; field: string; value: string };
export type Result = {
  status: number;
  data: any;
  changes?: Change[];
  message?: Omit<Message, "id">;
};
const result = (data: unknown, status = 200): Result => ({ status, data });
const error = (status: number, message: string) =>
  result({ error: message }, status);
const setting = (person: string, field: string, value: unknown) => ({
  person,
  field,
  value: JSON.stringify(value),
});
function safeLink(value: unknown, scholar = false) {
  if (typeof value !== "string" || value.length > 300) return false;
  if (value === "") return true;
  try {
    const u = new URL(value);
    return (
      u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      (!scholar || u.hostname === "scholar.google.com")
    );
  } catch {
    return false;
  }
}
function readAudience(value: unknown, allowedIds: string[]): Audience | null {
  if (
    !value ||
    typeof value !== "object" ||
    !("mode" in value) ||
    !("people" in value)
  )
    return null;
  const { mode, people } = value;
  if (
    (mode !== "private" && mode !== "attendees" && mode !== "selected") ||
    !Array.isArray(people) ||
    !people.every((id) => typeof id === "string" && allowedIds.includes(id))
  )
    return null;
  return {
    mode,
    people: mode === "selected" ? [...new Set<string>(people)] : [],
  };
}
export function serve(
  path: string,
  method: string,
  viewer: string,
  body: any,
  store: DemoStore,
  now = Date.now(),
): Result {
  const url = new URL(path, "https://demo.example");
  const conference = conferenceForPath(url.pathname);
  if (path === "start" && method === "POST")
    return result({ demo: true, conference: defaultConference.id });
  if (!conference) return error(404, "Unknown conference.");
  const route = url.pathname.slice(conferencePrefix(conference.id).length + 1);
  const { papers, sessions, rooms } = conference;
  // Unprefixed preferences belong to the original CHI ’26 demo.
  const scope =
    conference.id === defaultConference.id ? "" : conference.id + ":";
  const rows = store.rows
    .filter(
      (row) =>
        row.field !== "identity" &&
        (scope ? row.field.startsWith(scope) : !row.field.includes(":")),
    )
    .map((row) => ({ ...row, field: row.field.slice(scope.length) }));
  const members = new Set(
    rows
      .filter((row) => row.field === "audience.profile")
      .map((row) => row.person),
  );
  rows.push(
    ...store.rows.filter(
      (row) =>
        row.field === "identity" &&
        (row.person === viewer || members.has(row.person)),
    ),
  );
  const people = identities(rows);
  if (route === "profiles" && method === "POST") {
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (!name || name.length > 80 || /[\u0000-\u001f\u007f]/.test(name))
      return error(400, "Enter a name between 1 and 80 characters.");
    const visibility =
      body.audience === undefined
        ? audience(false)
        : readAudience(
            body.audience,
            people.map((p) => p.id),
          );
    if (!visibility) return error(400, "Choose a valid profile audience.");
    const id = "member-" + crypto.randomUUID();
    return {
      ...result({ id, name }, 201),
      changes: [
        setting(id, "identity", name),
        setting(id, scope + "audience.profile", visibility),
      ],
    };
  }
  const all = restore(rows, now, conference),
    me = all.find((p) => p.id === viewer);
  const demoViewers = [...people, { id: "guest", name: "Unregistered guest" }];
  if (!me)
    return viewer === "guest" && route === "state" && method === "GET"
      ? result({
          viewer,
          own: null,
          roomBoard: roomBoard(conference, [], [], viewer, now),
          directory: [],
          messages: [],
          identities: demoViewers,
        })
      : error(
          403,
          "Only registered attendees of this conference can access networking.",
        );
  const directory = all
    .filter((p) => permits(p.rules.profile, viewer))
    .map((p) => publicProfile(p, viewer, conference));
  if (method === "GET" && route === "state")
    return result({
      viewer,
      own: me,
      roomBoard: roomBoard(conference, rows, all, viewer, now),
      directory,
      identities: demoViewers,
      messages: store.messages.filter(
        (m) =>
          (m.conferenceId ?? defaultConference.id) === conference.id &&
          (m.sender === viewer || m.recipient === viewer),
      ),
    });
  if (method === "GET" && route === "rooms")
    return result({ conferenceId: conference.id, ...roomBoard(conference, rows, all, viewer, now) });
  if (method === "PATCH" && route === "rooms/report") {
    const { room, status } = body ?? {};
    if (!rooms.includes(room) || (status !== null && !isSeatReport(status)))
      return error(400, "Choose a room and a room status.");
    return { ...result({ room, status }), changes: [setting(viewer, scope + reportField(room), status === null ? null : { status, at: now })] };
  }
  if (method === "PATCH" && route === "rooms/demo-badge") {
    const room = body?.room;
    if (room !== null && (typeof room !== "string" || !hasDemoCounter(conference.id, room)))
      return error(400, "Choose a room with a demo counter.");
    return { ...result({ room }), changes: [setting(demoSensor, scope + badgeField, room)] };
  }
  if (method === "GET" && route === "attendees") {
    const paper = url.searchParams.get("paper"),
      session = url.searchParams.get("session"),
      room = url.searchParams.get("room");
    if (
      (paper && !papers.some((p) => p.id === paper)) ||
      (session && !sessions.some((s) => s.id === session)) ||
      (room && !rooms.includes(room))
    )
      return error(400, "Unknown paper, room or session.");
    return result({
      conferenceId: conference.id,
      attendees: directory.filter(
        (p) =>
          (!paper || p.lists.some((l) => l.paperIds.includes(paper))) &&
          (!session || p.shared.includes(session)) &&
          (!room || p.checkIn?.room === room),
      ),
    });
  }
  if (method === "GET" && route.startsWith("attendees/")) {
    const p = all.find((p) => p.id === route.slice(10));
    return p && (permits(p.rules.profile, viewer) || p.id === viewer)
      ? result({
          conferenceId: conference.id,
          profile: publicProfile(p, viewer, conference),
        })
      : error(404, "Profile unavailable.");
  }
  if (method === "PATCH" && route === "me/reminders") {
    const minutes = body?.minutesBefore;
    if (!validReminder(minutes)) return error(400, "Choose a reminder time.");
    return {
      ...result({ conferenceId: conference.id, minutesBefore: minutes }),
      changes: [setting(viewer, scope + "reminderMinutes", minutes)],
    };
  }
  if (method === "PATCH" && route === "me/sharing") {
    const { field, value } = body ?? {};
    let changes: Change[] = [];
    const save = (k: string, v: unknown) =>
      changes.push(setting(viewer, scope + k, v));
    if (typeof field !== "string")
      return error(400, "Choose a sharing setting.");
    if (
      field.startsWith("audience.") &&
      Object.hasOwn(me.rules, field.slice(9))
    ) {
      const a = readAudience(
        value,
        people.filter((p) => p.id !== viewer).map((p) => p.id),
      );
      if (!a) return error(400, "Choose a valid audience.");
      save(field, a);
    } else if (
      (field === "profile" || me.lists.some((l) => field === "list." + l.id)) &&
      typeof value === "boolean"
    )
      save("audience." + field, audience(value));
    else if (
      sessions.some((s) => field === "session." + s.id) &&
      typeof value?.going === "boolean" &&
      typeof value?.shared === "boolean" &&
      (!value.shared || value.going)
    ) {
      save("going." + field.slice(8), value.going);
      if (!value.shared || me.rules[field].mode === "private")
        save("audience." + field, audience(value.shared));
    } else if (
      // Ajout du prototype : liste de centres d'intérêt (10 au plus, 40 caractères chacun).
      field === "topics" &&
      Array.isArray(value) &&
      value.length <= 10 &&
      value.every((t: unknown) => typeof t === "string" && t.trim().length > 0 && t.trim().length <= 40)
    )
      save(field, [...new Set(value.map((t: string) => t.trim()))]);
    else if (
      field === "links" &&
      safeLink(value?.website) &&
      safeLink(value?.scholar, true)
    )
      save(field, { website: value.website, scholar: value.scholar });
    else if (
      field === "checkIn" &&
      (value === null ||
        (rooms.includes(value?.room) &&
          (value.countMe === undefined || typeof value.countMe === "boolean") &&
          // Fin choisie (profil de démo) : dans les 24 h à venir ; sinon 1 h.
          (value.until === undefined ||
            (typeof value.until === "number" && value.until > now && value.until <= now + 86400000))))
    )
      save(
        field,
        value
          ? { room: value.room, expiresAt: value.until ?? now + 3600000, ...(value.countMe === true ? { countMe: true } : {}) }
          : null,
      );
    else if (
      me.lists.some((l) => field === "papers." + l.id) &&
      Array.isArray(value) &&
      value.every((id) => papers.some((p) => p.id === id))
    )
      save(field, [...new Set(value)]);
    else return error(400, "Invalid sharing preference or link.");
    return {
      ...result({
        conferenceId: conference.id,
        field,
        value: field === "checkIn" ? JSON.parse(changes[0].value) : value,
      }),
      changes,
    };
  }
  if (method === "POST" && route === "messages") {
    const { recipient, body: text } = body ?? {};
    if (!permits(me.rules.profile, recipient))
      return error(
        403,
        "Share your profile with the recipient to send a message.",
      );
    if (recipient === viewer || !directory.some((p) => p.id === recipient))
      return error(404, "Recipient unavailable.");
    if (typeof text !== "string" || !text.trim() || text.trim().length > 1000)
      return error(400, "Write a message of 1–1,000 characters.");
    return {
      ...result({}, 201),
      message: {
        sender: viewer,
        recipient,
        body: text.trim(),
        sent: new Date(now).toISOString(),
      },
    };
  }
  return error(404, "Unknown demo endpoint.");
}
