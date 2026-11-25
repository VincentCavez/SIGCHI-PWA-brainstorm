import { useCallback, useEffect, useMemo, useState } from "react";
import { useCloud, useProgram } from "./hooks";
import { isDemo } from "./api/cloud";
import demoProfile from "./demo/john-doe.json";
import { GLOBAL_PAGES, Sidebar, type Page } from "./components/Sidebar";
import { ProgramPage } from "./components/ProgramPage";
import { LoginWall, PageHeader, shortTitle } from "./components/PageHeader";
import { NavContext, type NavParams } from "./nav";
import { NotesProvider } from "./notes";
import { PeoplePage } from "./pages/People";
import { AccessibilityPage, AwardsPage, MapsPage, RecommendationsPage } from "./pages/ConferencePages";
import { MyNotesPage, MySchedulePage } from "./pages/PersonalPages";
import { AboutPage, AllConferencesPage, FeedbackPage, GlobalListsPage } from "./pages/GlobalPages";
import { NetworkingProvider, demoEventFor } from "./networking/NetworkingContext";
import { MyProfile } from "./networking/MyProfile";
import { MyLists } from "./networking/MyLists";
import { CurrentRoom } from "./networking/CurrentRoom";
import { Messages } from "./networking/Messages";
import { roomFromHash } from "./networking/lib/room-identification";

// Conférence affichée par défaut ; « All Conferences » permet d'en changer.
const DEFAULT_CONF = { shortName: "CHI", year: 2026 };
const CONF_KEY = "current-conference";

function initialConf() {
  try {
    const saved = JSON.parse(localStorage.getItem(CONF_KEY) || "null");
    if (saved && typeof saved.shortName === "string" && typeof saved.year === "number") return saved as typeof DEFAULT_CONF;
  } catch {
    /* ignore */
  }
  return DEFAULT_CONF;
}

