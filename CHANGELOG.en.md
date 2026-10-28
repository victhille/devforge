# Release notes

Every DevForge version. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), [SemVer](https://semver.org/) versions.

## [3.5.2](https://github.com/victhille/devforge/compare/v3.5.1...v3.5.2) — 2026-10-28

> Previews of .md files written on Windows no longer crash, clicking a group's card opens its page, and the Files tab gives all its room to the tree and the preview.

### Fixes

- **projets**: Aperçu des .md Windows, carte groupe cliquable, onglet Fichiers sans scripts ([b2c9f3e](https://github.com/victhille/devforge/commit/b2c9f3e4a0143e4e6f8245635e6ad1f8419f4d79))

_1 technical change(s) (tests, CI, repository docs) not listed._

## [3.5.1](https://github.com/victhille/devforge/compare/v3.5.0...v3.5.1) — 2026-10-28

> Tidier group cards listing the rest of the folder, file previews (Markdown, images, PDF), tables created and changed from the Database page, copy as JSON, a console that closes with its last tab.

### Fixes

- Retours d'essai de la 3.5.0 (v3.5.1) ([a6be2f6](https://github.com/victhille/devforge/commit/a6be2f6be02ab54a94ff0ea2db1466accfdc5732))

_1 technical change(s) (tests, CI, repository docs) not listed._

## [3.5.0](https://github.com/victhille/devforge/compare/v3.4.1...v3.5.0) — 2026-10-28

> All your projects, everywhere: several projects folders, nested projects as groups, detected or hand-added IDEs (one per project), help and examples in every tool, your own commands in the docs, greyed suggestions in the terminal.

### New features

- **terminal**: Suggestion grisée en fin de ligne (v3.5 lot 6) ([e074cf8](https://github.com/victhille/devforge/commit/e074cf8ff84f61ba6bbaa23d964a4ecb5cd8bad3))
- **doc**: Commandes perso, vérifiées et complétées (v3.5 lot 5) ([3c04008](https://github.com/victhille/devforge/commit/3c04008762b8e4f9ed417c113e38d520194ee612))
- **outils**: Aide et exemples dans la boîte à outils (v3.5 lot 4) ([c52e6ec](https://github.com/victhille/devforge/commit/c52e6ece30e51d836419e9adc084b321a683bd3a))
- **ide**: IDE détectés, ajoutés à la main et propres à chaque projet (v3.5 lot 3) ([fad61f7](https://github.com/victhille/devforge/commit/fad61f7559dffa407d99aff40a66b004ae0c64f8))
- **projets**: Projets imbriqués en groupes (v3.5 lot 2) ([3ac27d8](https://github.com/victhille/devforge/commit/3ac27d8baed2e58259e9933beb03f41a7690b7ed))
- **projets**: Plusieurs dossiers de projets (v3.5 lot 1) ([9ebfa42](https://github.com/victhille/devforge/commit/9ebfa428c851bf41a051fd337bde1bcaaf9d3c9e))

_1 technical change(s) (tests, CI, repository docs) not listed._

## [3.4.1](https://github.com/victhille/devforge/compare/v3.4.0...v3.4.1) — 2026-10-28

> Fixes: IDE button follows the setting, useful filters only, cleaner generated pages (separate CSS, account-aware welcome, organized React/Vue), plain Node with npm test, Symfony without a duplicate repository.

### Fixes

- **projets**: Correctifs 3.4.1 (IDE, filtres, pages générées) ([b407415](https://github.com/victhille/devforge/commit/b407415fb763591be0076fbf8d4d27ee7d497abe))

_1 technical change(s) (tests, CI, repository docs) not listed._

## [3.4.0](https://github.com/victhille/devforge/compare/v3.3.1...v3.4.0) — 2026-10-28

> A project that starts ready: a DevForge welcome page, plus sign-in, sign-up and one authentication API shared by Next.js, Laravel, Symfony, React and Vue.

### New features

- **projets**: Authentification React et Vue, client du contrat DevForge (v3.4 lot 6) ([fc8f135](https://github.com/victhille/devforge/commit/fc8f135628bc00be167fb03ccdb30a396c6b0997))
- **projets**: Authentification Symfony sur le contrat DevForge (v3.4 lot 5) ([82de044](https://github.com/victhille/devforge/commit/82de0449f9ffcc76f4317798be0701c531719a2c))
- **projets**: Authentification Laravel sur le contrat DevForge (v3.4 lot 4) ([955275b](https://github.com/victhille/devforge/commit/955275b4bb0d557d3feed11934e5d433a922cfda))
- **projets**: Authentification Next.js sur le contrat DevForge (v3.4 lot 3) ([5e5a1d3](https://github.com/victhille/devforge/commit/5e5a1d3156877cd81e99261f9d3e534d116f5571))
- **projets**: Contrat d'API d'authentification commun (v3.4 lot 2) ([96c73b2](https://github.com/victhille/devforge/commit/96c73b24daeeaa53e4da4de1e1eee8afa7b64757))
- **projets**: Page d'accueil DevForge à la création (v3.4 lot 1) ([faa8c88](https://github.com/victhille/devforge/commit/faa8c882205d0d889cb811f3c77008c806599994))

### Fixes

- **projets**: Dashboard Next.js compatible Cache Components, affichage de l'accueil ([5453597](https://github.com/victhille/devforge/commit/5453597ee7ed7a064264e514abca5945a5998e04))

_2 technical change(s) (tests, CI, repository docs) not listed._

## [3.3.1](https://github.com/victhille/devforge/compare/v3.3.0...v3.3.1) — 2026-10-27

> Sturdier project creation: .gitignore before the first commit, Tailwind 4 and Prisma 7 set up, main branch, a readable log and a resizable console.

### New features

- **console**: Console de création réglable, journal lisible, Laravel prêt à l'emploi ([bd92845](https://github.com/victhille/devforge/commit/bd928451052a2f28cbcb6da8e836a5abf9eac200))

### Fixes

- **projets**: Next.js crée son dépôt sur main et garde son propre Tailwind ([785a35a](https://github.com/victhille/devforge/commit/785a35a8d2493d406e659a7d655da052c0b67eed))
- **projets**: Création de projet et journal corrigés après les essais réels ([0834fa5](https://github.com/victhille/devforge/commit/0834fa5c0d39d769fd212798ee3520a970f4b7b6))

_1 technical change(s) (tests, CI, repository docs) not listed._

## [3.3.0](https://github.com/victhille/devforge/compare/v3.2.0...v3.3.0) — 2026-10-27

> The project page shows its database and its packages (npm, pnpm, yarn, Composer): outdated ones, vulnerabilities and chosen updates with rollback; Forgy can read and propose them too.

### New features

- **aide**: F1 sur l'onglet Paquets ouvre sa propre page de doc ([adbaea8](https://github.com/victhille/devforge/commit/adbaea87e7dc07d3e5098d44affae28e24ba38f9))
- **forgy**: Forgy tells what is outdated or vulnerable in a project, and proposes an update that can be undone ([f56c142](https://github.com/victhille/devforge/commit/f56c1422b148921d86210fc30ef7713c9fe47399))
- **paquets**: The Packages tab reads composer.json too: Packagist, composer audit, updates (in Sail when needed) ([5db213f](https://github.com/victhille/devforge/commit/5db213f4236c1c25ceb858a0d2201feb3752188b))
- **paquets**: Packages tab: outdated packages, vulnerabilities, chosen updates with rollback ([a8438d2](https://github.com/victhille/devforge/commit/a8438d259c7a7def7c3d11d78f516024996f277b))
- **projet**: The database shows in the project page, and the Database page leads back to the project ([3768ec3](https://github.com/victhille/devforge/commit/3768ec3c1024ad7aa4ffdccb89b34837eaa45235))

### Fixes

- **paquets**: A Composer advisory without a severity shows as "unrated" ([b3cd880](https://github.com/victhille/devforge/commit/b3cd8800c4d441f5c0b6eca38a2f066ee2e2115b))

_11 technical change(s) (tests, CI, repository docs) not listed._

## [3.2.0](https://github.com/victhille/devforge/compare/v3.1.0...v3.2.0) — 2026-10-27

> Each page opens its documentation ("?" button or F1), n8n and the ntfy alerts are set in Connections, no more French / English mix, and Forgy picks up ANTHROPIC_API_KEY.

### New features

- **connexions**: N8n and the ntfy alerts are set, tested and removed in Connections ([e2b7513](https://github.com/victhille/devforge/commit/e2b7513c150fc1dd88ce1275443969cb22bc8d54))
- **aide**: Each page's help on the website, one click or F1 away ([7eec232](https://github.com/victhille/devforge/commit/7eec23205114f98950adb48b983ff1c159eb1803))

### Fixes

- **langue**: Plus de mélange français / anglais, Forgy reconnaît ANTHROPIC_API_KEY ([cc6297f](https://github.com/victhille/devforge/commit/cc6297fd41f0663ff9777c07b93701b7f4f0aa14))

_12 technical change(s) (tests, CI, repository docs) not listed._

## [3.1.0](https://github.com/victhille/devforge/compare/v3.0.0...v3.1.0) — 2026-10-27

> The menu shows the pages that need a server (health, services, backups, n8n, status page, VPN) only once a server is set up; Settings › Connections opens without waiting.

### New features

- **menu**: Les pages qui demandent un serveur attendent qu'il y en ait un ([164329e](https://github.com/victhille/devforge/commit/164329ed10c2e0bd4863a1b714b63438000b690f))

### Dependencies and build

- **lint**: Les worktrees de .claude/ hors du lint ([630ba4a](https://github.com/victhille/devforge/commit/630ba4a7d5d72d256c71b02a032737a3b3615f55))

_7 technical change(s) (tests, CI, repository docs) not listed._

## [3.0.0](https://github.com/victhille/devforge/compare/v2.4.0...v3.0.0) — 2026-10-26

> DevForge goes public: nothing of the author inside, everything set up in Settings › Connections, a guided first launch, export, import and “Erase everything”.

### New features

- **données**: Tout effacer, exporter et importer sa configuration ([1bdf1b9](https://github.com/victhille/devforge/commit/1bdf1b90fc3dd52cef0834bfdd5b8ea3b5830989))
- **public**: Rien de personnel dans le logiciel ([4359fc9](https://github.com/victhille/devforge/commit/4359fc9c65e886801916a3c68fb7caddb59b249f))
- **premier-lancement**: Langue, comptes, pages « à configurer » ([03e838b](https://github.com/victhille/devforge/commit/03e838b74612b0fcb20d40d216538b58b8867933))
- **paramètres**: Section Connexions (comptes, clés, serveurs, bases) ([b5067ea](https://github.com/victhille/devforge/commit/b5067ea49e2b43c46f96045ac74ac9276476f4b6))
- **accueil**: Les cartes en Masonry ([3f4ab35](https://github.com/victhille/devforge/commit/3f4ab3518ea34359b7dc06c5525de7b055b99cec))

### Fixes

- **données**: La page vide sa mémoire elle-même avant de tout effacer ([cf439b6](https://github.com/victhille/devforge/commit/cf439b676b7bcbec36e1491753b10d6bad7e54b5))
- **connexions**: Sondes lentes gardées une minute, effacement qui n'attend plus Chromium ([672f4c0](https://github.com/victhille/devforge/commit/672f4c0b520724486b9d806414586f2c6fc46bfe))

### Dependencies and build

- **public**: Mises à jour sans jeton (dépôt public) ([5517213](https://github.com/victhille/devforge/commit/551721327f67c9dcb72932b3c0a405d9bc232107))

_4 technical change(s) (tests, CI, repository docs) not listed._

## [2.4.0](https://github.com/victhille/devforge/compare/v2.3.1...v2.4.0) — 2026-10-25

> New logo: DevForge mobile's orange anvil.

### New features

- **design**: Le logo de DevForge mobile (enclume orange), une seule flèche sur « Retour » ([99b557f](https://github.com/victhille/devforge/commit/99b557f2855e3067c122acd78254a156dfb90ae4))

_2 technical change(s) (tests, CI, repository docs) not listed._

## [2.3.1](https://github.com/victhille/devforge/compare/v2.3.0...v2.3.1) — 2026-10-25

> The first block of a cmd terminal no longer shows DevForge's internal command.

### Fixes

- **terminal**: L'écho de la commande retiré même après la bannière de cmd ([8b64691](https://github.com/victhille/devforge/commit/8b6469143217ad5471baa555d825dcf3f1286dfd))

## [2.3.0](https://github.com/victhille/devforge/compare/v2.2.0...v2.3.0) — 2026-10-25

> Laravel Sail, Auth.js and Prisma rollback in the workshops, Forgy in all three workshops, a Docker database of its own per project, exit codes in cmd.

### New features

- **forgy**: Forgy dans les ateliers Laravel et Next.js ([da54d26](https://github.com/victhille/devforge/commit/da54d26781151d6ee04bb7caa3897cecd5b62c14))
- **laravel**: Sail à la création et dans l'atelier ([3f052d9](https://github.com/victhille/devforge/commit/3f052d9d5e5a1d4508d00e4b326487e2eae1a5e1))
- **nextjs**: Auth.js dans l'atelier (GitHub, Google, e-mail) ([f9fc632](https://github.com/victhille/devforge/commit/f9fc632a60536ad43d2d83138534882f0aa0f066))
- **nextjs**: Revenir en arrière sur une migration Prisma ([59bd03d](https://github.com/victhille/devforge/commit/59bd03d9c78f4de882f5070ed15df77b0a2b7fb5))
- **terminal**: Code de retour dans cmd, shells gardés sur la page projet ([98d2976](https://github.com/victhille/devforge/commit/98d2976dc08ea58e4f9065092b72ef7b8d6a9a2c))
- **projets**: Une base Docker propre à chaque projet ([b447a6b](https://github.com/victhille/devforge/commit/b447a6b6fa8acaf58ba762a63a425c9fd5ee56ff))

_1 technical change(s) (tests, CI, repository docs) not listed._

## [2.2.0](https://github.com/victhille/devforge/compare/v2.1.0...v2.2.0) — 2026-10-25

> Complete projects from creation, Symfony, Laravel and Next.js workshops, global launcher, status page and block terminal.

### New features

- **ateliers**: Ateliers Laravel et Next.js ([1ce2c5f](https://github.com/victhille/devforge/commit/1ce2c5f8cef904b17709189ac63472e5f97e9862))
- **terminal**: Terminal en blocs ([3880478](https://github.com/victhille/devforge/commit/38804783dc36c7f847d058e3ef6805822cfcb465))
- **statut**: Page de statut et surveillance 24 h/24 depuis le VPS ([9870658](https://github.com/victhille/devforge/commit/9870658ede57a0cd63de5db0eb7a859e5018ac63))
- **lanceur**: Lanceur global sur Ctrl+Alt+Espace ([928b6d2](https://github.com/victhille/devforge/commit/928b6d200eb0e86afa25563bb8ae1de10a23696d))
- **symfony**: Atelier Symfony dans la page projet ([5149fea](https://github.com/victhille/devforge/commit/5149fea56d18da6d649aeda01eb1f0bac0ccd441))
- **projets**: Création enrichie (base, options, Git et GitHub) ([a30dec7](https://github.com/victhille/devforge/commit/a30dec712e695c4750eae4bbfb545b3cbfd2c6c2))

### Fixes

- **statut**: Retours de la première installation sur le VPS ([935d407](https://github.com/victhille/devforge/commit/935d40726ac9586804cd117f04b238f255762321))

_2 technical change(s) (tests, CI, repository docs) not listed._

## [2.1.0](https://github.com/victhille/devforge/compare/v2.1.0-beta.4...v2.1.0) — 2026-10-24

> DevForge 2.1: your VPS under control (one-click services, health, nightly backups), a Home you compose, a palette that acts, compact mode, synced .env files, GitHub on the project page, Automations on Home, Forgy watching it all, updates that arrive on their own and a tidier menu.

### New features

- **menu**: 6 groupes de 5 pages au plus ([dbc525c](https://github.com/victhille/devforge/commit/dbc525c9f2648a01582f5edc921981726f500bb2))

## [2.1.0-beta.4](https://github.com/victhille/devforge/compare/v2.1.0-beta.3...v2.1.0-beta.4) — 2026-10-23

> Your Automations automations show on DevForge's Home page, and Forgy can read their feed.

### New features

- **automations**: Widget Automatisations et lecture du flux par Forgy ([390197b](https://github.com/victhille/devforge/commit/390197b95e84b73c7df52c83a36d00978ff9b619))

## [2.1.0-beta.3](https://github.com/victhille/devforge/compare/v2.1.0-beta.2...v2.1.0-beta.3) — 2026-10-23

> Updates finally arrive on their own: DevForge reads the releases with your GitHub CLI sign-in, and the Update button shows next to Forgy.

### Fixes

- **updates**: Lire les versions du dépôt privé avec le jeton de GitHub CLI ([6acd991](https://github.com/victhille/devforge/commit/6acd991259630b75e3537d089ca73da6eb043643))

## [2.1.0-beta.2](https://github.com/victhille/devforge/compare/v2.1.0-beta.1...v2.1.0-beta.2) — 2026-10-23

> Nightly VPS backups with a copy on the PC, a Home page you compose, a palette that acts, compact mode, .env synced with the server, GitHub on the project page, and Forgy watching the VPS.

### New features

- Synchronisation des .env, GitHub sur la page projet, Forgy plus complet ([60e8d8f](https://github.com/victhille/devforge/commit/60e8d8f89fbc4147dbb93e66d4f1295be032f118))
- **home**: Accueil personnalisable, palette avec actions, mode compact ([8571469](https://github.com/victhille/devforge/commit/857146922120f81d634061a91f99029aee846f5e))
- **backups**: Sauvegardes automatiques du VPS ([e88a02f](https://github.com/victhille/devforge/commit/e88a02fc07f112731a74af9da96150e847da60c7))

## [2.1.0-beta.1](https://github.com/victhille/devforge/compare/v2.0.0...v2.1.0-beta.1) — 2026-10-22

> An Update button next to Forgy, and your VPS under control: its web services open in one click, and a Health page points out what needs your attention.

### New features

- **vps**: Bouton Mise à jour, services et santé du VPS ([683dc98](https://github.com/victhille/devforge/commit/683dc9865731806b27fa97f5feb82511adcceac2))

### Fixes

- **i18n**: Pas de texte vide pour les niveaux de santé impossibles ([340d276](https://github.com/victhille/devforge/commit/340d2769069eeda3eb450c03e046ae0798ed931c))

_1 technical change(s) (tests, CI, repository docs) not listed._

## [2.0.0](https://github.com/victhille/devforge/compare/v2.0.0-beta.5...v2.0.0) — 2026-10-22

> DevForge 2.0: Forgy acts for you, n8n installs and runs on your VPS (French editor too), a VPN page for WireGuard, Vercel, local voice typing, and settings and a menu shaped your way.

### New features

- **menu**: Favoris du menu au choix ([d7c8c5b](https://github.com/victhille/devforge/commit/d7c8c5b7641a375fa96b2101b260a743a25a691f))

### Fixes

- **ssh**: Requêtes HTTP par la session SSH (wg-easy 408, clé d'API n8n) ([e3b715e](https://github.com/victhille/devforge/commit/e3b715eed9488c509a7195c0a625a67e9d314ae7))

## [2.0.0-beta.5](https://github.com/victhille/devforge/compare/v2.0.0-beta.4...v2.0.0-beta.5) — 2026-10-22

> New VPN page: the VPS's WireGuard clients, with add, delete and QR codes, no command line needed.

### New features

- **vpn**: Page VPN pour le WireGuard du VPS (wg-easy) ([3c29da6](https://github.com/victhille/devforge/commit/3c29da697c834abbbd85006a0ff3d76573b70399))

### Fixes

- **ui**: Sélecteurs alignés avec les boutons, version au-dessus de « Réduire le menu » ([c91b062](https://github.com/victhille/devforge/commit/c91b062c04374ccf6ccd104f32f7c99821fbf3a6))

_2 technical change(s) (tests, CI, repository docs) not listed._

## [2.0.0-beta.4](https://github.com/victhille/devforge/compare/v2.0.0-beta.3...v2.0.0-beta.4) — 2026-10-20

> n8n opens only once its editor is ready: no more "Cannot GET /" right after a start.

### Fixes

- **n8n**: Attendre l'éditeur avant d'annoncer que n8n est prêt ([f8ca814](https://github.com/victhille/devforge/commit/f8ca814c14960f1b659fa26389ee7831e2e4d671))

## [2.0.0-beta.3](https://github.com/victhille/devforge/compare/v2.0.0-beta.2...v2.0.0-beta.3) — 2026-10-20

> n8n can show its editor in French: an option on the n8n page uses the community translation, rebuilt for every n8n version.

### New features

- **n8n**: Interface de n8n en français ([88de1d7](https://github.com/victhille/devforge/commit/88de1d709db84827f150840981ee18ab28709056))

## [2.0.0-beta.2](https://github.com/victhille/devforge/compare/v2.0.0-beta.1...v2.0.0-beta.2) — 2026-10-20

> n8n opens from DevForge with no command, and the domain is checked before the install.

### Fixes

- **n8n**: N8n opens from DevForge with no command, the sub-domain is checked before an HTTPS install, and the old Caddy is removed ([54b4266](https://github.com/victhille/devforge/commit/54b426690b49b60dc0b4b4a449de44a23bbb5f6e))

## [2.0.0-beta.1](https://github.com/victhille/devforge/compare/v1.5.0...v2.0.0-beta.1) — 2026-10-20

> DevForge 2.0: Forgy acts, one page per project, a watched VPS, n8n and Vercel.

### New features

- Whisper voice typing on your PC, a guided first launch, better accessibility (keyboard, contrast) and CPU of Docker services ([7e27bce](https://github.com/victhille/devforge/commit/7e27bce849d3ea1ecfc706fdfb29f1ac1c5726c8))
- Redesigned settings and release notes, a "What's new" window, n8n installed and followed on the VPS, Vercel deployments on the project page ([11ca027](https://github.com/victhille/devforge/commit/11ca027a7ef4906386caa707d187989503206aa7))
- **monitor**: Background VPS watch with 7 days of history, 24 h charts, alerts, and Docker on the VPS ([4a99ccf](https://github.com/victhille/devforge/commit/4a99ccf291ba06ae0d039cf8452bd96b6c1d89a6))
- **projects**: Project page gathering Git, Docker, variables, databases, logs, ports and deploy, with an active project followed by Forgy and the home page ([16d1df4](https://github.com/victhille/devforge/commit/16d1df41c951df9b94c4af1d22c442ffb0be65e7))
- **assistant**: Forgy can act: commit, Compose, SQL, ports, scripts, .env variables, always after your approval, with a journal and undo ([514e07b](https://github.com/victhille/devforge/commit/514e07bfb3251ec199cb0a3505030cd59dda6ff7))
- V2 groundwork: versioned and backed-up data, local log with a diagnostic report, beta channel, reviewed light theme ([3d02955](https://github.com/victhille/devforge/commit/3d029554b07e9ebd258cfe21447e26071afe99ca))

## [1.5.0](https://github.com/victhille/devforge/compare/v1.4.1...v1.5.0) — 2026-10-19

> DevForge gets a new look: a redesigned menu, a lively home page, and Forgy strolling with Boulon.

### New features

- New design: reworked menu, live home page, Forgy panel, redone pages, Forgy strolls with Boulon and a desktop widget ([aaa9095](https://github.com/victhille/devforge/commit/aaa909513fd2a3afd8829534915705f7f90daefa))

## [1.4.1](https://github.com/victhille/devforge/compare/v1.4.0...v1.4.1) — 2026-10-18

> A smoother app, especially while it runs in the background.

### Performance

- Smoother app: the mascot costs nothing at rest, faster Git and Docker pages ([3e70743](https://github.com/victhille/devforge/commit/3e70743fd41ae7b187b584646d1775afc181d024))

## [1.4.0](https://github.com/victhille/devforge/compare/v1.3.0...v1.4.0) — 2026-10-18

> Meet Forgy, the assistant that knows your project and the page you are on.

### New features

- **assistant**: Web search in the assistant (with sources) and shortcuts to Claude Code, Codex, Antigravity, Gemini and the web apps ([1ec40c3](https://github.com/victhille/devforge/commit/1ec40c3dae6ff5c2c5f50cb4af44d5a47bc659e4))
- **assistant**: Forgy, the assistant's little robot, shows what it is doing (thinking, searching, writing, done…) ([e5713a7](https://github.com/victhille/devforge/commit/e5713a7dd1e1231dccebb326f527745f5930e6f8))
- **assistant**: Ready-made tasks and cost control for the assistant (right model per task, monthly budget) ([7ff3773](https://github.com/victhille/devforge/commit/7ff3773c4a3bf4e52ffcb21b09bb597f41909a98))
- **assistant**: Built-in AI assistant (Ctrl+J) that knows the project and the current page, read-only ([700a03e](https://github.com/victhille/devforge/commit/700a03e47f357844179a3d250c8134917da61ee2))

### Fixes

- **settings**: "See what's new" also opens the notes when already on the Settings page ([a304117](https://github.com/victhille/devforge/commit/a3041176cbd940fb871f72dca43600e3a3f53557))

_1 technical change(s) (tests, CI, repository docs) not listed._

## [1.3.0](https://github.com/victhille/devforge/compare/v1.2.2...v1.3.0) — 2026-10-18

> The API Tester now previews HTML pages.

### New features

- **api-tester**: HTML response preview and response headers tab in the API tester ([f9b5e0e](https://github.com/victhille/devforge/commit/f9b5e0eed7a1f658a4a1235645bef73750284571))

## [1.2.2](https://github.com/victhille/devforge/compare/v1.2.1...v1.2.2) — 2026-10-18

### Fixes

- **i18n**: The update message and app startup follow the selected language ([4c21e30](https://github.com/victhille/devforge/commit/4c21e30e4e440e40f5a17b94120b63206843352d))

## [1.2.1](https://github.com/victhille/devforge/compare/v1.2.0...v1.2.1) — 2026-10-18

### Fixes

- **release**: Release notes in the app language (French or English) ([1fed93c](https://github.com/victhille/devforge/commit/1fed93c651af7a415e54f135f3488cebb14e4a9a))

_2 technical change(s) (tests, CI, repository docs) not listed._

## [1.2.0](https://github.com/victhille/devforge/compare/v1.1.0...v1.2.0) — 2026-10-18

### New features

- **releases**: Versioning with conventional commits, changelog and GitHub releases ([20f2137](https://github.com/victhille/devforge/commit/20f2137342509a07a9dca14610b3884a63079ec9))
- Database explorer like phpMyAdmin, collapsible connections panel ([366a147](https://github.com/victhille/devforge/commit/366a147c24a6c8b3f88829af9276e8ddb25f9a9c))
- **database**: Handle connections dropped by the server ([77e7c64](https://github.com/victhille/devforge/commit/77e7c6418eedcf777b2e741fdc08c4547b89cf40))
- **docker**: Show compose services as tags, linked DevForge project as a caption ([08b73ee](https://github.com/victhille/devforge/commit/08b73ee05b82bf1a6e117207018c955d28c408dc))
- **docker**: Start compose projects from DevForge, safer clean-up, compose-aware DB detection ([19ef439](https://github.com/victhille/devforge/commit/19ef439ec668eb219553079f14711d943ed1f29c))
- **database over SSH**: Also try the server's public address from the server ([5a6c7e8](https://github.com/victhille/devforge/commit/5a6c7e82a50afedaf9130c59f7cc63ddc41cd864))
- **database over SSH**: Find the database on the server when its address fails ([35c20b3](https://github.com/victhille/devforge/commit/35c20b3862ccadeca03074ad497825a489b2fd91))
- **database**: Reach DBs hosted on a saved SSH server through an SSH tunnel ([9fbbb46](https://github.com/victhille/devforge/commit/9fbbb46c765ffa138322f46efce3479f12c27523))
- Sandbox renderer, add CSP, route API tester through main process ([62db7bd](https://github.com/victhille/devforge/commit/62db7bdad5be4354d02d2f41e83e28d7715ecc6a))

### Security

- Verify SSH server keys (trust on first use) ([24bfc8e](https://github.com/victhille/devforge/commit/24bfc8e9fa5c7c44e35bb40bbde479218b4b1e15))
- No shell injection through paths, URLs or script names ([5129c57](https://github.com/victhille/devforge/commit/5129c5747cf25b02ea198e1217f67ef5f9a3e061))

### Fixes

- Tests, lint and CI; fix bugs they found ([e363c5f](https://github.com/victhille/devforge/commit/e363c5f5553d0473ccc99cbcec739ac66d5067f9))
- Fix remote detection scripts: quote them for the remote shell ([9076848](https://github.com/victhille/devforge/commit/9076848068937ffac62f110a58f8c351003b99b2))

### Dependencies and build

- Upgrade Electron 29 -> 44.5.1 and electron-builder 26 ([ad0e114](https://github.com/victhille/devforge/commit/ad0e114ee7cf6c939598138de10767c61b7a1b1f))

## 1.1.0 — 2026-10-17

### New features

- One domain suggestion per project even with several dev servers ([a6ff66d](https://github.com/victhille/devforge/commit/a6ff66d56390880107ad65ab187fd0cba735ac72))
- Detect deployed projects on a server and create deploy targets ([872866a](https://github.com/victhille/devforge/commit/872866a17fc0f2c76ea43a3733c784959341e01c))
- Suggest log files, monitor URLs and local domains from projects ([7fead84](https://github.com/victhille/devforge/commit/7fead8445c6719a71c7cd3aa5afd9d3b552ecc03))
- **database**: SSH tunnels, server detection and .env import ([20d9247](https://github.com/victhille/devforge/commit/20d9247ee2b4e3eb2afe8c6e69176c2fb31e61a4))
- Collapsible sidebar (icons only, Ctrl+B) and SSH servers panel ([5fa8e5e](https://github.com/victhille/devforge/commit/5fa8e5e30f217ac388dd0f9bcbd9793ad3ae565d))
- Remove duplicated '+' from labels that already have an icon ([65d5fa0](https://github.com/victhille/devforge/commit/65d5fa08a5a785e55721fc5de78ff8a5603eac27))
- Add cron, timestamp and URL tools to the toolbox ([4596521](https://github.com/victhille/devforge/commit/4596521ef667fed2b8572c6b93c5fac2dce35275))
- Add webhook tester ([a6ad7c2](https://github.com/victhille/devforge/commit/a6ad7c24b3f11bbcb8c9bbdc822cca7f1e70144a))
- Add live log file viewer ([9c4dc6a](https://github.com/victhille/devforge/commit/9c4dc6aa9f707b72ad844262818f36eedda5aeac))
- Add database client (PostgreSQL, MySQL/MariaDB, SQLite) ([c4d2f2a](https://github.com/victhille/devforge/commit/c4d2f2a34336893fc1171e43ae0506b060251b5a))
- Add local domains (.test) with a built-in reverse proxy ([4e22a33](https://github.com/victhille/devforge/commit/4e22a336e1613f81d9aff8578c8af95e456febd8))
- Add background URL monitoring ([3879966](https://github.com/victhille/devforge/commit/38799668e8fc396a609d4f5b98d45732f6f308b0))
- Add one-click deploy over SSH ([982e9d3](https://github.com/victhille/devforge/commit/982e9d39d5dcdc4eb2080b8f06bfed563beb4017))
- Add local Docker panel ([3fc43a6](https://github.com/victhille/devforge/commit/3fc43a629384d6ada0c3d268485692257559c509))
- Add commit assistant and a page error boundary ([f681b22](https://github.com/victhille/devforge/commit/f681b22a8f40ead8fdf0c0b3c5aca27afb9d3367))
- Add stack launcher ([10d1e72](https://github.com/victhille/devforge/commit/10d1e72943b43438e72f2816a373a1a5e5574b84))
- Add .env manager and project runtime version checks ([f3fcd19](https://github.com/victhille/devforge/commit/f3fcd19948fe569d7cbcb34aa48f4fa04eacbbe5))
- Add disk cleaner and regroup the sidebar ([b99cc85](https://github.com/victhille/devforge/commit/b99cc8587b0a63316b8a976cb687b340866f1277))
- Add multi-project Git dashboard and toast notifications ([b4ec602](https://github.com/victhille/devforge/commit/b4ec60296538d18c5e0dabb9f2d4b6ce61cb6ea2))
- Add command palette (Ctrl+K) and a single navigation registry ([dbaf952](https://github.com/victhille/devforge/commit/dbaf9525b12338664357b1b40b38254ff0570ab1))
- Make main process non-blocking, lazy-load pages, roomier UI ([fe61b89](https://github.com/victhille/devforge/commit/fe61b8958c328d28bbb1960626a8d3a0eafa4749))
- Encrypt SSH passwords with safeStorage, remove unused CreationConsole ([97db1de](https://github.com/victhille/devforge/commit/97db1de791f3fb4ca376a07182bf2aa88aba8c53))
- Initial DevForge state ([71ed165](https://github.com/victhille/devforge/commit/71ed16524431040ae8cee493854c988c7f27c0fc))

### Fixes

- Fix log suggestion path display on Windows ([838ed1e](https://github.com/victhille/devforge/commit/838ed1e1a1fae51b308d521169b76aef3c2c54a2))
- Fix text-base color clash, redesign nav, tabs and buttons ([e07462f](https://github.com/victhille/devforge/commit/e07462f6b6fe7ea96dca2a858fcf19067163fed4))

### Internal improvements

- Convert remaining CRLF files to LF ([fa11155](https://github.com/victhille/devforge/commit/fa11155b8c3bf82c5f191079446294a1a4708a5b))
- Normalize line endings to LF (.gitattributes) ([2ac70ce](https://github.com/victhille/devforge/commit/2ac70ce194686322b7b7b7d2a48aba72e702ed1b))
- Silence expected git stderr in getGitStatus ([2f8ee4d](https://github.com/victhille/devforge/commit/2f8ee4d95d003b7f7be7e3e5b313a66009862b1a))
- Move UI to Tailwind v4 and split large files ([bff973b](https://github.com/victhille/devforge/commit/bff973bfd88c482bbc894c42021049e72b708d95))
- Restructure project into feature-based architecture ([7a8ef9c](https://github.com/victhille/devforge/commit/7a8ef9cc301a3d2bd5ff389d4e52689ada280937))
