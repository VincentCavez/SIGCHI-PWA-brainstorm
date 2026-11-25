import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Le build vise GitHub Pages : https://vincentcavez.github.io/SIGCHI-PWA-brainstorm/
// (surcharge possible avec PAGES_BASE). En dev, l'app reste servie à la racine.
const PAGES_BASE = process.env.PAGES_BASE || "/SIGCHI-PWA-brainstorm/";

export default defineConfig(({ command }) => ({
  base: command === "build" ? PAGES_BASE : "/",
  plugins: [react()],
  // Expose les variables SIGCHI_* au front (import.meta.env.SIGCHI_*).
  envPrefix: "SIGCHI_",
  // Un token utilisateur ne doit jamais finir dans un build publié : on le neutralise au build.
  define: command === "build" ? { "import.meta.env.SIGCHI_USER_TOKEN": '""' } : {},
  server: {
    port: 5173,
    strictPort: true,
  },
}));
