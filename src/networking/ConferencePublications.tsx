// Tuile « Publications at CHI '26 » du profil : contributions de la personne dans le vrai programme
// de la conférence affichée (JSON public), retrouvées par son nom. Montrée à l'identique dans
// My profile et dans l'aperçu vu par les autres.
import { useMemo, useRef, useState } from "react";
import { Award, Code2, Presentation, X } from "lucide-react";
import { useMaterials, validCodeUrl } from "../materials";
import type { Program } from "../api/program";
import type { Content } from "../api/types";
import { ContentCard } from "../components/Cards";
import { shortTitle } from "../components/PageHeader";

const normalize = (s: string) => s.normalize("NFKD").replace(/\p{M}/gu, "").replace(/\s+/g, " ").trim().toLowerCase();

export function ConferencePublications({ p, name, editable = false }: { p: Program; name: string; editable?: boolean }) {
  const contents = useMemo(() => {
    const target = normalize(name);
    const seen = new Set<number>();
    const out: Content[] = [];
    for (const person of p.people.values()) {
      const full = normalize(p.personName(person.id));
      const short = normalize(`${person.firstName} ${person.lastName}`);
      if (full !== target && short !== target) continue;
      for (const c of p.contentsByPerson.get(person.id) ?? [])
        if (!seen.has(c.id)) {
          seen.add(c.id);
          out.push(c);
        }
    }
    return out.sort((a, b) => a.title.localeCompare(b.title));
  }, [p, name]);

  if (!contents.length) return null;
  return (
    <section className="pubTile" aria-labelledby="pub-tile-title">
      <div className="pubTileHead">
        <Award size={18} aria-hidden="true" />
        <h3 id="pub-tile-title">
          Publications at {shortTitle(p)} <span>({contents.length})</span>
        </h3>
      </div>
      <div className="pubTileList">
        {contents.map((c) => (
          <div key={c.id} className="pubItem">
            <ContentCard p={p} c={c} />
            <PublicationMaterials p={p} c={c} editable={editable} />
          </div>
        ))}
      </div>
    </section>
  );
}

/** Slides et lien vers le code d'une publication : liens visibles par tous, boutons d'ajout en édition. */
function PublicationMaterials({ p, c, editable }: { p: Program; c: Content; editable: boolean }) {
  const m = useMaterials(p.conference.id, c.id);
  const file = useRef<HTMLInputElement>(null);
  const [codeDraft, setCodeDraft] = useState<string | null>(null);
  const [error, setError] = useState("");
  const { slides, code } = m.value;
  if (!editable && !slides && !code) return null;

  return (
    <div className="pubMaterials">
      {slides && (
        <span className="pubMaterial">
          <button className="textBtn" onClick={() => m.openSlides().catch((e) => setError(String(e.message ?? e)))}>
            <Presentation size={15} /> Slides · {slides.name}
          </button>
          {editable && (
            <button className="iconBtn" aria-label="Remove slides" title="Remove slides" onClick={() => m.removeSlides()}>
              <X size={14} />
            </button>
          )}
        </span>
      )}
      {code && codeDraft === null && (
        <span className="pubMaterial">
          <a href={code} target="_blank" rel="noreferrer">
            <Code2 size={15} /> Code
          </a>
          {editable && (
            <button className="iconBtn" aria-label="Remove code link" title="Remove code link" onClick={() => m.setCode(undefined)}>
              <X size={14} />
            </button>
          )}
        </span>
      )}

      {editable && codeDraft !== null && (
        <form
          className="pubCodeForm"
          onSubmit={(e) => {
            e.preventDefault();
            if (!validCodeUrl(codeDraft)) {
              setError("Enter an https:// link, for example to GitHub or GitLab.");
              return;
            }
            m.setCode(codeDraft);
            setCodeDraft(null);
            setError("");
          }}
        >
          <input
            autoFocus
            type="url"
            value={codeDraft}
            onChange={(e) => setCodeDraft(e.target.value)}
            placeholder="https://github.com/…"
            aria-label="Link to the codebase"
          />
          <button className="primary">Save</button>
          <button type="button" className="outlined" onClick={() => (setCodeDraft(null), setError(""))}>
            Cancel
          </button>
        </form>
      )}

      {editable && codeDraft === null && (
        <span className="pubActions">
          <input
            ref={file}
            type="file"
            hidden
            accept=".pdf,.ppt,.pptx,.key,.odp,application/pdf"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              try {
                await m.addSlides(f);
                setError("");
              } catch (err) {
                setError(String((err as Error).message ?? err));
              }
            }}
          />
          <button className="outlined" onClick={() => file.current?.click()}>
            <Presentation size={15} /> {slides ? "Replace slides" : "Add slides"}
          </button>
          <button className="outlined" onClick={() => setCodeDraft(code ?? "")}>
            <Code2 size={15} /> {code ? "Edit code link" : "Add code link"}
          </button>
        </span>
      )}
      {error && <small className="pubError">{error}</small>}
    </div>
  );
}
