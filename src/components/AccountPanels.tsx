// Blocs « Notifications » et « Settings » en haut de My profile (pages /notifications et /settings du PWA).
// Seul ce qu'une app externe peut faire est actif : couleur d'avatar (locale) et export iCal de My Schedule.
// Le reste est montré désactivé, avec la raison (données réservées à l'app officielle).
import { Bell, CalendarPlus, ExternalLink, Settings } from "lucide-react";
import type { Program } from "../api/program";
import type { Cloud } from "../hooks";
import { useLocalSchedule } from "../hooks";
import { ProfileDisclosure } from "../networking/sharing";
import { AVATAR_PALETTE, initials, useAvatarColor } from "../settings";

const OFFICIAL = "https://programs.sigchi.org";

/** Heure murale "YYYYMMDDTHHMMSS". Les timestamps du JSON sont l'heure locale de la conférence notée en UTC. */
const icsTime = (ts: number) => new Date(ts).toISOString().replace(/[-:]/g, "").slice(0, 15);
const icsText = (s: string) => s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/[,;]/g, (c) => "\\" + c);

function downloadIcs(p: Program, ids: Set<number>) {
  const tz = p.conference.timeZoneName;
  const events = p.items
    .filter((i) => ids.has(i.id) && i.start != null && i.end != null)
    .map((i) =>
      [
        "BEGIN:VEVENT",
        `UID:${p.conference.id}-${i.kind}-${i.id}@sigchi-pwa-brainstorm`,
        `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`,
        `DTSTART;TZID=${tz}:${icsTime(i.start!)}`,
        `DTEND;TZID=${tz}:${icsTime(i.end!)}`,
        `SUMMARY:${icsText(i.name)}`,
        p.itemRoom(i) ? `LOCATION:${icsText(p.itemRoom(i)!.name)}` : "",
        `URL:${OFFICIAL}/${p.conference.shortName.toLowerCase()}/${p.conference.year}/program/${i.kind}/${i.id}`,
        "END:VEVENT",
      ]
        .filter(Boolean)
        .join("\r\n"),
    );
  const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//SIGCHI PWA brainstorm//EN", ...events, "END:VCALENDAR"].join("\r\n");
  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${p.conference.shortName}-${p.conference.year}-my-schedule.ics`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Toggle({ label, hint }: { label: string; hint?: string }) {
  return (
    <label className="setting-toggle">
      <input type="checkbox" disabled />
      <span>
        {label}
        {hint && <small>{hint}</small>}
      </span>
    </label>
  );
}

export function AccountPanels({ p, cloud, userName }: { p: Program; cloud: Cloud; userName: string }) {
  const [avatarIndex, setAvatarIndex] = useAvatarColor();
  const local = useLocalSchedule(p.conference.id);
  const scheduled = new Set<number>([...local.ids, ...cloud.addedBySession.keys()]);

  return (
    <section className="panel profileExtras account-panels" aria-label="Notifications and settings">
      <ProfileDisclosure title="Notifications" icon={<Bell size={19} />}>
        <div className="setting-empty">
          <strong>No notifications to display</strong>
          <p>Notifications are not available in this prototype.</p>
          <a href={`${OFFICIAL}/notifications`} target="_blank" rel="noreferrer">
            Open notifications on programs.sigchi.org <ExternalLink size={13} />
          </a>
        </div>
      </ProfileDisclosure>

      <ProfileDisclosure title="Settings" icon={<Settings size={19} />}>
        <div className="settings">
          <section>
            <h3>Profile settings</h3>
            <h4>Personalization</h4>
            <p>Please, select color for your avatar.</p>
            <div className="avatar-palette" role="radiogroup" aria-label="Avatar color">
              {AVATAR_PALETTE.map((c, i) => (
                <button
                  key={c.bg}
                  role="radio"
                  aria-checked={i === avatarIndex}
                  aria-label={`Avatar color ${i + 1}`}
                  className={i === avatarIndex ? "chosen" : ""}
                  style={{ background: c.bg, color: c.fg }}
                  onClick={() => setAvatarIndex(i)}
                >
                  {initials(userName)}
                </button>
              ))}
            </div>
            <h4>Date &amp; time format</h4>
            <div className="setting-row">
              <label>
                Date format
                <select disabled>
                  <option>Nov 19, 2026</option>
                </select>
              </label>
              <label>
                Time format
                <select disabled>
                  <option>12 h</option>
                </select>
              </label>
            </div>
            <h4>Permissions</h4>
            <Toggle label="I agree to send my data as a part of anonymized personal data collection" />
          </section>

          <section>
            <h3>Calendar</h3>
            <p>
              Download the sessions and events of My Schedule as an iCal (.ics) file for your calendar.
            </p>
            <button
              className="primary"
              disabled={!scheduled.size}
              onClick={() => downloadIcs(p, scheduled)}
              title={scheduled.size ? undefined : "My Schedule is empty"}
            >
              <CalendarPlus size={16} /> Download iCal ({scheduled.size})
            </button>
          </section>

          <section>
            <h3>App settings</h3>
            <Toggle label="Offline mode" hint="Conference data is not updated in this mode." />
            <label className="setting-select">
              Color themes
              <select disabled>
                <option>Light</option>
              </select>
            </label>
            <Toggle label="High contrast" hint="Interface colors use a higher contrast palette." />
          </section>

          <section>
            <h3>Notifications</h3>
            <p>Push notifications for comment activity.</p>
            <Toggle label="Replies to Your Comments" />
            <Toggle label="Likes on Your Comments" />
            <Toggle label="New Comments in Followed Threads" />
            <Toggle label="Tags / Mentions by Others" />
          </section>

          <section>
            <h3>Email management</h3>
            <p>Email management is not available in this prototype.</p>
          </section>

          <section>
            <h3>External app permission settings</h3>
            <p>This prototype has your permission to read My Schedule and My Lists. You can revoke it in the official app.</p>
          </section>

          <p className="settings-note">
            Greyed-out settings can only be changed in the official app.{" "}
            <a href={`${OFFICIAL}/settings`} target="_blank" rel="noreferrer">
              Open settings on programs.sigchi.org <ExternalLink size={13} />
            </a>
          </p>
        </div>
      </ProfileDisclosure>
    </section>
  );
}
