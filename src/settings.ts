// Réglages locaux de l'utilisateur (page My profile → Settings).
import { useSyncExternalStore } from "react";

/** Couleurs d'avatar proposées par le PWA (styles calculés de programs.sigchi.org/settings). */
export const AVATAR_PALETTE: { bg: string; fg: string }[] = [
  { bg: "#f7e1c8", fg: "#955539" },
  { bg: "#ffa751", fg: "#ffffff" },
  { bg: "#8ec1f8", fg: "#ffffff" },
  { bg: "#66c2a4", fg: "#ffffff" },
  { bg: "#acadb9", fg: "#ffffff" },
  { bg: "#ffe259", fg: "#955539" },
  { bg: "#e26176", fg: "#ffffff" },
  { bg: "#497cff", fg: "#ffffff" },
  { bg: "#9747ff", fg: "#ffffff" },
  { bg: "#8e008b", fg: "#ffffff" },
];

const KEY = "avatar-color";
const EVENT = "avatar-color-change";

function read(): number {
  try {
    const n = Number(localStorage.getItem(KEY));
    return Number.isInteger(n) && n >= 0 && n < AVATAR_PALETTE.length ? n : 0;
  } catch {
    return 0;
  }
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

/** Index de la couleur d'avatar choisie, partagé entre la sidebar et la page de profil. */
export function useAvatarColor(): [number, (i: number) => void] {
  const value = useSyncExternalStore(subscribe, read);
  const set = (i: number) => {
    try {
      localStorage.setItem(KEY, String(i));
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new Event(EVENT));
  };
  return [value, set];
}

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
