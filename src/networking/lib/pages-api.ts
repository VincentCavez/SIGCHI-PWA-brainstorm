import { conferenceForPath } from "./conferences";
import { serve, type DemoStore } from "./demo-service";
export const storageKey = "sigchi-networking-chi26.v2";
export function pagesRequest(
  path: string,
  method: string,
  viewer: string,
  body?: unknown,
) {
  const raw = localStorage.getItem(storageKey);
  const store: DemoStore = raw ? JSON.parse(raw) : { rows: [], messages: [] };
  const r = serve(path, method, viewer, body, store);
  for (const row of r.changes ?? []) {
    store.rows = store.rows.filter(
      (old) => old.person !== row.person || old.field !== row.field,
    );
    store.rows.push(row);
  }
  if (r.message) {
    const id = (store.messages.at(-1)?.id ?? 0) + 1;
    store.messages.push({
      ...r.message,
      id,
      conferenceId: conferenceForPath(path)!.id,
    });
    r.data = { messageId: id };
  }
  if (r.changes || r.message)
    localStorage.setItem(storageKey, JSON.stringify(store));
  return { status: r.status, data: r.data };
}
