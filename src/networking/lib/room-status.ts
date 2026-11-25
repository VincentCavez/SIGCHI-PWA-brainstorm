import type { DemoConference } from "./conferences";
import type { DemoPerson, Preference } from "./network-model";

export const roomStatuses = {
  open: "Space available",
  limited: "Almost full",
  full: "Full",
  unknown: "No update",
} as const;
export type SeatReport = "open" | "limited" | "full";
export const reportLifetime = 15 * 60_000;
export const reportField = (room: string) =>
  "roomReport." + encodeURIComponent(room);
export const demoSensor = "@room-counter";
export const badgeField = "demoBadge";
type Sample = { seats: number; badges: number };
const sampleCounts: Record<string, Record<string, Sample>> = {
  "chi26-demo": {
    "P1 - Room 115": { seats: 40, badges: 39 },
    "P1 - Room 116": { seats: 60, badges: 60 },
    "P1 - Room 120": { seats: 80, badges: 33 },
  },
  "chi25-demo": {
    G401: { seats: 50, badges: 49 },
    "G314+G315": { seats: 80, badges: 80 },
    "Annex Hall F203": { seats: 60, badges: 19 },
  },
};
export function hasDemoCounter(eventId: string, room: string) {
  return Object.hasOwn(sampleCounts[eventId] || {}, room);
}
export function isSeatReport(value: unknown): value is SeatReport {
  return value === "open" || value === "limited" || value === "full";
}
type Report = { status: SeatReport; at: number };
export type RoomSummary = {
  room: string;
  status: keyof typeof roomStatuses;
  source: "report" | "counter" | "checkIns" | null;
  capacity: number | null;
  counted: number | null;
  checkIns: number;
  reports: number;
  reportedAt: number | null;
  myReport: SeatReport | null;
};
export type RoomBoard = {
  rooms: RoomSummary[];
  badgeRoom: string | null;
  refreshAt: number | null;
};
export function roomBoard(
  event: DemoConference,
  rows: Preference[],
  people: DemoPerson[],
  viewer: string,
  now: number,
): RoomBoard {
  const sample = sampleCounts[event.id] || {};
  const storedBadge = rows.find(
    (row) => row.person === demoSensor && row.field === badgeField,
  );
  const badgeRoom: string | null = storedBadge
    ? JSON.parse(storedBadge.value)
    : null;
  let refresh = Infinity;
  const volunteers = new Map<string, number>();
  for (const { checkIn } of people) {
    if (checkIn?.countMe && checkIn.expiresAt > now) {
      volunteers.set(checkIn.room, (volunteers.get(checkIn.room) || 0) + 1);
      refresh = Math.min(refresh, checkIn.expiresAt);
    }
  }
  const rooms = event.rooms.map((room): RoomSummary => {
    const field = reportField(room);
    const reports: { person: string; report: Report }[] = [];
    for (const row of rows) {
      if (row.field !== field) continue;
      const report: Report | null = JSON.parse(row.value);
      if (
        !report ||
        !isSeatReport(report.status) ||
        report.at > now ||
        report.at + reportLifetime <= now
      )
        continue;
      reports.push({ person: row.person, report });
      refresh = Math.min(refresh, report.at + reportLifetime);
    }
    // At the same instant, prefer the more crowded report.
    const rank = { open: 0, limited: 1, full: 2 };
    reports.sort(
      (a, b) =>
        b.report.at - a.report.at ||
        rank[b.report.status] - rank[a.report.status],
    );
    const latest = reports[0]?.report;
    const capacity = sample[room]?.seats ?? null;
    const counted =
      capacity === null
        ? null
        : sample[room].badges + Number(badgeRoom === room);
    const checkIns = volunteers.get(room) || 0;
    let status: RoomSummary["status"] = "unknown";
    let source: RoomSummary["source"] = null;
    if (capacity !== null && counted !== null) {
      status =
        counted >= capacity
          ? "full"
          : counted >= capacity * 0.9
            ? "limited"
            : "open";
      source = "counter";
    }
    if (latest) {
      status = latest.status;
      source = "report";
    }
    if (capacity !== null && checkIns >= capacity) {
      status = "full";
      source = "checkIns";
    }
    return {
      room,
      status,
      source,
      capacity,
      counted,
      checkIns,
      reports: reports.length,
      reportedAt: latest?.at ?? null,
      myReport: reports.find((r) => r.person === viewer)?.report.status ?? null,
    };
  });
  return {
    rooms,
    badgeRoom,
    refreshAt: Number.isFinite(refresh) ? refresh : null,
  };
}
