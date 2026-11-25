import { useState, type ReactNode } from "react";
import { ArrowRight, Globe, Menu, Search } from "lucide-react";
import { startLogin, hasClientId } from "../api/cloud";
import type { Program } from "../api/program";

/** Ligne « Conference time zone… » affichée sous le logo, comme dans le PWA. */
export function tzLine(p: Program) {
  const offset = p.utcOffsetLabel();
  const localOffset = -new Date(p.conference.startDate).getTimezoneOffset();
  return localOffset === p.conference.timeZoneOffset
    ? `Conference time zone is same with local time zone (${offset})`
    : `Conference time zone (${offset})`;
}

export const shortTitle = (p: Program) => `${p.conference.shortName} '${String(p.conference.year).slice(2)}`;

/**
 * En-tête commun des pages d'une conférence : barre mobile, logo, fuseau, titre,
 * « Contacts and links » et recherche (qui renvoie vers Program, comme le PWA).
 */
export function PageHeader({
  p,
  title,
  small,
  onOpenMenu,
  onSearch,
  children,
}: {
  p: Program;
  title: string;
  small?: string;
  onOpenMenu: () => void;
  onSearch?: (query: string) => void;
  children?: ReactNode;
}) {
  const [query, setQuery] = useState("");
  const conf = p.conference;
  return (
    <>
      <div className="mobile-header">
        <button className="icon-btn light" aria-label="Open menu" onClick={onOpenMenu}>
          <Menu size={22} />
        </button>
        <h1>{title}</h1>
      </div>
      <header className="page-header">
        <div className="page-title-row">
          <img className="conf-logo" src={conf.logoUrl || `${import.meta.env.BASE_URL}conference.png`} alt="" />
          <div className="page-title">
            <small>{small ?? tzLine(p)}</small>
            <h1>{title}</h1>
          </div>
          {conf.url && (
            <a className="contacts-link" href={conf.url} target="_blank" rel="noreferrer">
              <Globe size={16} /> Contacts and links
            </a>
          )}
        </div>
        {onSearch && (
          <form
            className="search"
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              onSearch(query.trim());
            }}
          >
            <Search size={18} className="muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search sessions, contents, people, notes"
              aria-label="Search sessions, contents, people, notes"
            />
            <button type="submit" className="icon-btn" aria-label="Search">
              <ArrowRight size={20} />
            </button>
          </form>
        )}
        {children}
      </header>
    </>
  );
}

/** En-tête des pages globales (All Conferences, My Lists global…) : titre seul. */
export function GlobalHeader({
  title,
  onOpenMenu,
  children,
}: {
  title: string;
  onOpenMenu: () => void;
  children?: ReactNode;
}) {
  return (
    <>
      <div className="mobile-header">
        <button className="icon-btn light" aria-label="Open menu" onClick={onOpenMenu}>
          <Menu size={22} />
        </button>
        <h1>{title}</h1>
      </div>
      <header className="page-header global-header">
        <h1 className="global-title">{title}</h1>
        {children}
      </header>
    </>
  );
}

/** Écran du PWA pour les pages réservées aux utilisateurs connectés. */
export function LoginWall() {
  return (
    <div className="login-wall">
      <img src={`${import.meta.env.BASE_URL}sigchi.svg`} alt="SIGCHI" />
      <p>The page is only available to log-in users.</p>
      <p>Please ‘Sign In’ first to get full access to data and services.</p>
      <button className="login-wall-btn" disabled={!hasClientId} onClick={() => startLogin()}>
        SIGN IN
      </button>
    </div>
  );
}

/** État vide du PWA (icône boîte, titre, sous-titre). */
export function EmptyState({ title, text, icon }: { title: string; text?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="empty-state">
      {icon}
      <strong>{title}</strong>
      {text && <span>{text}</span>}
    </div>
  );
}
