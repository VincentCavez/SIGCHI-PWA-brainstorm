// Page People du PWA (/chi/2026/people/list, /people/affiliations, /people/list/{id}).
import { useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import type { Program } from "../api/program";
import type { Affiliation, Id, Person } from "../api/types";
import { PageHeader, shortTitle } from "../components/PageHeader";
import { ContentCard, SessionCard } from "../components/Cards";
import { useNav } from "../nav";
import type { Cloud } from "../hooks";
import { useLocalSchedule } from "../hooks";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

/** Initiale d'index : lettre latine sans accent, sinon "#" (ou "文" pour les écritures CJK, comme le PWA). */
function indexLetter(s: string, cjk = false): string {
  const c = s.trim().normalize("NFKD").replace(/\p{M}/gu, "").charAt(0).toUpperCase();
  if (/[A-Z]/.test(c)) return c;
  if (cjk && /[぀-ヿ㐀-鿿가-힯]/.test(c)) return "文";
  return "#";
}

const sortName = (p: Person) => `${p.lastName}, ${[p.firstName, p.middleInitial].filter(Boolean).join(" ")}`;

export function affiliationLine(a: Affiliation): string {
  const place = [a.country, a.state, a.city, a.dsl].filter(Boolean).join(", ");
  return [a.institution, place].filter(Boolean).join(" | ");
}

function AlphaIndex<T>({
  groups,
  render,
  letters,
}: {
  groups: Map<string, T[]>;
  render: (item: T) => React.ReactNode;
  letters: string[];
}) {
  return (
    <>
      <nav className="alpha-bar" aria-label="Alphabetical index">
        {letters.map((l) => (
          <button
            key={l}
            disabled={!groups.has(l)}
            onClick={() => document.getElementById(`alpha-${l}`)?.scrollIntoView({ behavior: "smooth" })}
          >
            {l}
          </button>
        ))}
      </nav>
      <div className="alpha-list">
        {[...letters.filter((l) => l === "#"), ...letters.filter((l) => l !== "#")]
          .filter((l) => groups.has(l))
          .map((l) => (
            <section key={l} id={`alpha-${l}`} className="alpha-section">
              <h3>{l}</h3>
              <ul>{groups.get(l)!.map(render)}</ul>
            </section>
          ))}
      </div>
    </>
  );
}

export function PeoplePage({ p, cloud, onOpenMenu }: { p: Program; cloud: Cloud; onOpenMenu: () => void }) {
  const nav = useNav();
  const { personId, affiliation } = nav.params;
  const tab: "people" | "affiliations" = affiliation !== undefined || nav.params.query === "affiliations" ? "affiliations" : "people";

  const peopleGroups = useMemo(() => {
    const groups = new Map<string, Person[]>();
    const sorted = [...p.people.values()].sort((a, b) => sortName(a).localeCompare(sortName(b)));
    for (const person of sorted) {
      const l = indexLetter(person.lastName || person.firstName);
      groups.set(l, [...(groups.get(l) ?? []), person]);
    }
    return groups;
  }, [p]);

  const affiliations = useMemo(() => {
    const byName = new Map<string, Id[]>();
    for (const person of p.people.values())
      for (const a of p.affiliationsByPerson.get(person.id) ?? []) {
        if (!a.institution) continue;
        const ids = byName.get(a.institution) ?? [];
        if (!ids.includes(person.id)) ids.push(person.id);
        byName.set(a.institution, ids);
      }
    const groups = new Map<string, string[]>();
    for (const name of [...byName.keys()].sort((a, b) => a.localeCompare(b))) {
      const l = indexLetter(name, true);
      groups.set(l, [...(groups.get(l) ?? []), name]);
    }
    return { byName, groups };
  }, [p]);

  const title =
    personId != null ? `${shortTitle(p)} Person` : tab === "affiliations" ? `${shortTitle(p)} Affiliations` : `${shortTitle(p)} People`;

  return (
    <main className="main">
      <PageHeader p={p} title={title} onOpenMenu={onOpenMenu} onSearch={(q) => nav.go("program", { query: q })}>
        {personId == null && (
          <div className="tabs-row">
            <nav className="tabs" aria-label="People">
              <button className={tab === "people" ? "active" : ""} onClick={() => nav.go("people")}>
                People
              </button>
              <button
                className={tab === "affiliations" ? "active" : ""}
                onClick={() => nav.go("people", { query: "affiliations" })}
              >
                Affiliations
              </button>
            </nav>
          </div>
        )}
      </PageHeader>
      <div className="page-body">
        {personId != null ? (
          <PersonDetail p={p} cloud={cloud} id={personId} />
        ) : tab === "people" ? (
          <AlphaIndex
            groups={peopleGroups}
            letters={[...LETTERS, "#"]}
            render={(person) => (
              <li key={person.id}>
                <a
                  href={`#person-${person.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    nav.go("people", { personId: person.id });
                  }}
                >
                  {sortName(person)}
                </a>
              </li>
            )}
          />
        ) : affiliation ? (
          <section className="detail-card">
            <button className="back-link" onClick={() => nav.go("people", { query: "affiliations" })}>
              <ArrowLeft size={16} /> Affiliations
            </button>
            <h2 className="detail-title">{affiliation}</h2>
            <ul className="plain-list">
              {(affiliations.byName.get(affiliation) ?? [])
                .map((id) => p.people.get(id)!)
                .sort((a, b) => sortName(a).localeCompare(sortName(b)))
                .map((person) => (
                  <li key={person.id}>
                    <a
                      href={`#person-${person.id}`}
                      onClick={(e) => {
                        e.preventDefault();
                        nav.go("people", { personId: person.id });
                      }}
                    >
                      {sortName(person)}
                    </a>
                  </li>
                ))}
            </ul>
          </section>
        ) : (
          <AlphaIndex
            groups={affiliations.groups}
            letters={["#", ...LETTERS, "文"]}
            render={(name) => (
              <li key={name}>
                <a
                  href="#affiliation"
                  onClick={(e) => {
                    e.preventDefault();
                    nav.go("people", { affiliation: name });
                  }}
                >
                  {name}
                </a>
              </li>
            )}
          />
        )}
      </div>
    </main>
  );
}

function PersonDetail({ p, cloud, id }: { p: Program; cloud: Cloud; id: Id }) {
  const nav = useNav();
  const local = useLocalSchedule(p.conference.id);
  const person = p.people.get(id);
  if (!person) return <p className="empty">Unknown person.</p>;
  const contents = p.contentsByPerson.get(id) ?? [];
  const chaired = p.items.filter((i) => i.peopleIds.includes(id));
  const sessionCard = (itemId: Id) => {
    const s = p.itemsById.get(itemId);
    return s ? (
      <SessionCard
        p={p}
        s={s}
        added={cloud.addedBySession.get(s.id) ?? 0}
        inSchedule={local.ids.has(s.id) || cloud.addedBySession.has(s.id)}
        onToggleSchedule={() => local.toggle(s.id)}
      />
    ) : null;
  };

  return (
    <section className="detail-card">
      <button className="back-link" onClick={() => nav.go("people")}>
        <ArrowLeft size={16} /> People
      </button>
      <h2 className="detail-title">{p.personName(id)}</h2>
      {(p.affiliationsByPerson.get(id) ?? []).map((a, i) => (
        <p key={i} className="person-affiliation">
          <span className="type-dot" style={{ background: "var(--primary)" }} />
          <a
            href="#affiliation"
            onClick={(e) => {
              e.preventDefault();
              nav.go("people", { affiliation: a.institution });
            }}
          >
            {affiliationLine(a)}
          </a>
        </p>
      ))}
      {contents.length > 0 && (
        <div className="detail-block">
          <h3>Program items</h3>
          {contents.map((c) => {
            const item = p.contentItem(c);
            return (
              <div key={c.id} className="program-item">
                <ContentCard p={p} c={c} />
                {item && (
                  <>
                    <h4 className="session-details-label">Session Details</h4>
                    {sessionCard(item.id)}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
      {chaired.length > 0 && (
        <div className="detail-block">
          <h3>Sessions chaired</h3>
          {chaired.map((s) => (
            <div key={`${s.kind}-${s.id}`} className="program-item">
              {sessionCard(s.id)}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
