// Éléments communs des pages reprises de la démo networking.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, X } from "lucide-react";
import type { Program } from "../api/program";
import { PageHeader, shortTitle } from "../components/PageHeader";
import { useNav } from "../nav";
import { conferences } from "./lib/conferences";
import { CreateProfile } from "./sharing";
import { useNetworking } from "./NetworkingContext";
import "./networking.css";

const initials = (n: string) =>
  n
    .split(" ")
    .map((x) => x[0])
    .slice(0, 2)
    .join("");

export function Avatar({ name, color, large = false }: { name: string; color: string; large?: boolean }) {
  return (
    <span aria-hidden="true" className={"avatar " + color + (large ? " large" : "")}>
      {initials(name)}
    </span>
  );
}

export function Dialog({ title, children, close }: { title: string; children: ReactNode; close: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    el?.showModal();
    return () => el?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="drawer"
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target !== ref.current) return;
        const r = ref.current.getBoundingClientRect();
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) close();
      }}
    >
      <div className="drawerTop">
        <span>{title}</span>
        <button className="iconBtn" aria-label="Close panel" onClick={close}>
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}

export function ConferencePicker() {
  const { event, selectEvent, busy } = useNetworking();
  return (
    <label className="conferencePicker">
      <span id="conference-picker-label">Conference</span>
      <select
        aria-labelledby="conference-picker-label"
        value={event.id}
        onChange={(e) => selectEvent(e.target.value)}
        disabled={busy}
      >
        {conferences.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name} · {c.city}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * Cadre commun : en-tête (conférence de la démo), bandeau « Hackathon demo », erreurs,
 * chargement, création de profil si l'utilisateur n'en a pas encore, toast.
 */
export function NetworkingFrame({
  title,
  onOpenMenu,
  intro,
  top,
  children,
  p,
}: {
  p: Program;
  /** Contenu affiché avant tout le reste, même sans profil de démo (ex. Notifications / Settings). */
  top?: ReactNode;
  title: string;
  onOpenMenu: () => void;
  intro?: ReactNode;
  children: ReactNode;
}) {
  const n = useNetworking();
  const { event, view, me, error, notice, busy } = n;
  const [signupName, setSignupName] = useState(n.userName);
  const nav = useNav();
  return (
    <main className="main">
      <PageHeader p={p} title={`${shortTitle(p)} ${title}`} onOpenMenu={onOpenMenu} onSearch={(q) => nav.go("program", { query: q })} />
      <div className="np">
        <div className="page-body">
          <p className="demo-note">
            Networking demo ({event.name}) · Public research profiles · Simulated plans, messages and room check-ins, stored in
            this browser.
          </p>
          {top && <div className="reading simpleProfile">{top}</div>}
          {error && (
            <div role="alert" className="alert">
              {error}
            </div>
          )}
          {!n.supported ? (
            <div className="reading">
              <div className="panel joinCard">
                <h2>Not available for this conference</h2>
                <p>
                  The networking demo only has data for CHI ’26 (Barcelona) and CHI ’25 (Yokohama). Choose one of them
                  under All Conferences.
                </p>
              </div>
            </div>
          ) : !view ? (
            <div role="status" className="reading">
              <div className="panel joinCard">Loading the demo…</div>
            </div>
          ) : !me ? (
            <div className="reading joinWrap">
              {intro}
              <CreateProfile
                conferencePicker={<ConferencePicker />}
                name={signupName}
                setName={setSignupName}
                onCreate={n.createProfile}
                people={n.recipients}
                busy={busy}
              />
            </div>
          ) : (
            children
          )}
        </div>
        {notice && (
          <div className="toast" role="status">
            <Check size={16} />
            {notice}
          </div>
        )}
      </div>
    </main>
  );
}
