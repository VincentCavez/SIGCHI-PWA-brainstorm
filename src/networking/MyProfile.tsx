// Page « My profile », portée depuis anranxu/sigchi-networking-demo (components/network-ui.tsx).
import type { Program } from "../api/program";
import type { Cloud } from "../hooks";
import { AccountPanels } from "../components/AccountPanels";
import { useEffect, useState } from "react";
import { Eye, EyeOff, Globe, GraduationCap, MessagesSquare, Pencil } from "lucide-react";
import type { ReactNode } from "react";
import { useNav } from "../nav";
import { personas as seedViewers, profileAffiliation } from "./lib/demo-fixtures";
import { audienceName } from "./lib/network-model";
import { AudienceControl } from "./sharing";
import { Research } from "./research";
import { ConferencePublications } from "./ConferencePublications";
import { PlanCalendar } from "./PlanCalendar";
import { useDemoNames, useNetworking } from "./NetworkingContext";
import { Avatar, ConferencePicker, NetworkingFrame } from "./ui";

export function MyProfile({ p, cloud, onOpenMenu }: { p: Program; cloud: Cloud; onOpenMenu: () => void }) {
  const n = useNetworking();
  const { event, me, busy, recipients, change } = n;
  const { paperName, sessionName } = useDemoNames();
  const [previewing, setPreviewing] = useState(false);
  const [web, setWeb] = useState("");
  const [scholar, setScholar] = useState("");
  const [editing, setEditing] = useState<"topics" | "links" | null>(null);
  const [topicsDraft, setTopicsDraft] = useState("");
  const nav = useNav();

  useEffect(() => {
    if (editing === "topics") setTopicsDraft((me?.topics ?? []).join(", "));
    if (editing === "links") {
      setWeb(me?.links.website || "");
      setScholar(me?.links.scholar || "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  useEffect(() => {
    setWeb(me?.links.website || "");
    setScholar(me?.links.scholar || "");
  }, [me?.links.website, me?.links.scholar, me?.id]);

  useEffect(() => {
    setPreviewing(false);
    setEditing(null);
  }, [event.id]);

  // Aperçu : la page reste la même, seuls les boutons d'édition disparaissent.
  useEffect(() => {
    if (previewing) setEditing(null);
  }, [previewing]);


  return (
    <NetworkingFrame
      p={p}
      title="My profile"
      onOpenMenu={onOpenMenu}
      top={
        <>
          {me && (
            <div className="page-actions">
              <button className="textBtn" aria-pressed={previewing} onClick={() => setPreviewing(!previewing)}>
                {previewing ? <EyeOff size={16} /> : <Eye size={16} />}
                {previewing ? "Exit preview" : "Preview as another attendee"}
              </button>
            </div>
          )}
          <AccountPanels p={p} cloud={cloud} userName={n.userName} />
        </>
      }
    >
      {me && (
        <div className="reading simpleProfile" key={me.id}>
          {/* Même présentation que le profil vu par les autres (panneau d'aperçu), avec un crayon par section. */}
          <section className="panel profileMain profileCard">
            <div className="profileIdentity">
              <Avatar name={me.name} color={me.color} large />
              <div>
                <div className="profileNameRow">
                  <h2>{me.name}</h2>
                  {/* En aperçu : ce que voit un autre participant, qui peut écrire à la personne. */}
                  {previewing && (
                    <button className="primary dmBtn" onClick={() => nav.go("messages")}>
                      <MessagesSquare size={15} /> Direct message
                    </button>
                  )}
                </div>
                {me.affiliation && <p>{profileAffiliation(me)}</p>}
              </div>
            </div>

            <div className="profileSettingsRow">
              <ConferencePicker />
              {/* En aperçu (vue d'un autre participant), pas de réglage de visibilité ni d'explication. */}
              {!previewing && (
                <AudienceControl
                  primary
                  label="Who can see my profile at this conference?"
                  rule={me.rules.profile}
                  people={recipients}
                  busy={busy}
                  save={(a) => change("audience.profile", a)}
                />
              )}
            </div>
            {!previewing && (
              <p className="sharingExplanation">
                {me.rules.profile.mode === "private"
                  ? "Your profile, lists, plans, and room are private at " + event.name + "."
                  : me.rules.profile.mode === "selected"
                    ? "Only the people you choose at " + event.name + " can see what you share."
                    : "People at " +
                      event.name +
                      " can see your profile. You choose whether to share your lists, plans, or room."}
              </p>
            )}

            <ConferencePublications p={p} name={me.name} editable={!previewing} />

            <ProfileSection
              title="Current room"
              audience={previewing ? undefined : audienceName(me.rules.currentRoom)}
              onEdit={previewing ? undefined : () => nav.go("current-room")}
              editLabel="Edit current room"
            >
              {me.checkIn ? (
                <div className="checkStatus">
                  <b>Current room</b> · {me.checkIn.room} · until{" "}
                  {new Date(me.checkIn.expiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </div>
              ) : (
                <small>No active check-in.</small>
              )}
            </ProfileSection>

            <ProfileSection
              title="Topics"
              onEdit={previewing || editing === "topics" ? undefined : () => setEditing("topics")}
              editLabel="Edit topics"
            >
              {editing === "topics" ? (
                <form
                  className="inlineEditor"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const topics = topicsDraft
                      .split(",")
                      .map((t) => t.trim())
                      .filter(Boolean)
                      .slice(0, 10);
                    await change("topics", topics);
                    setEditing(null);
                  }}
                >
                  <label>
                    Topics, separated by commas
                    <input
                      autoFocus
                      value={topicsDraft}
                      onChange={(e) => setTopicsDraft(e.target.value)}
                      placeholder="Privacy, Human–AI interaction"
                    />
                  </label>
                  <div className="formRow">
                    <button className="primary" disabled={busy}>
                      Save
                    </button>
                    <button type="button" className="outlined" onClick={() => setEditing(null)}>
                      Cancel
                    </button>
                  </div>
                </form>
              ) : me.topics.length ? (
                <div className="chips">
                  {me.topics.map((t) => (
                    <span key={t}>{t}</span>
                  ))}
                </div>
              ) : (
                <small>No topics yet.</small>
              )}
            </ProfileSection>

            <ProfileSection
              title="Research links"
              audience={previewing ? undefined : audienceName(me.rules.links)}
              onEdit={previewing || editing === "links" ? undefined : () => setEditing("links")}
              editLabel="Edit research links"
            >
              {editing === "links" ? (
                <form
                  className="linksForm inlineEditor"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    await change("links", { website: web.trim(), scholar: scholar.trim() });
                    setEditing(null);
                  }}
                >
                  <label>
                    Personal website
                    <input type="url" value={web} onChange={(e) => setWeb(e.target.value)} placeholder="https://…" />
                  </label>
                  <label>
                    Google Scholar
                    <input
                      type="url"
                      value={scholar}
                      onChange={(e) => setScholar(e.target.value)}
                      placeholder="https://scholar.google.com/…"
                    />
                  </label>
                  <AudienceControl
                    label="Who can see my research links?"
                    rule={me.rules.links}
                    people={recipients}
                    busy={busy}
                    save={(a) => change("audience.links", a)}
                  />
                  <div className="formRow">
                    <button className="primary" disabled={busy}>
                      Save
                    </button>
                    <button type="button" className="outlined" onClick={() => setEditing(null)}>
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div className="links">
                  {me.links.website && (
                    <a href={me.links.website} target="_blank" rel="noreferrer">
                      <Globe size={15} />
                      Website
                    </a>
                  )}
                  {me.links.scholar && (
                    <a href={me.links.scholar} target="_blank" rel="noreferrer">
                      <GraduationCap size={16} />
                      Google Scholar
                    </a>
                  )}
                  {!me.links.website && !me.links.scholar && <small>No links yet.</small>}
                </div>
              )}
            </ProfileSection>

            {seedViewers.some((x) => x.id === me.id) ? (
              <section className="profileSection">
                <Research event={event} id={me.id} />
              </section>
            ) : (
              me.bio && <p>{me.bio}</p>
            )}

            <ProfileSection title="Lists" onEdit={previewing ? undefined : () => nav.go("my-lists")} editLabel="Edit lists">
              {me.lists.map((l) => (
                <div key={l.id} className="ownList">
                  <div className="ownListHead">
                    <b>{l.name}</b>
                    {!previewing && <span className="audienceTag">{audienceName(me.rules["list." + l.id])}</span>}
                  </div>
                  {l.paperIds.length ? (
                    <ul className="lines">
                      {l.paperIds.map((id) => (
                        <li key={id}>{paperName(id)}</li>
                      ))}
                    </ul>
                  ) : (
                    <small>No papers yet.</small>
                  )}
                </div>
              ))}
            </ProfileSection>

            <ProfileSection title="Session plans" editLabel="Edit session plans">
              {/* Calendrier interactif : crayon et interrupteur « masquer » par session (absents en aperçu). */}
              <PlanCalendar
                p={p}
                storageKey={`profile-plan-v5:${p.conference.id}:${me.id}`}
                seed={me.going.map(Number)}
                editable={!previewing}
              />
            </ProfileSection>
          </section>
        </div>
      )}

    </NetworkingFrame>
  );
}

/** Section du profil : titre, audience éventuelle et crayon d'édition. */
function ProfileSection({
  title,
  audience,
  onEdit,
  editLabel,
  children,
}: {
  title: string;
  audience?: string;
  onEdit?: () => void;
  editLabel: string;
  children: ReactNode;
}) {
  return (
    <section className="profileSection">
      <div className="profileSectionHead">
        <h3>{title}</h3>
        {audience && <span className="audienceTag">{audience}</span>}
        {onEdit && (
          <button className="iconBtn editBtn" aria-label={editLabel} title={editLabel} onClick={onEdit}>
            <Pencil size={16} />
          </button>
        )}
      </div>
      {children}
    </section>
  );
}
