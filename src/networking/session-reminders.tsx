import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Bell, CalendarClock, X } from "lucide-react";
import type { DemoConference } from "./lib/conferences";
import type { DemoPerson } from "./lib/network-model";
import {
  reminderMinutes,
  reminderWindow,
  savedSessions,
  type ProgramSession,
} from "./lib/session-reminders";

type Reminder = { session: ProgramSession; demo: boolean; minutes: number };
type Props = {
  event: DemoConference;
  me: DemoPerson | null;
  showControls: boolean;
  busy: boolean;
  tryAttendee: () => void;
  chooseSession: () => void;
  setMinutes: (minutes: number) => Promise<void>;
};
function deviceSupported() {
  return (
    typeof Notification !== "undefined" &&
    typeof Notification.requestPermission === "function" &&
    "serviceWorker" in navigator &&
    typeof ServiceWorkerRegistration !== "undefined" &&
    "showNotification" in ServiceWorkerRegistration.prototype
  );
}
async function readyWorker() {
  await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}reminder-worker.js`);
  return navigator.serviceWorker.ready;
}
function startsIn(minutes: number) {
  return "Starts in " + minutes + (minutes === 1 ? " minute" : " minutes");
}
export function SessionReminders({
  event,
  me,
  showControls,
  busy,
  tryAttendee,
  chooseSession,
  setMinutes,
}: Props) {
  const scope = "sigchi.reminders." + event.id + "." + (me?.id || "guest");
  const minutes = me?.reminderMinutes ?? 0;
  const sessions = useMemo(
    () => (me ? savedSessions(event.sessions, me) : []),
    [event, me],
  );
  const [alerts, setAlerts] = useState<Reminder[]>([]);
  const [preview, setPreview] = useState<{
    id: string;
    offset: number;
    lead: number;
  } | null>(null);
  const [onDevice, setOnDevice] = useState(false);
  const [deviceBusy, setDeviceBusy] = useState(false);
  const [deviceMessage, setDeviceMessage] = useState("");
  const [now, setNow] = useState(Date.now);
  const alive = useRef(true);
  const delivered = useRef(new Set<string>());
  useEffect(() => {
    alive.current = true;
    setOnDevice(
      deviceSupported() &&
        Notification.permission === "granted" &&
        localStorage.getItem(scope + ".device") === "yes",
    );
    return () => {
      alive.current = false;
    };
  }, [scope]);
  const deliver = useCallback(
    (session: ProgramSession, demo: boolean, remaining: number) => {
      if (!alive.current) return;
      setAlerts((previous) => [
        ...previous.filter(
          (a) => !(a.demo === demo && a.session.id === session.id),
        ),
        { session, demo, minutes: remaining },
      ]);
      if (
        onDevice &&
        deviceSupported() &&
        Notification.permission === "granted"
      ) {
        readyWorker()
          .then((worker) => {
            if (
              !alive.current ||
              localStorage.getItem(scope + ".device") !== "yes"
            )
              return;
            return worker.showNotification(
              (demo ? "Demo · " : "") + session.name,
              {
                body:
                  startsIn(remaining) +
                  " · " +
                  session.room +
                  "\n" +
                  session.time,
                tag: scope + "." + session.id + (demo ? ".demo" : ""),
                data: { url: session.url },
              },
            );
          })
          .catch(() => {
            if (alive.current)
              setDeviceMessage(
                "Your reminder is shown here. Device alerts are unavailable.",
              );
          });
      }
    },
    [onDevice, scope],
  );

  useEffect(() => {
    if (!minutes || !sessions.length) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    function check() {
      clearTimeout(timer);
      const time = Date.now();
      setNow(time);
      const { due, next } = reminderWindow(sessions, minutes, time);
      for (const s of due) {
        const key = scope + "." + s.id + "." + s.startsAt;
        const sendOnce = () => {
          if (
            !active ||
            Date.now() >= s.startsAt ||
            delivered.current.has(key) ||
            localStorage.getItem(key)
          )
            return;
          delivered.current.add(key);
          localStorage.setItem(key, "sent");
          deliver(s, false, Math.ceil((s.startsAt - Date.now()) / 60000));
        };
        if (navigator.locks) void navigator.locks.request(key, sendOnce);
        else sendOnce();
      }
      if (Number.isFinite(next))
        timer = setTimeout(
          check,
          Math.min(next - time, due.length ? 60000 : 86400000) + 1,
        );
    }
    check();
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    return () => {
      active = false;
      clearTimeout(timer);
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, [sessions, minutes, scope, deliver]);
  useEffect(() => {
    if (!preview) return;
    const target = sessions.find((s) => s.id === preview.id);
    if (!target || !minutes || preview.lead !== minutes) {
      setPreview(null);
      return;
    }
    let timer: ReturnType<typeof setTimeout>;
    function check() {
      const demoNow = Date.now() + preview!.offset;
      const { due, next } = reminderWindow([target!], minutes, demoNow);
      if (due.length)
        deliver(due[0], true, Math.ceil((due[0].startsAt - demoNow) / 60000));
      else if (Number.isFinite(next)) {
        timer = setTimeout(check, Math.max(1, next - demoNow));
        return;
      }
      setPreview(null);
    }
    check();
    return () => clearTimeout(timer);
  }, [preview, sessions, minutes, deliver]);

  async function toggleDevice() {
    setDeviceMessage("");
    if (onDevice) {
      localStorage.removeItem(scope + ".device");
      setOnDevice(false);
      return;
    }
    setDeviceBusy(true);
    try {
      if ((await Notification.requestPermission()) !== "granted") {
        if (alive.current)
          setDeviceMessage(
            "Reminders will appear here. To get device alerts, allow notifications in your browser settings.",
          );
        return;
      }
      await readyWorker();
      if (alive.current) {
        localStorage.setItem(scope + ".device", "yes");
        setOnDevice(true);
      }
    } catch {
      if (alive.current)
        setDeviceMessage(
          "Device alerts are unavailable. You can still get reminders here.",
        );
    } finally {
      if (alive.current) setDeviceBusy(false);
    }
  }
  function tryReminder() {
    const time = Date.now();
    const session = sessions.find((s) => s.startsAt > time) || sessions[0];
    if (!session || !minutes) return;
    setAlerts((previous) => previous.filter((a) => !a.demo));
    setPreview({
      id: session.id,
      offset: session.startsAt - minutes * 60000 - 3000 - time,
      lead: minutes,
    });
  }
  const visible = minutes
    ? alerts.filter(
        (a) =>
          sessions.some((s) => s.id === a.session.id) &&
          (a.demo || a.session.startsAt > now),
      )
    : [];
  const first = visible[0];
  return (
    <>
      {showControls && (
        <section
          className="reminderPanel panel"
          aria-labelledby="session-reminder-title"
        >
          <div className="reminderHeading">
            <Bell aria-hidden="true" size={20} />
            <h2 id="session-reminder-title">Session reminders</h2>
          </div>
          {me ? (
            <>
              <p>
                These sessions are in your plan or include a paper you saved.
                Keep the demo open to get a reminder.
              </p>
              <div className="reminderActions">
                <label>
                  Remind me
                  <select
                    aria-label="Remind me"
                    value={minutes}
                    disabled={busy}
                    onChange={(e) => {
                      setPreview(null);
                      setAlerts([]);
                      void setMinutes(Number(e.target.value));
                    }}
                  >
                    <option value={0}>Off</option>
                    {reminderMinutes.map((n) => (
                      <option key={n} value={n}>
                        {n} minutes before
                      </option>
                    ))}
                  </select>
                </label>
                {sessions.length ? (
                  <button
                    type="button"
                    className="outlined"
                    disabled={!minutes || !!preview || busy}
                    onClick={tryReminder}
                  >
                    <CalendarClock size={16} aria-hidden="true" />
                    Try a reminder
                  </button>
                ) : (
                  <button
                    type="button"
                    className="outlined"
                    onClick={chooseSession}
                  >
                    Choose a session
                  </button>
                )}
                {deviceSupported() && (
                  <button
                    type="button"
                    className="textBtn"
                    disabled={!minutes || deviceBusy}
                    aria-pressed={onDevice}
                    onClick={toggleDevice}
                  >
                    Device alerts {onDevice ? "on" : "off"}
                  </button>
                )}
              </div>
              <p className="reminderHint" role="status">
                {deviceMessage ||
                  (preview
                    ? "Your demo reminder will appear in 3 seconds."
                    : sessions.length
                      ? "Try a reminder to see an example using this conference’s schedule."
                      : "Select “In my plan” on a session to try a reminder.")}
              </p>
              {sessions.length > 0 && (
                <ul className="reminderSchedule" aria-label="Saved sessions">
                  {sessions.map((session) => (
                    <li key={session.id}>
                      <a href={session.url} target="_blank" rel="noreferrer">
                        {session.name}
                      </a>
                      <span>
                        {session.time} · {session.room}
                      </span>
                      <small>
                        {me.going.includes(session.id)
                          ? "In my plan"
                          : "From a saved paper"}
                      </small>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <>
              <p>See a reminder before a session in your plan starts.</p>
              <button type="button" className="outlined" onClick={tryAttendee}>
                Try as Carla
              </button>
            </>
          )}
        </section>
      )}
      {first && (
        <aside className="sessionReminderAlert" aria-label="Session reminder">
          <div className="reminderAlertBody" role="status">
            <span className="reminderKicker">
              <Bell size={15} aria-hidden="true" />
              {first.demo ? "Demo reminder" : "Session reminder"} · {event.name}
            </span>
            <strong>{first.session.name}</strong>
            <span>
              {startsIn(
                first.demo
                  ? first.minutes
                  : Math.ceil((first.session.startsAt - now) / 60000),
              )}{" "}
              · {first.session.room}
            </span>
            <small>{first.session.time}</small>
          </div>
          <div className="reminderAlertActions">
            <a href={first.session.url} target="_blank" rel="noreferrer">
              View session
            </a>
            <button
              type="button"
              aria-label="Dismiss reminder"
              onClick={() =>
                setAlerts((previous) => previous.filter((a) => a !== first))
              }
            >
              <X size={15} aria-hidden="true" />
              Dismiss{visible.length > 1 ? " (" + visible.length + ")" : ""}
            </button>
          </div>
        </aside>
      )}
    </>
  );
}
