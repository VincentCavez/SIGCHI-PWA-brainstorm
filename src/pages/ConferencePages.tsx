// Pages Awards, Maps, Accessibility et Recommendations du PWA, reconstruites depuis le JSON public.
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Inbox, Minus, Plus, RotateCcw } from "lucide-react";
import type { Program } from "../api/program";
import type { Floor } from "../api/types";
import { EmptyState, PageHeader, shortTitle } from "../components/PageHeader";
import { ContentCard } from "../components/Cards";
import { useNav } from "../nav";

type Props = { p: Program; onOpenMenu: () => void };

// ---------- Awards (/awards/best-papers, /awards/honorable-mentions) ----------
export function AwardsPage({ p, onOpenMenu }: Props) {
  const nav = useNav();
  const [tab, setTab] = useState<"BEST_PAPER" | "HONORABLE_MENTION">("BEST_PAPER");
  const byAward = useMemo(() => {
    const all = [...p.contents.values()].filter((c) => c.award);
    const sort = (a: { title: string }, b: { title: string }) => a.title.localeCompare(b.title);
    return {
      BEST_PAPER: all.filter((c) => c.award === "BEST_PAPER").sort(sort),
      HONORABLE_MENTION: all.filter((c) => c.award === "HONORABLE_MENTION").sort(sort),
    };
  }, [p]);
  const list = byAward[tab];
  return (
    <main className="main">
      <PageHeader p={p} title={`${shortTitle(p)} Awards`} onOpenMenu={onOpenMenu} onSearch={(q) => nav.go("program", { query: q })}>
        <div className="tabs-row">
          <nav className="tabs" aria-label="Awards">
            <button className={tab === "BEST_PAPER" ? "active" : ""} onClick={() => setTab("BEST_PAPER")}>
              Best Papers <span className="tab-count">({byAward.BEST_PAPER.length})</span>
            </button>
            <button className={tab === "HONORABLE_MENTION" ? "active" : ""} onClick={() => setTab("HONORABLE_MENTION")}>
              Honorable Mentions <span className="tab-count">({byAward.HONORABLE_MENTION.length})</span>
            </button>
          </nav>
        </div>
      </PageHeader>
      <div className="page-body">
        {list.length === 0 ? (
          <EmptyState icon={<Inbox size={48} />} title="No items to display" />
        ) : (
          <section className="cards awards-list">
            {list.map((c) => (
              <div key={c.id}>
                <span className="award-label">{tab === "BEST_PAPER" ? "BEST PAPER" : "HONORABLE MENTION"}</span>
                <ContentCard p={p} c={c} />
              </div>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}

// ---------- Maps (/maps, /maps/{floorId}) ----------
export function MapsPage({ p, onOpenMenu }: Props) {
  const nav = useNav();
  const floors = [...p.floors.values()].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  const floor = nav.params.floorId != null ? p.floors.get(nav.params.floorId) : undefined;
  if (floor) return <FloorMap p={p} floor={floor} onOpenMenu={onOpenMenu} />;
  return (
    <main className="main">
      <PageHeader p={p} title={`${shortTitle(p)} Maps`} onOpenMenu={onOpenMenu} onSearch={(q) => nav.go("program", { query: q })} />
      <div className="page-body">
        {floors.length === 0 && <EmptyState icon={<Inbox size={48} />} title="No items to display" />}
        {floors.map((f) => (
          <section key={f.id} className="floor-card">
            <h2>
              <a
                href={`#floor-${f.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  nav.go("maps", { floorId: f.id });
                }}
              >
                {f.name}
              </a>
            </h2>
            <ul className="floor-rooms">
              {f.roomIds
                .map((id) => p.rooms.get(id))
                .filter((r) => !!r)
                .sort((a, b) => a!.name.localeCompare(b!.name, undefined, { numeric: true }))
                .map((r) => (
                  <li key={r!.id}>{r!.name}</li>
                ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}

function FloorMap({ p, floor, onOpenMenu }: { p: Program; floor: Floor; onOpenMenu: () => void }) {
  const nav = useNav();
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number } | null>(null);
  const reset = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };
  return (
    <main className="main map-page">
      <PageHeader p={p} title={floor.name} small={`${shortTitle(p)} Maps`} onOpenMenu={onOpenMenu} />
      <div className="map-view">
        <button className="back-link map-back" onClick={() => nav.go("maps")}>
          <ArrowLeft size={16} /> Maps
        </button>
        {floor.mapImageUrl ? (
          <div
            className="map-stage"
            onWheel={(e) => setZoom((z) => Math.min(6, Math.max(1, z * (e.deltaY < 0 ? 1.15 : 1 / 1.15))))}
            onPointerDown={(e) => {
              drag.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
              (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
            }}
            onPointerMove={(e) => drag.current && setOffset({ x: e.clientX - drag.current.x, y: e.clientY - drag.current.y })}
            onPointerUp={() => (drag.current = null)}
          >
            <img
              src={floor.mapImageUrl}
              alt={`Map of ${floor.name}`}
              draggable={false}
              style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})` }}
            />
          </div>
        ) : (
          <EmptyState icon={<Inbox size={48} />} title="No map for this floor" />
        )}
        <div className="map-controls">
          <button aria-label="Zoom in" onClick={() => setZoom((z) => Math.min(6, z * 1.3))}>
            <Plus size={16} />
          </button>
          <button aria-label="Zoom out" onClick={() => setZoom((z) => Math.max(1, z / 1.3))}>
            <Minus size={16} />
          </button>
          <button aria-label="Reset" onClick={reset}>
            <RotateCcw size={16} />
          </button>
        </div>
      </div>
    </main>
  );
}

// ---------- Accessibility (/access) : FAQ HTML publiée par la conférence ----------
/** Nettoie le HTML de la FAQ (fichier public SIGCHI) avant de l'insérer. */
function sanitize(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("script,style,iframe,object,embed,link,meta,form").forEach((el) => el.remove());
  doc.querySelectorAll("*").forEach((el) => {
    for (const attr of [...el.attributes]) {
      const name = attr.name.toLowerCase();
      if (name.startsWith("on") || name === "style") el.removeAttribute(attr.name);
      if ((name === "href" || name === "src") && /^\s*javascript:/i.test(attr.value)) el.removeAttribute(attr.name);
    }
    if (el.tagName === "A" && !el.getAttribute("href")?.startsWith("#")) {
      el.setAttribute("target", "_blank");
      el.setAttribute("rel", "noreferrer");
    }
  });
  return doc.body.innerHTML;
}

export function AccessibilityPage({ p, onOpenMenu }: Props) {
  const nav = useNav();
  const url = p.conference.accessibilityFaqUrl;
  const [state, setState] = useState<{ html?: string; error?: string }>({});
  useEffect(() => {
    if (!url) return;
    let live = true;
    fetch(url)
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((t) => live && setState({ html: sanitize(t) }))
      .catch((e) => live && setState({ error: String(e) }));
    return () => {
      live = false;
    };
  }, [url]);
  return (
    <main className="main">
      <PageHeader
        p={p}
        title={`${shortTitle(p)} Accessibility FAQ`}
        onOpenMenu={onOpenMenu}
        onSearch={(q) => nav.go("program", { query: q })}
      />
      <div className="page-body">
        {!url ? (
          <EmptyState icon={<Inbox size={48} />} title="No accessibility information for this conference" />
        ) : state.error ? (
          <p className="notice error">Accessibility FAQ: {state.error}</p>
        ) : !state.html ? (
          <p className="empty">Loading…</p>
        ) : (
          <article
            className="faq"
            onClick={(e) => {
              // Liens internes de la table des matières : défilement dans la page.
              const a = (e.target as HTMLElement).closest("a");
              const href = a?.getAttribute("href");
              if (href?.startsWith("#")) {
                e.preventDefault();
                document.getElementById(href.slice(1))?.scrollIntoView({ behavior: "smooth" });
              }
            }}
            dangerouslySetInnerHTML={{ __html: state.html }}
          />
        )}
      </div>
    </main>
  );
}

// ---------- Recommendations (/recommendations) ----------
export function RecommendationsPage({ p, onOpenMenu }: Props) {
  const nav = useNav();
  const [filters, setFilters] = useState({ schedule: true, lists: true, comments: true });
  const toggle = (k: keyof typeof filters) => setFilters((f) => ({ ...f, [k]: !f[k] }));
  return (
    <main className="main">
      <PageHeader
        p={p}
        title={`${shortTitle(p)} Recommendations`}
        onOpenMenu={onOpenMenu}
        onSearch={(q) => nav.go("program", { query: q })}
      />
      <div className="subbar">
        <div className="pill-group">
          <button className={`pill${filters.schedule ? " active" : ""}`} onClick={() => toggle("schedule")}>
            My schedule
          </button>
          <button className={`pill${filters.lists ? " active" : ""}`} onClick={() => toggle("lists")}>
            My lists
          </button>
          <button className={`pill${filters.comments ? " active" : ""}`} onClick={() => toggle("comments")}>
            Comments
          </button>
        </div>
      </div>
      <div className="page-body">
        <EmptyState
          icon={<Inbox size={48} />}
          title="Recommendations are not available in this prototype"
          text={
            <>
              <a href={`https://programs.sigchi.org/${p.conference.shortName.toLowerCase()}/${p.conference.year}/recommendations`} target="_blank" rel="noreferrer">
                Open them on programs.sigchi.org
              </a>
            </>
          }
        />
      </div>
    </main>
  );
}
