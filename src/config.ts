// Configuration des API : tout vient du .env (variables SIGCHI_*), rien en dur et pas de valeur par défaut.
// Voir .env.example pour la liste des variables.

const env = import.meta.env as unknown as Record<string, string | undefined>;

function required(name: string): string {
  const value = env[name]?.trim();
  if (!value) throw new Error(`Variable ${name} manquante dans .env`);
  return value;
}

function optional(name: string): string | undefined {
  return env[name]?.trim() || undefined;
}

export const config = {
  /** Liste des conférences (données publiques). */
  get programListUrl() {
    return required("SIGCHI_PROGRAM_LIST_URL");
  },
  /** Programme d'une conférence ; gabarit avec {shortName} et {year}. */
  programUrl(shortName: string, year: number) {
    return required("SIGCHI_PROGRAM_URL")
      .replace("{shortName}", encodeURIComponent(shortName))
      .replace("{year}", String(year));
  },
  /** Page de login externe (reçoit clientId et callback). */
  get loginUrl() {
    return required("SIGCHI_LOGIN_URL");
  },
  /** Lecture « My Schedule » / « My Lists » de l'utilisateur. */
  get cloudReadUrl() {
    return required("SIGCHI_CLOUD_READ_URL");
  },
  get appSignature() {
    return required("SIGCHI_APP_SIGNATURE");
  },
  clientId: optional("SIGCHI_CLIENT_ID"),
  /** Token de secours pour le dev ; neutralisé au build (vite.config.ts). */
  envToken: optional("SIGCHI_USER_TOKEN"),
};