export default function App() {
  const [conf, setConf] = useState(initialConf);
  const program = useProgram(conf.shortName, conf.year);
  const cloud = useCloud(program.data?.conference.id);
  const [menuOpen, setMenuOpen] = useState(false);
  // QR de salle de la démo (#chi26-room=ID) : ouvre Current Room avec la salle présélectionnée.
  const [incomingRoom, setIncomingRoom] = useState<string | null>(() => roomFromHash(window.location.hash));
  const [page, setPage] = useState<Page>(() => (incomingRoom ? "current-room" : "program"));
  const [params, setParams] = useState<NavParams>({});

  const go = useCallback((next: Page, nextParams: NavParams = {}) => {
    setPage(next);
    setParams(nextParams);
    setMenuOpen(false);
    window.scrollTo(0, 0);
  }, []);
  const nav = useMemo(() => ({ page, params, go }), [page, params, go]);

  useEffect(() => {
    const onHash = () => {
      const room = roomFromHash(window.location.hash);
      if (room) {
        setIncomingRoom(room);
        go("current-room");
      }
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [go]);

  const roomConsumed = useCallback(() => {
    setIncomingRoom(null);
    if (roomFromHash(window.location.hash))
      history.replaceState(history.state, "", window.location.pathname + window.location.search);
  }, []);

  /** Change de conférence ; par défaut on ouvre son Program (All Conferences), sinon on reste sur `nextPage`. */
  const selectConference = (shortName: string, year: number, nextPage: Page = "program") => {
    const next = { shortName, year };
    try {
      localStorage.setItem(CONF_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
    setConf(next);
    go(nextPage);
  };

  if (program.loading)
    return (
      <div className="loading">
        <img src={`${import.meta.env.BASE_URL}sigchi.svg`} alt="" />
        <span>
          Loading {conf.shortName} {conf.year} program…
        </span>
      </div>
    );
  if (program.error || !program.data)
    return (
      <div className="loading error">
        <span>Error: {program.error}</span>
        {(conf.shortName !== DEFAULT_CONF.shortName || conf.year !== DEFAULT_CONF.year) && (
          <button className="login-wall-btn" onClick={() => selectConference(DEFAULT_CONF.shortName, DEFAULT_CONF.year)}>
            Back to {DEFAULT_CONF.shortName} {DEFAULT_CONF.year}
          </button>
        )}
      </div>
    );

  const p = program.data;
  const user = cloud.user;
  const userName = user ? [user.first_name, user.last_name].filter(Boolean).join(" ") || String(user.user_name ?? "") : "";
  const accountKey = String(user?.acm_id ?? user?.user_name ?? userName);
  const openMenu = () => setMenuOpen(true);
  const networkingPage = page === "profile" || page === "my-lists" || page === "current-room" || page === "messages";

  const body = (() => {
    if (networkingPage && !userName) {
      const titles: Record<string, string> = {
        profile: "My profile",
        "my-lists": "My Lists",
        "current-room": "Current Room",
        messages: "Messages",
      };
      return (
        <main className="main">
          <PageHeader p={p} title={`${shortTitle(p)} ${titles[page]}`} onOpenMenu={openMenu} />
          <div className="page-body">
            <LoginWall />
          </div>
        </main>
      );
    }
    switch (page) {
      case "profile":
        return <MyProfile p={p} cloud={cloud} onOpenMenu={openMenu} />;
      case "current-room":
        return <CurrentRoom p={p} onOpenMenu={openMenu} incomingRoom={incomingRoom} onRoomConsumed={roomConsumed} />;
      case "my-lists":
        return <MyLists p={p} onOpenMenu={openMenu} />;
      case "messages":
        return <Messages p={p} onOpenMenu={openMenu} openProfile={() => go("profile")} />;
      case "people":
        return <PeoplePage p={p} cloud={cloud} onOpenMenu={openMenu} />;
      case "recommendations":
        return <RecommendationsPage p={p} onOpenMenu={openMenu} />;
      case "awards":
        return <AwardsPage p={p} onOpenMenu={openMenu} />;
      case "maps":
        return <MapsPage p={p} onOpenMenu={openMenu} />;
      case "access":
        return <AccessibilityPage p={p} onOpenMenu={openMenu} />;
      case "my-schedule":
        return <MySchedulePage p={p} cloud={cloud} onOpenMenu={openMenu} />;
      case "my-notes":
        return <MyNotesPage p={p} cloud={cloud} onOpenMenu={openMenu} />;
      case "conferences":
        return <AllConferencesPage onOpenMenu={openMenu} currentId={p.conference.id} onSelect={(shortName, year) => selectConference(shortName, year)} />;
      case "global-lists":
        return <GlobalListsPage onOpenMenu={openMenu} cloud={cloud} />;
      case "feedback":
        return <FeedbackPage onOpenMenu={openMenu} />;
      case "about":
        return <AboutPage onOpenMenu={openMenu} />;
      default:
        return <ProgramPage key={params.query ?? ""} p={p} cloud={cloud} onOpenMenu={openMenu} initialQuery={params.query} />;
    }
  })();

  const shell = (
    <div className={`shell${GLOBAL_PAGES.includes(page) ? " global" : ""}`}>
      <Sidebar p={p} cloud={cloud} open={menuOpen} onClose={() => setMenuOpen(false)} page={page} onNavigate={(next) => go(next)} />
      {body}
    </div>
  );

  return (
    <NavContext.Provider value={nav}>
      <NotesProvider>
        {userName ? (
          <NetworkingProvider
            key={accountKey}
            userName={userName}
            accountKey={accountKey}
            demoEvent={demoEventFor(conf.shortName, conf.year)}
            profileSeed={isDemo ? demoProfile.networking : null}
            // Sélecteur de conférence de My profile : on reste sur la page courante après le rechargement.
            onSelectConference={(shortName, year) => selectConference(shortName, year, page)}
          >
            {shell}
          </NetworkingProvider>
        ) : (
          shell
        )}
      </NotesProvider>
    </NavContext.Provider>
  );
}
