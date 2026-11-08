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

### Données gardées et actualisées

Les listes lues par beaucoup de pages (projets, connexions de base, modèles d'un projet) passent par `useLive` (`src/renderer/src/lib/live.ts`) :

- gardées en mémoire une fois lues : une page qui revient les montre tout de suite, puis les relit en arrière-plan quand elles ont plus de 10 s ;
- deux pages qui les demandent en même temps ne font qu'une requête ;
- quand le processus principal les écrit (une page, Forgy, un import), il envoie `data:changed` avec un sujet (`dataChanged('projects')`, `'db-connections'`, `'models'` avec le chemin du projet ; `src/main/lib/changes.ts`) : les pages qui les montrent les relisent aussitôt, les autres à leur prochaine visite.

Pour une nouvelle liste : un sujet dans `DataTopic` (`src/shared/types/index.ts`), `dataChanged(sujet)` dans la fonction du service qui écrit, et un hook `useLive(clé, lecture, { topic })` (voir `src/renderer/src/hooks/useLiveData.ts`). Pas pour ce qu'on est en train de saisir (les notes, un modèle ouvert) : la relecture écraserait la saisie.

## Interface

Une page se construit avec les composants de `src/renderer/src/components/ui/` plutôt qu'à la main : c'est ce qui la fait ressembler aux autres, dans les deux thèmes et en densité compacte.

| Besoin | Composant |
|---|---|
| Un bouton, une icône cliquable | `Button` (`primary` orange pour l'action principale, `secondary`, `ghost`, `danger` ; `sm` 30 px, `md` 36 px, `lg` 44 px), `IconButton` (28 ou 32 px) |
| Un mot ou une valeur dans une pastille | `Badge` (`color`, `dot` ; `mono` pour une valeur technique : framework, version, langage, code HTTP) |
| Une touche ou un raccourci | `Kbd` |
| Un message dans la page (conseil, alerte, erreur) | `Notice` (`tone` : neutral, info, success, warning, danger ; `live` s'il arrive après une action, `role` pour en garder un) |
| Une lecture qui a échoué | `ErrorState` (avec `onRetry`) — jamais un spinner qui tourne sans fin |
| Une liste vide | `EmptyState` (une ligne dans un cadre pointillé : l'icône, ce qui manque, l'action) |
| L'état d'un service, d'un conteneur, d'un serveur | `StatusDot` (`on`, `off`, `warn`, `error`, `unknown` ; `live` pour la pulsation) |
| La sortie d'une commande | `LogBox` |
| Une question avant une suppression | `await confirmDialog(message, { danger: true })` (`src/renderer/src/app/ConfirmContext.tsx`), jamais `window.confirm` |
| Des onglets | `Tabs` (`variant` : `segmented` ou `underline`) |
| Une liste à côté de son contenu | `SplitPane` (la liste passe au-dessus quand la page est étroite) |
| Le champ de recherche d'une liste | `SearchInput` |
| Le titre d'une page | `PageHeader` (titre en `font-display`, sous-titre, actions à droite, `crumb` au-dessus pour le groupe ou le serveur : « Serveurs · vps-demo ») ; `CardTitle` pour une carte (aussi en `font-display`), `SectionTitle` au-dessus d'un groupe de cartes |
| Des compteurs en haut d'une page | `Stat` dans une `StatRow` (l'intitulé, puis la valeur en grand en `font-display` ; `tone` seulement quand il y a quelque chose à voir, `unit` pour les petits mots après) |
| Un tableau de données | `Table`, `Th`, `Td` (en-têtes de 34 px, lignes de 42 px séparées d'un trait, la ligne survolée éclairée ; `align="right"` pour les nombres et les actions) |

Une logique servie à deux endroits se met dans un hook ou un module commun, pas en double : le commit (fichiers cochés, message, commit et push) dans `features/git/useCommit.ts`, pour l'onglet Fichiers et Git de la fiche et la fenêtre de la page Git ; l'arbre « Ce qui sera créé » de l'assistant dans `src/shared/data/projectTrees.ts` (avec `drawTree`, testé).

Les valeurs viennent du thème (`src/renderer/src/styles/index.css`) :

- couleurs : `bg-surface`, `text-fg-muted`, `bg-danger-soft`… ; sur un fond plein, `text-accent-fg`, `text-danger-fg`, `text-success-fg` ou `text-forgy-fg`, jamais `text-white` ; avec le thème « Forge » (graphite chaud), l'accent est l'orange de Forgy et une information se dit en bleu (`text-info`, `bg-info-soft`) ;
- polices embarquées dans l'appli (`@fontsource-variable`, rien n'est chargé en ligne) : Inter pour le texte (`font-sans`), JetBrains Mono pour le code, les chemins, les ports et les raccourcis (`font-mono`), Bricolage Grotesque pour les titres (`font-display`) ;
- une page dessinée aux mesures de la maquette porte la classe `df-mockup` (fiche projet, assistant de création) : une unité Tailwind y vaut 4 px (3,36 px en densité compacte) au lieu de 3,25 px, pour reprendre les mesures de la maquette telles quelles ;
- tailles de texte de l'échelle 11 / 12 / 13 / 14 / 16 / 20 / 28 / 34 (`text-xs` à `text-xl`, `text-page` pour un titre de page, `text-hero` pour l'accueil, `text-2xs` pour une touche ou un compteur) et espacements Tailwind (`px-4.5` = 18 px) : une valeur en pixels (`text-[13px]`) ne suit pas la densité compacte ;
- quatre rayons : `rounded-md` 6 px (badge), `rounded-control` 10 px (bouton, champ, comme `rounded-lg`), `rounded-card` 14 px (carte, comme `rounded-xl`), `rounded-window` 18 px (fenêtre) ;
- le cadre (`components/layout/`) : barre de titre de 44 px, rail d'icônes de 64 px (Accueil, les six groupes, Paramètres en bas) et panneau du groupe de 220 px, replié par Ctrl+B ; il garde sa taille en densité compacte et se construit depuis `app/navigation.ts` (`RAIL`, `MENU_GROUPS`, `railOf`, `railCurrent`), comme le routeur et la palette ; le panneau liste aussi des projets avec l'état de leur dépôt (`components/layout/PanelProjects.tsx`) et, sur les Paramètres, leurs sections, prises dans `features/settings/sections.ts` comme la page ;
- une couleur de marque trop pâle pour le fond blanc prend `paleClass(couleur)` (`src/renderer/src/lib/brand.ts`), assombrie en thème clair seulement ;
- le terminal reste sombre dans les deux thèmes : `bg-term`, `text-term-fg`…, et la palette `XTERM_THEME` (`src/renderer/src/features/terminal/snapshot.ts`) ;
- le code d'un aperçu de fichier prend les couleurs `--syntax-*` de la maquette (mots-clés orange, chaînes vertes, nombres ambre, fonctions bleues) ; les diagrammes de la Modélisation ont les leurs, `--diagram-*`, pour ne pas se confondre avec l'orange d'une sélection ;
- icônes `lucide-react` : 16 pour un outil d'une barre, 14 dans un bouton à icône (`IconButton`), 13 dans un bouton avec texte ou une ligne, 20 dans un état vide (`EmptyState` la ramène à cette taille) ;
- un menu qui se replie à la main et aussi quand la page est étroite (SSH) : `useNarrow` (`src/renderer/src/hooks/useNarrow.ts`) ; sinon une requête de conteneur suffit (`SplitPane`, menus des Paramètres, de Docker, de Laravel et de Next).

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
