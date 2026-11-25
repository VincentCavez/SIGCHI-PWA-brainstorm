import entries from "./chi26-room-codes.json";

const publicDemo = new URL("https://anranxu.github.io/sigchi-networking-demo/");
export function roomFromHash(hash: string): string | null {
  const match = /^#chi26-room=(\d+)$/.exec(hash);
  return match
    ? (entries.find((entry) => entry.id === match[1])?.name ?? null)
    : null;
}
export function roomFromQr(payload: string): string | null {
  try {
    const url = new URL(payload.trim());
    // QR imprimés par la démo publique, ou lien équivalent vers ce prototype.
    const ownApp = typeof location !== "undefined" && url.origin === location.origin && url.pathname === import.meta.env.BASE_URL;
    const demo = url.origin === publicDemo.origin && url.pathname === publicDemo.pathname;
    if (
      !(demo || ownApp) ||
      url.search ||
      url.username ||
      url.password
    )
      return null;
    return roomFromHash(url.hash);
  } catch {
    return null;
  }
}
export function roomFromSign(text: string, confidence: number): string | null {
  if (!Number.isFinite(confidence) || confidence < 65) return null;
  const input = text.normalize("NFKC").toLowerCase();
  const numbers = new Set(
    Array.from(input.matchAll(/\b\d{3}\b/g), (m) => m[0]),
  );
  const zone = /\barea\s*1\s*[+&]\s*2\s*[+&]\s*3\b/i.test(input);
  if (zone && numbers.size) return null;
  if (zone) {
    const activities = new Set(
      Array.from(
        input.matchAll(/\b(posters?|theat(?:re|er)|videos?)\b/g),
        (m) =>
          m[1].startsWith("poster")
            ? "posters"
            : m[1].startsWith("theat")
              ? "theatre"
              : "videos",
      ),
    );
    if (activities.size !== 1) return null;
    const name = "Area 1 + 2 + 3: " + [...activities][0];
    return entries.find((entry) => entry.name === name)?.name ?? null;
  }
  if (numbers.size !== 1) return null;
  const [number] = numbers;
  const labelled = /\b(?:room|sala|salle)\s*[:#-]?\s*\d{3}\b/.test(input);
  const standalone = input.trim() === number;
  if (!labelled && !standalone) return null;
  return (
    entries.find((entry) => entry.name === "P1 - Room " + number)?.name ?? null
  );
}
