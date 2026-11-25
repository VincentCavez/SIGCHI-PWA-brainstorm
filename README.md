# SIGCHI PWA brainstorm — prototype CHI 2026

Prototype réalisé pendant un hackathon SIGCHI : une app autonome (Vite + React + TypeScript) qui reproduit l'interface de [programs.sigchi.org](https://programs.sigchi.org/) et l'enrichit (programme, personnes, prix, cartes, accessibilité, pages personnelles, fonctions de networking).

## Démarrer

```bash
npm install
npm run dev        # http://localhost:5173
npm run typecheck
npm run build      # sortie dans dist/
```

## Configuration

Toute la configuration passe par un fichier `.env` (ignoré par git) : copier `.env.example` en `.env` et le remplir. Le code n'a aucune valeur par défaut (`src/config.ts`) : une variable manquante affiche une erreur explicite.

| Variable | Rôle |
|---|---|
| `SIGCHI_PROGRAM_LIST_URL` | Liste des conférences. |
| `SIGCHI_PROGRAM_URL` | Programme d'une conférence (gabarit avec `{shortName}` et `{year}`). |
| `SIGCHI_LOGIN_URL`, `SIGCHI_CLOUD_READ_URL`, `SIGCHI_APP_SIGNATURE`, `SIGCHI_CLIENT_ID` | Connexion avec un compte SIGCHI (optionnelle). Sans `SIGCHI_CLIENT_ID`, le bouton Log In est désactivé. |
| `SIGCHI_USER_TOKEN` | Optionnel, développement uniquement ; ignoré au build. |

Vite ne relit `.env` qu'au démarrage : redémarrer `npm run dev` après une modification.

## Déploiement

`.github/workflows/pages.yml` construit le site et le publie sur GitHub Pages à chaque push sur `main`. Il lit uniquement les secrets `SIGCHI_PROGRAM_LIST_URL` et `SIGCHI_PROGRAM_URL` : le site publié n'a pas de connexion SIGCHI, et aucun identifiant personnel n'y est inclus.

## Crédits

Logo SIGCHI, logos de conférence, police Montserrat (licence OFL) et fonctions de networking repris de [sigchi-networking-demo](https://github.com/AnranXu/sigchi-networking-demo).
