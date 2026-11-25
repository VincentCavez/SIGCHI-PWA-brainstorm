// Supports d'une publication (slides et lien vers le code), ajoutés depuis la tuile
// « Publications at … » de My profile. Aucune API ne permet à une app externe d'attacher des
// fichiers ou des liens à un contenu : métadonnées dans le localStorage, fichiers dans IndexedDB.
import { useCallback, useSyncExternalStore } from "react";
import type { Id } from "./api/types";

export type Materials = {
  slides?: { name: string; type: string; size: number; addedAt: number };
  code?: string;
};

const KEY = "publication-materials";
const EVENT = "publication-materials-change";
const DB = "publication-materials";
const STORE = "slides";
export const MAX_SLIDES_BYTES = 50 * 1024 * 1024;

const keyOf = (conferenceId: Id, contentId: Id) => `${conferenceId}:${contentId}`;

let cache: Record<string, Materials> | null = null;
function readAll(): Record<string, Materials> {
  if (cache) return cache;
  try {
    cache = JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    cache = {};
  }
  return cache!;
}
function writeAll(next: Record<string, Materials>) {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(EVENT));
}
function subscribe(cb: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null;
      cb();
    }
  };
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", onStorage);
  };
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idb<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = run(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Lien de code accepté : https uniquement, sans identifiants dans l'URL. */
export function validCodeUrl(value: string): boolean {
  try {
    const u = new URL(value.trim());
    return u.protocol === "https:" && !u.username && !u.password && value.length <= 500;
  } catch {
    return false;
  }
}

export function useMaterials(conferenceId: Id, contentId: Id) {
  const k = keyOf(conferenceId, contentId);
  const all = useSyncExternalStore(subscribe, readAll);
  const value: Materials = all[k] ?? {};

  const update = useCallback(
    (patch: Partial<Materials>) => {
      const current = readAll();
      const merged: Materials = { ...(current[k] ?? {}), ...patch };
      for (const f of Object.keys(merged) as (keyof Materials)[]) if (merged[f] === undefined) delete merged[f];
      const next = { ...current };
      if (Object.keys(merged).length) next[k] = merged;
      else delete next[k];
      writeAll(next);
    },
    [k],
  );

  return {
    value,
    setCode: (url: string | undefined) => update({ code: url?.trim() || undefined }),
    async addSlides(file: File) {
      if (file.size > MAX_SLIDES_BYTES) throw new Error("Slides must be 50 MB or less.");
      await idb("readwrite", (s) => s.put(file, k));
      update({ slides: { name: file.name, type: file.type, size: file.size, addedAt: Date.now() } });
    },
    async removeSlides() {
      await idb("readwrite", (s) => s.delete(k));
      update({ slides: undefined });
    },
    /** Ouvre le fichier de slides dans un nouvel onglet. */
    async openSlides() {
      const blob = await idb<Blob | undefined>("readonly", (s) => s.get(k) as IDBRequest<Blob | undefined>);
      if (!blob) throw new Error("Slides file not found in this browser.");
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    },
  };
}
