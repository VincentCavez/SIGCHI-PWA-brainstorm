import { AVATAR_PALETTE, initials, useAvatarColor } from "../settings";
import {
  Accessibility,
  Award,
  CalendarDays,
  Clock,
  FileText,
  Grip,
  Info,
  Layers,
  ListChecks,
  LogOut,
  Mail,
  Map as MapIcon,
  MapPin,
  MessagesSquare,
  Presentation,
  Settings,
  ThumbsUp,
  UserRound,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { hasClientId, logout, startLogin } from "../api/cloud";
import type { Program } from "../api/program";
import type { Cloud } from "../hooks";

type NavItem = { label: string; icon: LucideIcon; page: Page };
export type Page =
  | "program"
  | "profile"
  | "people"
  | "recommendations"
  | "awards"
  | "maps"
  | "access"
  | "my-schedule"
  | "my-lists"
  | "current-room"
  | "my-notes"
  | "messages"
  | "conferences"
  | "global-lists"
  | "feedback"
  | "about";

/** Pages hors conférence : le PWA y affiche une sidebar « globale ». */
export const GLOBAL_PAGES: Page[] = ["conferences", "global-lists", "feedback", "about"];

// Mêmes entrées que le PWA officiel, plus « Messages » (repris de la démo networking).
const CONFERENCE_GROUPS: NavItem[][] = [
  [
    { label: "Program", icon: CalendarDays, page: "program" },
    { label: "People", icon: Users, page: "people" },
    { label: "Recommendations", icon: ThumbsUp, page: "recommendations" },
    { label: "Awards", icon: Award, page: "awards" },
    { label: "Maps", icon: MapIcon, page: "maps" },
    { label: "Accessibility", icon: Accessibility, page: "access" },
  ],
  [
    { label: "My Schedule", icon: Clock, page: "my-schedule" },
    { label: "My Lists", icon: ListChecks, page: "my-lists" },
    { label: "Current Room", icon: MapPin, page: "current-room" },
    { label: "My Notes", icon: FileText, page: "my-notes" },
    { label: "Messages", icon: MessagesSquare, page: "messages" },
  ],
];
const GLOBAL_GROUP: NavItem[] = [
  { label: "All Conferences", icon: Presentation, page: "conferences" },
  { label: "My Lists (global)", icon: Layers, page: "global-lists" },
];
// Sidebar des pages globales du PWA (programs.sigchi.org/, /my-lists, /send-feedback).
const GLOBAL_MENU: NavItem[] = [
  { label: "Conference List", icon: Presentation, page: "conferences" },
  { label: "My Lists", icon: Layers, page: "global-lists" },
  { label: "Send Feedback", icon: Mail, page: "feedback" },
];

export function Sidebar({
  p,
  cloud,
  open,
  onClose,
  page,
  onNavigate,
}: {
  p: Program;
  cloud: Cloud;
  open: boolean;
  onClose: () => void;
  page: Page;
  onNavigate: (page: Page) => void;
}) {
  const [avatarIndex] = useAvatarColor();
  const avatar = AVATAR_PALETTE[avatarIndex];
  const go = (target: Page) => {
    onNavigate(target);
    onClose();
  };
  const renderItem = ({ label, icon: Icon, page: target }: NavItem) => (
    <button
      key={label}
      className={`side-item${target === page ? " active" : ""}`}
      aria-current={target === page ? "page" : undefined}
      onClick={() => go(target)}
    >
      <Icon size={18} />
      <span>{label}</span>
    </button>
  );
  // Le JWT contient first_name / last_name / user_name / acm_id (snake_case, non documenté).
  const userName = cloud.user
    ? [cloud.user.first_name, cloud.user.last_name].filter(Boolean).join(" ") ||
      String(cloud.user.user_name ?? "Connected")
    : null;

  return (
    <>
      {open && <button className="scrim" aria-label="Close menu" onClick={onClose} />}
      <aside className={`sidebar${open ? " open" : ""}`} aria-label="Conference menu">
        <div className="side-brand">
          <Grip size={18} className="side-grip" aria-hidden />
          <img src={`${import.meta.env.BASE_URL}sigchi.svg`} alt="SIGCHI" />
          <button className="side-close" aria-label="Close menu" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {userName ? (
          // Clic sur le nom → My profile (Notifications et Settings sont en haut de cette page).
          <div className={`side-account${page === "profile" ? " active" : ""}`}>
            <button
              className="side-account-toggle"
              aria-current={page === "profile" ? "page" : undefined}
              onClick={() => go("profile")}
            >
              <span className="side-initials" aria-hidden style={{ background: avatar.bg, color: avatar.fg }}>
                {initials(userName)}
              </span>
              <span className="side-user-name">{userName}</span>
            </button>
            <button
              className="side-icon-btn side-logout-btn"
              title="Log Out"
              aria-label="Log Out"
              onClick={() => {
                logout();
                cloud.setToken(null);
                onNavigate("program");
              }}
            >
              <LogOut size={18} />
            </button>
          </div>
        ) : (
          <div className="side-user">
            <span className="side-avatar">
              <UserRound size={16} />
            </span>
            <button
              className="side-login"
              disabled={!hasClientId}
              title={hasClientId ? "Log in with your ACM account" : "Log in is not available on this version of the site"}
              onClick={() => startLogin()}
            >
              Log In
            </button>
            <span className="side-icon-btn" aria-hidden>
              <Settings size={18} />
            </span>
          </div>
        )}

        {GLOBAL_PAGES.includes(page) ? (
          <nav className="side-nav side-nav-global">
            <div className="side-group">{GLOBAL_MENU.map(renderItem)}</div>
            <div className="side-bottom">
              {renderItem({ label: "About service", icon: Info, page: "about" })}
            </div>
          </nav>
        ) : (
          <nav className="side-nav">
            {/* Tout ce qui concerne la conférence courante forme un seul bloc ; deux sous-blocs à l'intérieur. */}
            <div className="side-conf-block" role="group" aria-label={`${p.conference.shortName} ${p.conference.year}`}>
              <a className="side-item side-conf-home" href={p.conference.url} target="_blank" rel="noreferrer">
                <img className="side-conf-logo" src={p.conference.logoUrl || `${import.meta.env.BASE_URL}conference.png`} alt="" />
                <span>
                  {p.conference.shortName} {p.conference.year} Home
                </span>
              </a>
              {CONFERENCE_GROUPS.map((group, i) => (
                <div className="side-subgroup" key={i}>
                  {group.map(renderItem)}
                </div>
              ))}
            </div>
            <div className="side-group">{GLOBAL_GROUP.map(renderItem)}</div>
            <div className="side-group">{renderItem({ label: "About service", icon: Info, page: "about" })}</div>
          </nav>
        )}
      </aside>
    </>
  );
}

