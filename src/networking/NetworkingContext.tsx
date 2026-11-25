// État partagé des pages reprises de anranxu/sigchi-networking-demo (My profile, My Lists, Messages).
// Portage de la logique de components/network-ui.tsx. L'identité vient du compte SIGCHI connecté :
// si le nom correspond à un participant fictif de la démo on reprend ce profil, sinon on propose
// d'en créer un (privé par défaut), comme dans la démo.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { personas as seedViewers } from "./lib/demo-fixtures";
import { audience, type Audience, type Identity, type View } from "./lib/network-model";
import { callApi, loadView } from "./lib/client-api";
import { conferencePrefix, conferences, defaultConference, type DemoConference } from "./lib/conferences";
import { storageKey } from "./lib/pages-api";

const MEMBER_KEY = "np.member.";

const normalize = (s: string) => s.normalize("NFKD").replace(/\p{M}/gu, "").trim().toLowerCase();

export function safeGet(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
export function safeSet(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

function initialViewer(userName: string, accountKey: string): string | null {
  const persona = seedViewers.find((p) => p.id !== "guest" && normalize(p.name) === normalize(userName));
  if (persona) return persona.id;
  const stored = safeGet(MEMBER_KEY + accountKey);
  return stored && /^member-[a-f0-9-]{36}$/.test(stored) ? stored : null;
}

/** Conférence de la démo correspondant à la conférence affichée par l'app (la démo n'a que CHI 2026 et CHI 2025). */
export function demoEventFor(shortName: string, year: number): DemoConference | null {
  return conferences.find((c) => c.name === `${shortName} ’${String(year).slice(2)}`) ?? null;
}

function useNetworkingState(
  userName: string,
  accountKey: string,
  demoEvent: DemoConference | null,
  onSelectConference: (shortName: string, year: number) => void,
  autoProfile: boolean,
) {
  const event = demoEvent ?? defaultConference;
  const [viewer, setViewer] = useState<string | null>(() => initialViewer(userName, accountKey));
  const [view, setView] = useState<View | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const generation = useRef(0);
  const prefix = conferencePrefix(event.id);
  const asViewer = viewer ?? "guest";

  const reload = useCallback(async () => {
    setView(await loadView(asViewer, event.id));
  }, [asViewer, event.id]);

  useEffect(() => {
    const id = ++generation.current;
    setView(null);
    setError("");
    loadView(asViewer, event.id)
      .then((data) => id === generation.current && setView(data))
      .catch((e: Error) => {
        if (id !== generation.current) return;
        if (viewer?.startsWith("member-") && e.message.includes("registered")) {
          safeSet(MEMBER_KEY + accountKey, null);
          setViewer(null);
        } else setError(e.message);
      });
    return () => {
      generation.current++;
    };
  }, [asViewer, event.id, viewer, accountKey]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 2800);
    return () => clearTimeout(t);
  }, [notice]);

  // Synchronisation entre onglets (même stockage que la démo).
  useEffect(() => {
    let live = true;
    const sync = async (e: StorageEvent) => {
      if (e.key !== storageKey) return;
      const d = await loadView(asViewer, event.id).catch(() => null);
      if (live && d) setView(d);
    };
    window.addEventListener("storage", sync);
    return () => {
      live = false;
      window.removeEventListener("storage", sync);
    };
  }, [asViewer, event.id]);

  // Recharge à l'expiration d'un check-in (1 h) ou d'un signalement de salle.
  useEffect(() => {
    if (!view) return;
    const deadlines = [view.own?.checkIn, ...view.directory.map((p) => p.checkIn)]
      .flatMap((c) => (c ? [c.expiresAt] : []))
      .filter((t) => t > Date.now());
    if (view.roomBoard.refreshAt) deadlines.push(view.roomBoard.refreshAt);
    if (!deadlines.length) return;
    let live = true;
    const t = setTimeout(
      () => {
        loadView(asViewer, event.id)
          .then((v) => live && setView(v))
          .catch(() => {});
      },
      Math.max(0, Math.min(...deadlines) - Date.now() + 10),
    );
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [view, asViewer, event.id]);

  /** Le sélecteur de conférence de la démo change la conférence de toute l'app. */
  function selectEvent(id: string) {
    const next = conferences.find((c) => c.id === id);
    if (next) onSelectConference("CHI", next.year);
  }

  async function createProfile(name: string, rule: Audience, quiet = false) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const r = await callApi<{ id: string; error?: string }>(prefix + "profiles", asViewer, "POST", {
        name,
        audience: rule,
      });
      if (r.status !== 201) throw Error(r.data.error || "Could not create profile.");
      safeSet(MEMBER_KEY + accountKey, r.data.id);
      setViewer(r.data.id);
      if (!quiet) setNotice("Your profile is ready");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // Profil de démonstration : le profil existe d'emblée (visible par tous les participants),
  // sans passer par l'écran « Create your conference profile ».
  const autoStarted = useRef(false);
  useEffect(() => {
    if (!autoProfile || viewer || !view || autoStarted.current) return;
    autoStarted.current = true;
    void createProfile(userName, audience(true), true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoProfile, viewer, view, userName]);

  async function savePreference(route: string, body: unknown, confirmation = "Changes saved for " + event.name) {
    if (busy || !viewer) return;
    setBusy(true);
    setError("");
    try {
      const r = await callApi<{ error?: string }>(prefix + route, viewer, "PATCH", body);
      if (r.status >= 400) throw Error(r.data.error);
      setView(await loadView(viewer, event.id));
      setNotice(confirmation);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  /** Envoie un message de démo (même règle que la démo : profil visible par le destinataire). */
  async function sendMessage(recipient: string, body: string) {
    if (busy || !viewer) return false;
    setBusy(true);
    setError("");
    try {
      const r = await callApi<{ error?: string }>(prefix + "messages", viewer, "POST", { recipient, body });
      if (r.status !== 201) throw Error(r.data.error);
      setView(await loadView(viewer, event.id));
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  const personas: Identity[] = view?.identities || seedViewers;
  const recipients = personas.filter((p) => p.id !== asViewer && p.id !== "guest");

  return {
    userName,
    autoProfile,
    supported: demoEvent !== null,
    event,
    selectEvent,
    viewer,
    asViewer,
    view,
    me: view?.own ?? null,
    busy,
    error,
    notice,
    setNotice,
    personas,
    recipients,
    createProfile,
    savePreference,
    change: (field: string, value: unknown) => savePreference("me/sharing", { field, value }),
    sendMessage,
    reload,
  };
}

export type Networking = ReturnType<typeof useNetworkingState>;
const Ctx = createContext<Networking | null>(null);

export function NetworkingProvider({
  userName,
  accountKey,
  demoEvent,
  onSelectConference,
  autoProfile = false,
  children,
}: {
  userName: string;
  accountKey: string;
  demoEvent: DemoConference | null;
  onSelectConference: (shortName: string, year: number) => void;
  /** Crée le profil automatiquement (profil de démonstration). */
  autoProfile?: boolean;
  children: ReactNode;
}) {
  const state = useNetworkingState(userName, accountKey, demoEvent, onSelectConference, autoProfile);
  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}

export function useNetworking(): Networking {
  const v = useContext(Ctx);
  if (!v) throw new Error("useNetworking outside NetworkingProvider");
  return v;
}

/** Nom affichable d'un article ou d'une session de la démo. */
export function useDemoNames() {
  const { event } = useNetworking();
  return useMemo(
    () => ({
      paperName: (id: string) => event.papers.find((p) => p.id === id)?.title || id,
      sessionName: (id: string) => event.sessions.find((s) => s.id === id)?.name || id,
    }),
    [event],
  );
}
