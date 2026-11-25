import { useDeferredValue, useMemo, useState } from "react";
import { ArrowRight, ArrowUp, Check, Filter, Globe, LayoutGrid, List, Menu, Search, X } from "lucide-react";
import type { Program, ScheduleItem } from "../api/program";
import type { Content } from "../api/types";
import type { Cloud } from "../hooks";
import { useLocalSchedule } from "../hooks";
import { ContentCard, SessionCard } from "./Cards";

type Tab = "index" | "other" | string; // string = clé de jour YYYY-MM-DD
type Mode = "session" | "content";
type Sort = "time" | "title";

export function ProgramPage({
  p,
  cloud,
  onOpenMenu,
  initialQuery,
}: {
  p: Program;
  cloud: Cloud;
  onOpenMenu: () => void;
  initialQuery?: string;
}) {
  const days = useMemo(() => p.days(), [p]);
  const [tab, setTab] = useState<Tab>("index");
  const [mode, setMode] = useState<Mode>("session");
  const [layout, setLayout] = useState<"list" | "gallery">("list");
  const [sort, setSort] = useState<Sort>("time");
  const [query, setQuery] = useState(initialQuery ?? "");
  const q = useDeferredValue(query.trim().toLowerCase());
  const local = useLocalSchedule(p.conference.id);

  const conf = p.conference;
  const shortTitle = `${conf.shortName} '${String(conf.year).slice(2)}`;
  const offset = p.utcOffsetLabel();
  const localOffset = -new Date(conf.startDate).getTimezoneOffset();
  const sameTz = localOffset === conf.timeZoneOffset;

  const contentMatches = (c: Content) =>
    !q ||
    c.title.toLowerCase().includes(q) ||
    (c.abstract ?? "").toLowerCase().includes(q) ||
    c.keywords.some((k) => k.toLowerCase().includes(q)) ||
    c.authors.some((a) => p.personName(a.personId).toLowerCase().includes(q));

  const itemMatches = (s: ScheduleItem) =>
    !q ||
    s.name.toLowerCase().includes(q) ||
    s.peopleIds.some((id) => p.personName(id).toLowerCase().includes(q)) ||
    p.itemContents(s).some(contentMatches);

  const visibleDays = tab === "index" ? days : days.includes(tab) ? [tab] : [];

  const sections = useMemo(() => {
    return visibleDays.map((day) => ({
      day,
      slots: p
        .scheduleForDay(day)
        .map((g) => {
          const items = g.items.filter(itemMatches);
          if (sort === "title") items.sort((a, b) => a.name.localeCompare(b.name));
          return { ...g, items };
        })
        .filter((g) => g.items.length),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p, tab, q, sort]);

  const contents = useMemo(() => {
    if (mode !== "content") return [];
    const inScope = (c: Content) => {
      if (tab === "index") return true;
      const start = p.contentItem(c)?.start;
      if (tab === "other") return start == null;
      return start != null && p.dayKey(start) === tab;
    };
    const list = [...p.contents.values()].filter((c) => !c.isBreak && inScope(c) && contentMatches(c));
    if (sort === "title") list.sort((a, b) => a.title.localeCompare(b.title));
    return list.slice(0, 300);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p, mode, tab, q, sort]);

  const other = tab === "other" ? p.unscheduledItems().filter(itemMatches) : [];

  const renderSession = (s: ScheduleItem) => (
    <SessionCard
      key={`${s.kind}-${s.id}`}
      p={p}
      s={s}
      added={cloud.addedBySession.get(s.id) ?? 0}
      inSchedule={local.ids.has(s.id) || cloud.addedBySession.has(s.id)}
      onToggleSchedule={() => local.toggle(s.id)}
    />
  );

  return (
    <main className="main">
      <div className="mobile-header">
        <button className="icon-btn light" aria-label="Open menu" onClick={onOpenMenu}>
          <Menu size={22} />
        </button>
        <h1>{shortTitle} Program</h1>
      </div>

      <header className="page-header">
        <div className="page-title-row">
          <img className="conf-logo" src={conf.logoUrl || `${import.meta.env.BASE_URL}conference.png`} alt="" />
          <div className="page-title">
            <small>
              {sameTz
                ? `Conference time zone is same with local time zone (${offset})`
                : `Conference time zone (${offset})`}
            </small>
            <h1>{shortTitle} Program</h1>
          </div>
          <a className="contacts-link" href={conf.url} target="_blank" rel="noreferrer">
            <Globe size={16} /> Contacts and links
          </a>
        </div>

        <form className="search" onSubmit={(e) => e.preventDefault()} role="search">
          <Search size={18} className="muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search sessions, contents, people, notes"
            aria-label="Search sessions, contents, people, notes"
          />
          {query && (
            <button type="button" className="icon-btn" aria-label="Clear search" onClick={() => setQuery("")}>
              <X size={18} />
            </button>
          )}
          <button type="submit" className="icon-btn" aria-label="Search">
            <ArrowRight size={20} />
          </button>
        </form>

        <div className="tabs-row">
          <nav className="tabs" aria-label="Program days">
            <button className={tab === "index" ? "active" : ""} onClick={() => setTab("index")}>
              Index
            </button>
            {days.map((d) => (
              <button key={d} className={tab === d ? "active" : ""} onClick={() => setTab(d)}>
                {p.formatDay(d)}
              </button>
            ))}
            <button className={tab === "other" ? "active" : ""} onClick={() => setTab("other")}>
              Other
            </button>
          </nav>
          <button className="filters-btn" disabled title="Not in this prototype">
            <Filter size={16} /> Filters
          </button>
        </div>
      </header>

      <div className="subbar">
        <div className="pill-group">
          <button className={`pill${mode === "session" ? " active" : ""}`} onClick={() => setMode("session")}>
            {mode === "session" && <Check size={14} />} Session
          </button>
          <button className={`pill${mode === "content" ? " active" : ""}`} onClick={() => setMode("content")}>
            {mode === "content" && <Check size={14} />} Content
          </button>
        </div>
        <div className="pill-group">
          <button className={`pill${layout === "list" ? " active" : ""}`} onClick={() => setLayout("list")}>
            <List size={15} /> List
          </button>
          <button className={`pill${layout === "gallery" ? " active" : ""}`} onClick={() => setLayout("gallery")}>
            <LayoutGrid size={15} /> Gallery
          </button>
        </div>
      </div>

      <div className={`page-body ${layout}`}>
        {cloud.error && <p className="notice error">Could not load your data: {cloud.error}</p>}

        <div className="sort-row">
          <span>Sort by:</span>
          <button className={sort === "time" ? "active" : ""} onClick={() => setSort("time")}>
            Time <ArrowUp size={12} />
          </button>
          <button className={sort === "title" ? "active" : ""} onClick={() => setSort("title")}>
            Title
          </button>
        </div>

        {mode === "content" ? (
          <section className="cards">
            {contents.length === 0 && <p className="empty">No results</p>}
            {contents.map((c) => (
              <ContentCard key={c.id} p={p} c={c} />
            ))}
            {contents.length === 300 && <p className="empty">Showing the first 300 results. Refine your search.</p>}
          </section>
        ) : tab === "other" ? (
          <section className="cards">
            {other.length === 0 && <p className="empty">No results</p>}
            {other.map(renderSession)}
          </section>
        ) : (
          <>
            {sections.every((s) => !s.slots.length) && <p className="empty">No results</p>}
            {sections.map(({ day, slots }) =>
              slots.length ? (
                <section key={day} className="day">
                  <h2 className="day-label">{p.formatDayLong(day)}</h2>
                  {slots.map(({ start, end, items }) => (
                    <div className="timeslot" key={`${start}-${end}`}>
                      <h3 className="timeslot-time">{p.formatRange(start, end)}</h3>
                      <div className="cards">{items.map(renderSession)}</div>
                    </div>
                  ))}
                </section>
              ) : null,
            )}
          </>
        )}
      </div>
    </main>
  );
}
