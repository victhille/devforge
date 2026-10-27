# Architecture

DevForge est une application Electron : un processus principal (Node.js) qui fait le travail, et une page React qui l'affiche. La page n'a accès ni au disque, ni au réseau, ni aux secrets : elle demande tout au processus principal.

## Dossiers

| Dossier | Rôle |
|---|---|
| `src/main/` | processus principal : fenêtres, mises à jour, services |
| `src/main/services/<domaine>/` | le travail d'un domaine (git, docker, ssh, database, assistant…) : fonctions testables, sans interface |
| `src/main/ipc/<domaine>.ts` | expose un service à la page : un `ipcMain.handle('domaine:action', …)` par appel |
| `src/preload/index.ts` | pont entre les deux : `window.devforge.<domaine>.<action>()` appelle le canal IPC correspondant |
| `src/renderer/src/` | la page React (Tailwind) : `app/` (routes, menu), `features/<page>/`, `components/`, `i18n/` |
| `src/shared/` | types et fonctions communs aux deux côtés (`types/`, `lib/`, `data/`) |
| `scripts/` | release, icônes, garde-fou des mots personnels, recherche dans l'historique |
| `tests/main`, `tests/renderer`, `tests/scripts` | tests Vitest (Electron est simulé : `tests/stubs/electron.ts`) |
| `tests/e2e/` | tests Playwright sur l'app compilée |

## Ajouter une fonction

1. Le service dans `src/main/services/<domaine>/`, avec ses tests dans `tests/main/`.
2. Le canal dans `src/main/ipc/<domaine>.ts` (enregistré dans `src/main/ipc/index.ts`).
3. Le type de l'API dans `src/shared/types/`, puis l'appel dans `src/preload/index.ts`.
4. L'interface dans `src/renderer/src/features/`, les textes dans `i18n/locales/fr.ts` **et** `en.ts`.
5. Une nouvelle page : une ligne dans `src/renderer/src/app/navigation.ts` (le menu, les routes et la palette en sont tirés). Une page qui n'a de sens qu'avec un serveur porte `needs: 'server'` : elle reste cachée du menu tant qu'aucun n'est configuré.

## Données

- Tout est dans le dossier de l'application (`%APPDATA%\DevForge`), en fichiers JSON : projets, serveurs, bases, réglages… La liste est `DATA_ENTRIES` dans `src/main/services/storage/migrations.ts`.
- Chaque écriture passe par un fichier temporaire puis un renommage (`src/main/lib/jsonFile.ts`) : un plantage ne laisse pas de fichier coupé.
- Le format porte un numéro (`storage.json`) ; les migrations tournent au démarrage, après une copie dans `backups/`.
- Paramètres › Données exporte la configuration sans les secrets, l'importe, ou efface tout (`src/main/services/storage/profile.ts`).

## Secrets

- Mots de passe, jetons et clés sont chiffrés par Windows (`safeStorage`), dans des champs `…Enc`.
- Ils ne repartent jamais vers la page : elle reçoit seulement « renseigné » ou « aucun ».
- Le journal (`logs/devforge.log`) masque ce qui ressemble à un secret.
- Rien de personnel dans le dépôt : `scripts/check-personal.mjs` fait échouer la CI si un mot de la liste privée (`PERSONAL_PATTERNS`) revient.

## Tests

| Commande | Ce qui tourne |
|---|---|
| `npm test` | Vitest : services, règles, composants |
| `npm run build` puis `npm run test:e2e` | Playwright : chaque test démarre l'app sur un profil vide, hors écran |
| `npm run check` | types, lint, Vitest, build (avant chaque release) |

Des variables d'environnement remplacent ce qui ne se teste pas en vrai (boîtes de dialogue, modèle d'IA, redémarrage) ; elles sont ignorées dans l'app installée (`app.isPackaged`).
