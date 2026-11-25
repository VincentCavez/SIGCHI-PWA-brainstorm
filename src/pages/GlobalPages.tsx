// Pages globales du PWA (hors conférence) : All Conferences (/), My Lists (/my-lists),
// Send Feedback (/send-feedback), About service (/about-service).
import { useEffect, useMemo, useState } from "react";
import { ArrowDown, CalendarDays, ChevronDown, Copy, ExternalLink, Inbox, MapPin, Search } from "lucide-react";
import { fetchProgram, fetchProgramList, type Program } from "../api/program";
import type { Id, MyList, ProgramListEntry } from "../api/types";
import { EmptyState, GlobalHeader, LoginWall } from "../components/PageHeader";
import { TypeChip } from "../components/Cards";
import type { Cloud } from "../hooks";

type Menu = { onOpenMenu: () => void };

function useProgramList() {
  const [list, setList] = useState<ProgramListEntry[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    fetchProgramList()
      .then(setList)
      .catch((e) => setError(String(e)));
  }, []);
  return { list, error };
}

const fmtDate = (ts: number) =>
  new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(ts);

// ---------- All Conferences ----------
export function AllConferencesPage({
  onOpenMenu,
  currentId,
  onSelect,
}: Menu & { currentId: Id; onSelect: (shortName: string, year: number) => void }) {
  const { list, error } = useProgramList();
  const [q, setQ] = useState("");
  const [short, setShort] = useState("");
  const [general, setGeneral] = useState(false);
  const entries = useMemo(
    () =>
      (list ?? [])
        .filter((e) => e.publicationInfo.isProgramEnabled !== false)
        .sort((a, b) => b.conference.startDate - a.conference.startDate),
    [list],
  );
  const shortNames = useMemo(() => [...new Set(entries.map((e) => e.conference.shortName))].sort(), [entries]);
  const visible = entries.filter(
    (e) =>
      (!short || e.conference.shortName === short) &&
      (!q || `${e.conference.name} ${e.conference.fullName}`.toLowerCase().includes(q.toLowerCase())),
  );
  const years = [...new Set(visible.map((e) => e.conference.year))].sort((a, b) => b - a);

  return (
    <main className="main">
      <GlobalHeader title="All Conferences" onOpenMenu={onOpenMenu} />
      <div className="page-body">
        <section className="general-data">
          <button className="general-toggle" aria-expanded={general} onClick={() => setGeneral(!general)}>
            <ChevronDown size={18} className={general ? "flip" : ""} /> General data
          </button>
          {general && (
            <p className="muted general-text">
              {entries.length} conference programs are published on SIGCHI Programs. Each program is public;
              open a conference to browse it here.
            </p>
          )}
        </section>
        <div className="conf-filters">
          <label className="search conf-search">
            <Search size={18} className="muted" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search conference by name" aria-label="Search conference by name" />
          </label>
          <select className="conf-select" value={short} onChange={(e) => setShort(e.target.value)} aria-label="Conference short name">
            <option value="">Conference short name</option>
            {shortNames.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        {error && <p className="notice error">{error}</p>}
        {!list && !error && <p className="empty">Loading…</p>}
        {years.map((y) => (
          <section key={y}>
            <h2 className="year-label">{y}</h2>
            <div className="cards">
              {visible
                .filter((e) => e.conference.year === y)
                .map(({ conference: c }) => (
                  <article
                    key={c.id}
                    className={`conf-card${c.id === currentId ? " current" : ""}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelect(c.shortName, c.year)}
                    onKeyDown={(e) => e.key === "Enter" && onSelect(c.shortName, c.year)}
                  >
                    <img src={c.logoUrl || `${import.meta.env.BASE_URL}conference.png`} alt="" />
                    <div className="conf-card-body">
                      <h3>
                        {c.name} : {c.fullName}
                      </h3>
                      <span>
                        <CalendarDays size={14} /> {fmtDate(c.startDate)} - {fmtDate(c.endDate)}
                      </span>
                      {c.location && (
                        <span>
                          <MapPin size={14} /> {c.location}
                        </span>
                      )}
                    </div>
                    {c.url && (
                      <a className="conf-url" href={c.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                        {c.url.replace(/^https?:\/\//, "").slice(0, 22)}
                        {c.url.replace(/^https?:\/\//, "").length > 22 ? "…" : ""} <ExternalLink size={14} />
                      </a>
                    )}
                  </article>
                ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}

// ---------- My Lists (global) : listes réelles de l'utilisateur toutes conférences ----------
const programCache = new Map<Id, Promise<Program>>();
function programById(list: ProgramListEntry[], id: Id): Promise<Program> | undefined {
  const entry = list.find((e) => e.conference.id === id);
  if (!entry) return undefined;
  if (!programCache.has(id)) programCache.set(id, fetchProgram(entry.conference.shortName, entry.conference.year));
  return programCache.get(id);
}

export function GlobalListsPage({ onOpenMenu, cloud }: Menu & { cloud: Cloud }) {
  const [tab, setTab] = useState<"all" | "subscribed">("all");
  const [open, setOpen] = useState<string | null>(null);
  return (
    <main className="main">
      <GlobalHeader title="My Lists" onOpenMenu={onOpenMenu}>
        <div className="tabs-row">
          <nav className="tabs" aria-label="Lists">
            <button className={tab === "all" ? "active" : ""} onClick={() => setTab("all")}>
              All Lists
            </button>
            <button className={tab === "subscribed" ? "active" : ""} onClick={() => setTab("subscribed")}>
              Subscribed Lists
            </button>
          </nav>
        </div>
      </GlobalHeader>
      <div className="page-body">
        {!cloud.token ? (
          <LoginWall />
        ) : tab === "subscribed" ? (
          <EmptyState
            icon={<Inbox size={48} />}
            title="No items to display"
            text="Subscribed lists are not available in this prototype."
          />
        ) : cloud.loading ? (
          <p className="empty">Loading…</p>
        ) : cloud.error ? (
          <p className="notice error">Could not load your data: {cloud.error}</p>
        ) : cloud.lists.length === 0 ? (
          <EmptyState icon={<Inbox size={48} />} title="No items to display" />
        ) : (
          <div className="cards">
            {cloud.lists.map((l) => (
              <ListCard key={l.id} list={l} open={open === l.id} onToggle={() => setOpen(open === l.id ? null : l.id)} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function ListCard({ list, open, onToggle }: { list: MyList; open: boolean; onToggle: () => void }) {
  return (
    <article className="list-card">
      <button className="list-card-head" aria-expanded={open} onClick={onToggle}>
        <h3>{list.name}</h3>
        <small>{list.myListItems.length} content item(s)</small>
      </button>
      {open && <ListItems list={list} />}
    </article>
  );
}

type Resolved = { key: string; added: number; start?: number; title: string; program?: Program; contentId: Id; conferenceId: Id };

function ListItems({ list }: { list: MyList }) {
  const { list: programs, error } = useProgramList();
  const [sort, setSort] = useState<"added" | "time" | "title">("added");
  const [loaded, setLoaded] = useState<Map<Id, Program>>(new Map());
  const [failed, setFailed] = useState<Id[]>([]);
  const confIds = useMemo(() => [...new Set(list.myListItems.map((i) => i.conferenceId))], [list]);

  useEffect(() => {
    if (!programs) return;
    let live = true;
    for (const id of confIds) {
      const pr = programById(programs, id);
      if (!pr) {
        setFailed((f) => [...f, id]);
        continue;
      }
      pr.then((p) => live && setLoaded((m) => new Map(m).set(id, p))).catch(() => live && setFailed((f) => [...f, id]));
    }
    return () => {
      live = false;
    };
  }, [programs, confIds]);

  const items: Resolved[] = list.myListItems.map((i) => {
    const p = loaded.get(i.conferenceId);
    const c = p?.contents.get(i.contentId);
    return {
      key: `${i.conferenceId}-${i.contentId}`,
      added: i.actionDate,
      start: c && p ? p.contentItem(c)?.start : undefined,
      title: c?.title ?? "",
      program: p,
      contentId: i.contentId,
      conferenceId: i.conferenceId,
    };
  });
  items.sort((a, b) =>
    sort === "added" ? b.added - a.added : sort === "time" ? (a.start ?? Infinity) - (b.start ?? Infinity) : a.title.localeCompare(b.title),
  );
  const pending = confIds.filter((id) => !loaded.has(id) && !failed.includes(id)).length;

  return (
    <div className="list-items">
      <div className="sort-row">
        <span>Sort by:</span>
        <button className={sort === "added" ? "active" : ""} onClick={() => setSort("added")}>
          Date added {sort === "added" && <ArrowDown size={12} />}
        </button>
        <button className={sort === "time" ? "active" : ""} onClick={() => setSort("time")}>
          Time
        </button>
        <button className={sort === "title" ? "active" : ""} onClick={() => setSort("title")}>
          Title
        </button>
      </div>
      {error && <p className="notice error">{error}</p>}
      {pending > 0 && <p className="muted">Loading {pending} conference program(s)…</p>}
      {items.map((it) => {
        const p = it.program;
        const c = p?.contents.get(it.contentId);
        if (!p || !c)
          return p || failed.includes(it.conferenceId) ? (
            <article key={it.key} className="content-card list-item">
              <div className="content-data">
                <span className="muted">Content #{it.contentId} (conference #{it.conferenceId}) is not in the public program.</span>
              </div>
            </article>
          ) : null;
        const item = p.contentItem(c);
        const color = p.contentTypes.get(c.typeId)?.color;
        return (
          <article key={it.key} className="content-card list-item">
            <span className="type-stripe" style={{ background: color }} />
            <div className="content-data">
              <div className="card-info">
                <TypeChip p={p} typeId={c.typeId} />
                <span className="conf-badge">{p.conference.name}</span>
              </div>
              <h4 className="card-title">{c.title}</h4>
              {item?.start != null && item.end != null && (
                <div className="card-date">
                  <CalendarDays size={14} />
                  {p.formatDay(p.dayKey(item.start))} | {p.formatRange(item.start, item.end)}
                </div>
              )}
              <div className="card-people">{c.authors.map((a) => p.personName(a.personId)).join(", ")}</div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

// ---------- Send Feedback ----------
const FEEDBACK_EMAIL = "sigchi-appfeedback@acm.org";
export function FeedbackPage({ onOpenMenu }: Menu) {
  const [copied, setCopied] = useState(false);
  return (
    <main className="main">
      <GlobalHeader title="Send App Feedback" onOpenMenu={onOpenMenu} />
      <div className="page-body feedback">
        <h2>Send App Feedback</h2>
        <p>Questions or ideas for the SIGCHI Programs app? Write to the SIGCHI development team.</p>
        <p className="muted">
          The team handles the app itself: access, technical problems and bugs. For questions about a conference program
          (sessions, schedules, data errors), contact that conference's chairs, listed on its website.
        </p>
        <div className="feedback-email">
          <span>{FEEDBACK_EMAIL}</span>
          <button
            onClick={() => {
              navigator.clipboard?.writeText(FEEDBACK_EMAIL).then(() => setCopied(true));
            }}
          >
            <Copy size={14} /> {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <a className="btn-primary" href={`mailto:${FEEDBACK_EMAIL}`}>
          Email us
        </a>
      </div>
    </main>
  );
}

// ---------- About service ----------
const ABOUT_TABS = [
  {
    id: "about",
    label: "About Service",
    path: "about-service",
    text: "SIGCHI Programs is the official program app of SIGCHI conferences. Attendees browse the program and build a personal schedule, lists and notes; speakers check their slots and rooms; organizers publish updates to everyone at once. It is a Progressive Web App that can be installed from the browser and works offline once a program is loaded. Program data comes from QOALA and papers link to the ACM Digital Library.",
  },
  { id: "release", label: "Release Notes", path: "about-service/release-notes", text: "History of the app's versions and changes." },
  { id: "terms", label: "Terms Of Use", path: "about-service/terms-of-use", text: "Conditions for using SIGCHI Programs." },
  { id: "privacy", label: "Privacy Policy", path: "about-service/privacy-policy", text: "How SIGCHI Programs collects and uses personal data." },
];
export function AboutPage({ onOpenMenu }: Menu) {
  const [tab, setTab] = useState(ABOUT_TABS[0].id);
  const t = ABOUT_TABS.find((x) => x.id === tab)!;
  return (
    <main className="main">
      <GlobalHeader title="About Service" onOpenMenu={onOpenMenu}>
        <div className="pill-group about-tabs">
          {ABOUT_TABS.map((x) => (
            <button key={x.id} className={`pill${x.id === tab ? " active-soft" : ""}`} onClick={() => setTab(x.id)}>
              {x.label}
            </button>
          ))}
        </div>
      </GlobalHeader>
      <div className="page-body about">
        <h2>{t.label === "About Service" ? "About SIGCHI Programs" : t.label}</h2>
        <p>{t.text}</p>
        <p>
          <a href={`https://programs.sigchi.org/${t.path}`} target="_blank" rel="noreferrer">
            Read the full text on programs.sigchi.org <ExternalLink size={13} />
          </a>
        </p>
      </div>
    </main>
  );
}
