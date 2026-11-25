// Page « My lists » de la démo networking : listes de lecture avec leur audience, rappels de sessions,
// et (comme la page Program de la démo) le choix des sessions de son plan.
import type { Program } from "../api/program";
import { useRef } from "react";
import { BookOpen, Bookmark } from "lucide-react";
import { audienceName } from "./lib/network-model";
import { AudienceControl } from "./sharing";
import { SessionReminders } from "./session-reminders";
import { useDemoNames, useNetworking } from "./NetworkingContext";
import { NetworkingFrame } from "./ui";

export function MyLists({ p, onOpenMenu }: { p: Program; onOpenMenu: () => void }) {
  const n = useNetworking();
  const { event, me, view, busy, recipients, change, savePreference } = n;
  const { paperName } = useDemoNames();
  const sessionsRef = useRef<HTMLElement>(null);

  return (
    <NetworkingFrame p={p} title="My Lists" onOpenMenu={onOpenMenu}>
      {me && view && (
        <div className="reading">
          <SessionReminders
            key={me.id + event.id}
            event={event}
            me={me}
            showControls
            busy={busy}
            tryAttendee={() => {}}
            chooseSession={() => {
              sessionsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
              sessionsRef.current?.querySelector<HTMLInputElement>("input[type=checkbox]")?.focus({ preventScroll: true });
            }}
            setMinutes={(minutesBefore) => savePreference("me/reminders", { minutesBefore })}
          />

          {me.lists.map((l) => (
            <section className="panel record" key={l.id}>
              <div className="recordHead">
                <div className="row">
                  <span className="tile">
                    <Bookmark />
                  </span>
                  <div>
                    <h3>{l.name}</h3>
                    <small>{l.paperIds.length} papers</small>
                  </div>
                </div>
              </div>
              <details className="listSharing">
                <summary>Sharing · {audienceName(me.rules["list." + l.id])}</summary>
                <AudienceControl
                  label={"Who can see " + l.name + "?"}
                  rule={me.rules["list." + l.id]}
                  people={recipients}
                  busy={busy}
                  save={(a) => change("audience.list." + l.id, a)}
                />
                {me.rules.profile.mode !== "attendees" && (
                  <p className="hint">
                    {me.profileVisible
                      ? "Your profile audience also applies to this list."
                      : "This list is hidden while your profile is private."}
                  </p>
                )}
              </details>
              <ul className="lines">
                {l.paperIds.map((id) => (
                  <li key={id}>
                    <BookOpen size={15} />
                    {paperName(id)}
                  </li>
                ))}
              </ul>
            </section>
          ))}

          <section className="panel record" ref={sessionsRef} aria-labelledby="demo-sessions-title">
            <h2 id="demo-sessions-title">Sessions and papers</h2>
            <p className="hint">Sessions of the demo program. Plans and lists have independent audiences.</p>
            {event.sessions.map((s) => {
              const going = me.going.includes(s.id);
              return (
                <div className="demoSession" key={s.id}>
                  <div className="eyebrow">
                    {s.time} <span>·</span> {s.room}
                  </div>
                  <a href={s.url} target="_blank" rel="noreferrer">
                    <b>{s.name}</b>
                  </a>
                  <div className="sessionControls">
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={going}
                        disabled={busy}
                        onChange={() => change("session." + s.id, { going: !going, shared: false })}
                      />
                      In my plan
                    </label>
                    {going && (
                      <AudienceControl
                        label="Who can see this plan?"
                        rule={me.rules["session." + s.id]}
                        people={recipients}
                        busy={busy}
                        save={(a) => change("audience.session." + s.id, a)}
                      />
                    )}
                  </div>
                  <ul className="lines">
                    {s.papers.map((pid) => {
                      const saved = me.lists.find((l) => l.id === "reading")?.paperIds ?? [];
                      const inList = saved.includes(pid);
                      return (
                        <li key={pid}>
                          <BookOpen size={15} />
                          <span className="grow">{paperName(pid)}</span>
                          <button
                            className="textBtn"
                            disabled={busy}
                            onClick={() =>
                              change(
                                "papers.reading",
                                inList ? saved.filter((x) => x !== pid) : [...saved, pid],
                              )
                            }
                          >
                            {inList ? "Remove from reading list" : "Save to reading list"}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </section>
        </div>
      )}
    </NetworkingFrame>
  );
}
