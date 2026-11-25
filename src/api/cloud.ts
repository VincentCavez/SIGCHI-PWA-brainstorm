// API cloud authentifiée : login externe puis lecture du programme et des listes de l'utilisateur.
// URLs et identifiants : voir src/config.ts et .env.
import { config } from "../config";
import type { CloudReadAllResponse, MyList, MyScheduleSession } from "./types";

const CLIENT_ID = config.clientId;
const ENV_TOKEN = config.envToken;
const TOKEN_KEY = "sigchi-user-token";

export const hasClientId = Boolean(CLIENT_ID);

/** Redirige vers la page de login SIGCHI ; elle revient ici avec ?token=JWT. */
export function startLogin(callbackUrl = `${window.location.origin}${import.meta.env.BASE_URL}`): void {
  if (!CLIENT_ID) throw new Error("SIGCHI_CLIENT_ID manquant dans .env");
  const url = `${config.loginUrl}?clientId=${encodeURIComponent(CLIENT_ID)}&callback=${encodeURIComponent(callbackUrl)}`;
  window.location.assign(url);
}

/** JWT = trois segments base64url. Rejette p. ex. « … » copié depuis une doc (non ISO-8859-1 → fetch plante). */
const JWT_RE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*$/;
const isJwt = (t: string | null | undefined): t is string => !!t && JWT_RE.test(t.trim());

/**
 * Récupère le token : d'abord ?token= dans l'URL (retour de login, puis on le retire
 * de la barre d'adresse), sinon localStorage, sinon SIGCHI_USER_TOKEN du .env.
 * Une valeur qui n'a pas la forme d'un JWT est ignorée (et effacée du localStorage).
 */
export function getToken(): string | null {
  const params = new URLSearchParams(window.location.search);
  const fromUrl = params.get("token");
  if (fromUrl != null) {
    params.delete("token");
    const qs = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`);
    if (isJwt(fromUrl)) {
      safeSet(TOKEN_KEY, fromUrl.trim());
      return fromUrl.trim();
    }
    console.warn("?token= ignoré : ce n'est pas un JWT");
  }
  const stored = safeGet(TOKEN_KEY);
  if (isJwt(stored)) return stored.trim();
  if (stored != null) logout();
  return isJwt(ENV_TOKEN) ? ENV_TOKEN.trim() : null;
}

export function logout(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

/** Décode le payload du JWT (sans vérifier la signature) : nom, username, exp... */
export function decodeToken(token: string): Record<string, unknown> | null {
  try {
    const part = token.split(".")[1];
    const json = atob(part.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(decodeURIComponent(escape(json)));
  } catch {
    return null;
  }
}

export async function readAll(token: string, lastSyncDate = 0): Promise<CloudReadAllResponse> {
  const res = await fetch(config.cloudReadUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Sigchi-User-Token": token,
      "Public-App-Signature": config.appSignature,
    },
    body: JSON.stringify({ lastSyncDate }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`cloud read: HTTP ${res.status} ${body.slice(0, 200)}`);
  }
  return res.json();
}

/** Filtre ce que la doc demande de masquer côté client (isAdded=false, isDeleted=true). */
export function activeSchedule(data: CloudReadAllResponse, conferenceId?: number): MyScheduleSession[] {
  return data.myScheduleSessions
    .filter((s) => s.isAdded && (conferenceId == null || s.conferenceId === conferenceId))
    .map((s) => ({ ...s, myScheduleContents: s.myScheduleContents.filter((c) => c.isAdded) }));
}

export function activeLists(data: CloudReadAllResponse): MyList[] {
  return data.myLists
    .filter((l) => !l.isDeleted)
    .map((l) => ({ ...l, myListItems: l.myListItems.filter((i) => i.isAdded) }));
}

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}
