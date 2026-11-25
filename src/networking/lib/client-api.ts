// Version du client de la démo réduite au mode « GitHub Pages » : toutes les requêtes
// sont servies dans le navigateur par demo-service.ts et stockées dans le localStorage.
// Aucune donnée n'est envoyée à SIGCHI (l'API externe ne permet pas d'écrire).
import type { View } from "./network-model";
import { conferencePrefix, defaultConference } from "./conferences";
import { pagesRequest } from "./pages-api";

export async function callApi<T>(
  path: string,
  viewer: string,
  method = "GET",
  body?: unknown,
): Promise<{ status: number; data: T }> {
  const run = async () => pagesRequest(path, method, viewer, body) as { status: number; data: T };
  if (method !== "GET" && navigator.locks) return navigator.locks.request("sigchi-networking-store-write", run);
  return run();
}

export async function loadView(viewer: string, eventId = defaultConference.id) {
  const r = await callApi<View & { error?: string }>(conferencePrefix(eventId) + "state", viewer);
  if (r.status !== 200) throw new Error(r.data.error || "Could not load the demo.");
  return r.data;
}

export function downloadJson(name: string, data: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
