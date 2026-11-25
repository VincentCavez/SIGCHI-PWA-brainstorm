// Pages My Schedule et My Notes du PWA (réservées aux utilisateurs connectés).
import { useMemo, useState } from "react";
import { Inbox } from "lucide-react";
import type { Program } from "../api/program";
import type { Content } from "../api/types";
import { EmptyState, LoginWall, PageHeader, shortTitle } from "../components/PageHeader";
import { ContentCard, SessionCard } from "../components/Cards";
import { useLocalSchedule, type Cloud } from "../hooks";
import { useNav } from "../nav";
import { useNotes } from "../notes";

type Props = { p: Program; cloud: Cloud; onOpenMenu: () => void };

// ---------- My Schedule (/my-schedule/{jour}) ----------
// Sessions du « My Schedule » SIGCHI + ajouts locaux.
export function MySchedulePage({ p, cloud, onOpenMenu }: Props) {
  const nav = useNav();
  const local = useLocalSchedule(p.conference.id);
  const inSchedule = (id: number) => local.ids.has(id) || cloud.addedBySession.has(id);
  const days = useMemo(() => p.days(), [p]);
  const perDay = useMemo(
    () =>
      new Map(
        days.map((d) => [
          d,
          p
            .scheduleForDay(d)
            .map((g) => ({ ...g, items: g.items.filter((i) => inSchedule(i.id)) }))
            .filter((g) => g.items.length),
        ]),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [p, days, local.ids, cloud.addedBySession],
  );
  const firstWithItems = days.find((d) => perDay.get(d)!.length) ?? days[0];
  const [day, setDay] = useState<string | undefined>(undefined);
  const current = day ?? firstWithItems;
  const count = (d: string) => perDay.get(d)!.reduce((n, g) => n + g.items.length, 0);

  return (
    <main className="main">
      <PageHeader p={p} title={`${shortTitle(p)} My Schedule`} onOpenMenu={onOpenMenu} onSearch={(q) => nav.go("program", { query: q })}>
        {cloud.token && (
          <div className="tabs-row">
            <nav className="tabs" aria-label="Days">
              {days.map((d) => (
                <button key={d} className={d === current ? "active" : ""} onClick={() => setDay(d)}>
                  {p.formatDay(d)} <span className="tab-count">({count(d)})</span>
                </button>
              ))}
            </nav>
          </div>
        )}
      </PageHeader>
      <div className="page-body">
        {!cloud.token ? (
          <LoginWall />
        ) : (
          <>
            {cloud.error && <p className="notice error">Could not load your data: {cloud.error}</p>}
            {current && perDay.get(current)!.length === 0 ? (
              <EmptyState icon={<Inbox size={48} />} title="No items to display" text="Add sessions to your schedule to see them here." />
            ) : (
              current &&
              perDay.get(current)!.map(({ start, end, items }) => (
                <div className="timeslot" key={`${start}-${end}`}>
                  <h3 className="timeslot-time">{p.formatRange(start, end)}</h3>
                  <div className="cards">
                    {items.map((s) => (
                      <SessionCard
                        key={`${s.kind}-${s.id}`}
                        p={p}
                        s={s}
                        added={cloud.addedBySession.get(s.id) ?? 0}
                        inSchedule
                        onToggleSchedule={() => local.toggle(s.id)}
                      />
                    ))}
                  </div>
                </div>
              ))
            )}
          </>
        )}
      </div>
    </main>
  );
}

// ---------- My Notes (/my-notes) ----------
export function MyNotesPage({ p, cloud, onOpenMenu }: Props) {
  const nav = useNav();
  const { notes } = useNotes();
  const items = Object.values(notes)
    .filter((n) => n.conferenceId === p.conference.id)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map((n) => p.contents.get(n.contentId))
    .filter((c): c is Content => !!c);
  return (
    <main className="main">
      <PageHeader p={p} title={`${shortTitle(p)} My Notes`} onOpenMenu={onOpenMenu} onSearch={(q) => nav.go("program", { query: q })} />
      <div className="page-body">
        {!cloud.token ? (
          <LoginWall />
        ) : items.length === 0 ? (
          <EmptyState icon={<Inbox size={48} />} title="No items to display" text="Add notes to contents to see them here." />
        ) : (
          <section className="cards notes-list">
            {items.map((c) => (
              <ContentCard key={c.id} p={p} c={c} />
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
