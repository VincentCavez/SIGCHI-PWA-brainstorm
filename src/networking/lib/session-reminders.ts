import type { DemoConference } from "./conferences";
import type { DemoPerson } from "./network-model";

export type ProgramSession = DemoConference["sessions"][number];
export const reminderMinutes = [5, 10, 15, 30] as const;
export function validReminder(value: unknown) {
  return value === 0 || reminderMinutes.some((minutes) => value === minutes);
}

export function savedSessions(
  sessions: ProgramSession[],
  me: Pick<DemoPerson, "going" | "lists">,
) {
  const planned = new Set(me.going);
  const papers = new Set(me.lists.flatMap((list) => list.paperIds));
  return sessions
    .filter((s) => planned.has(s.id) || s.papers.some((id) => papers.has(id)))
    .sort((a, b) => a.startsAt - b.startsAt);
}

export function reminderWindow(
  sessions: ProgramSession[],
  minutes: number,
  now: number,
) {
  const due: ProgramSession[] = [];
  let next = Infinity;
  if (minutes > 0) {
    for (const session of sessions) {
      if (session.startsAt <= now) continue;
      const alertAt = session.startsAt - minutes * 60_000;
      if (alertAt <= now) due.push(session);
      next = Math.min(next, alertAt > now ? alertAt : session.startsAt);
    }
  }
  return { due, next };
}
