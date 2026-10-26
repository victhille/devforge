# Release notes

Every DevForge version. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), [SemVer](https://semver.org/) versions.

## [3.0.0](https://github.com/victhille/devforge/compare/v2.4.0...v3.0.0) — 2026-10-26

> DevForge goes public: nothing of the author inside, everything set up in Settings › Connections, a guided first launch, export, import and “Erase everything”.

### New features

- **données**: Tout effacer, exporter et importer sa configuration ([3e17d3a](https://github.com/victhille/devforge/commit/3e17d3a25adff7c41138332d743ab70b79ff63d6))
- **public**: Rien de personnel dans le logiciel ([7b0b5cb](https://github.com/victhille/devforge/commit/7b0b5cb35d358d3831797e562926a34a920b1a3b))
- **premier-lancement**: Langue, comptes, pages « à configurer » ([ceb4280](https://github.com/victhille/devforge/commit/ceb42805fd3e3ead56972a32b2bf3a5e000a7dcb))
- **paramètres**: Section Connexions (comptes, clés, serveurs, bases) ([fb2c0b0](https://github.com/victhille/devforge/commit/fb2c0b03148ce6c27730afd251f882cc8ab18f9e))
- **accueil**: Les cartes en Masonry ([93b951f](https://github.com/victhille/devforge/commit/93b951f58e6a91dfbe1e87b342f4f8ab11894056))

### Fixes

- **données**: La page vide sa mémoire elle-même avant de tout effacer ([1746306](https://github.com/victhille/devforge/commit/17463069a1f2dc75289a08afb0162f4aa8110ba6))
- **connexions**: Sondes lentes gardées une minute, effacement qui n'attend plus Chromium ([89da203](https://github.com/victhille/devforge/commit/89da203a037fb0a45130edda5fd1fcf6d7e368ee))

### Dependencies and build

- **public**: Mises à jour sans jeton (dépôt public) ([f5f990a](https://github.com/victhille/devforge/commit/f5f990aa972da2728775ff362162f13402cc28a2))

_4 technical change(s) (tests, CI, repository docs) not listed._

## [2.4.0](https://github.com/victhille/devforge/compare/v2.3.1...v2.4.0) — 2026-10-25

> New logo: DevForge mobile's orange anvil.

### New features

- **design**: Le logo de DevForge mobile (enclume orange), une seule flèche sur « Retour » ([998e489](https://github.com/victhille/devforge/commit/998e4891da13ca95c56b7bb9c75b67162787b3c9))

_2 technical change(s) (tests, CI, repository docs) not listed._

## [2.3.1](https://github.com/victhille/devforge/compare/v2.3.0...v2.3.1) — 2026-10-25

> The first block of a cmd terminal no longer shows DevForge's internal command.

### Fixes

- **terminal**: L'écho de la commande retiré même après la bannière de cmd ([9ba95ad](https://github.com/victhille/devforge/commit/9ba95ad2b7575a6eec167965384a56857c750406))

## [2.3.0](https://github.com/victhille/devforge/compare/v2.2.0...v2.3.0) — 2026-10-25

> Laravel Sail, Auth.js and Prisma rollback in the workshops, Forgy in all three workshops, a Docker database of its own per project, exit codes in cmd.

### New features

- **forgy**: Forgy dans les ateliers Laravel et Next.js ([be31e09](https://github.com/victhille/devforge/commit/be31e09dd6e4250381814bbc4e6c41b69b10e6f9))
- **laravel**: Sail à la création et dans l'atelier ([7af9319](https://github.com/victhille/devforge/commit/7af931997818e34ff8dca03c38be9dcb35edd339))
- **nextjs**: Auth.js dans l'atelier (GitHub, Google, e-mail) ([e6424fb](https://github.com/victhille/devforge/commit/e6424fbfaec6bab13d1b10e5f21e9c48d7e1112a))
- **nextjs**: Revenir en arrière sur une migration Prisma ([70d397a](https://github.com/victhille/devforge/commit/70d397afa2f254f3ed4e561a34741038cada824f))
- **terminal**: Code de retour dans cmd, shells gardés sur la page projet ([f39d4f0](https://github.com/victhille/devforge/commit/f39d4f06422b50ef92f08fd9f0e9072d052208d5))
- **projets**: Une base Docker propre à chaque projet ([fe2dfc2](https://github.com/victhille/devforge/commit/fe2dfc262d791c1e83af28278aadb17934571680))

_1 technical change(s) (tests, CI, repository docs) not listed._

## [2.2.0](https://github.com/victhille/devforge/compare/v2.1.0...v2.2.0) — 2026-10-25

> Complete projects from creation, Symfony, Laravel and Next.js workshops, global launcher, status page and block terminal.

### New features

- **ateliers**: Ateliers Laravel et Next.js ([d03fa05](https://github.com/victhille/devforge/commit/d03fa050c7c5aa8b6ad6be18abe4efa60d208fc8))
- **terminal**: Terminal en blocs ([02bf360](https://github.com/victhille/devforge/commit/02bf360fe6acbfe37df19f5be810c4954697631d))
- **statut**: Page de statut et surveillance 24 h/24 depuis le VPS ([5c1e944](https://github.com/victhille/devforge/commit/5c1e9443b8e29e77a8f0e03d4bbb964accce6bcc))
- **lanceur**: Lanceur global sur Ctrl+Alt+Espace ([ab2eace](https://github.com/victhille/devforge/commit/ab2eace99cc3c7539c0cfcc117993ee46f551338))
- **symfony**: Atelier Symfony dans la page projet ([8eaf177](https://github.com/victhille/devforge/commit/8eaf177aec3c854687ce9ba3fb1a2b3a89955358))
- **projets**: Création enrichie (base, options, Git et GitHub) ([00f79cd](https://github.com/victhille/devforge/commit/00f79cdaa052ad2d119f16b8fecf4b503f731c78))

### Fixes

- **statut**: Retours de la première installation sur le VPS ([b34cf94](https://github.com/victhille/devforge/commit/b34cf944a22ab70d9c72074679f767b688f6cb8f))

_2 technical change(s) (tests, CI, repository docs) not listed._

## [2.1.0](https://github.com/victhille/devforge/compare/v2.1.0-beta.4...v2.1.0) — 2026-10-24

> DevForge 2.1: your VPS under control (one-click services, health, nightly backups), a Home you compose, a palette that acts, compact mode, synced .env files, GitHub on the project page, Automations on Home, Forgy watching it all, updates that arrive on their own and a tidier menu.

### New features

- **menu**: 6 groupes de 5 pages au plus ([cb44c1b](https://github.com/victhille/devforge/commit/cb44c1b1194ee86e05037ba3501124e60c04e012))

## [2.1.0-beta.4](https://github.com/victhille/devforge/compare/v2.1.0-beta.3...v2.1.0-beta.4) — 2026-10-23

> Your Automations automations show on DevForge's Home page, and Forgy can read their feed.

### New features

- **automations**: Widget Automatisations et lecture du flux par Forgy ([568dbc1](https://github.com/victhille/devforge/commit/568dbc1583e5207cfd7fefa2fb6fbdd79b017e66))

## [2.1.0-beta.3](https://github.com/victhille/devforge/compare/v2.1.0-beta.2...v2.1.0-beta.3) — 2026-10-23

> Updates finally arrive on their own: DevForge reads the releases with your GitHub CLI sign-in, and the Update button shows next to Forgy.

### Fixes

- **updates**: Lire les versions du dépôt privé avec le jeton de GitHub CLI ([782dfc4](https://github.com/victhille/devforge/commit/782dfc4b3b86e3d4b739f31fbf93a871f2a67edb))

## [2.1.0-beta.2](https://github.com/victhille/devforge/compare/v2.1.0-beta.1...v2.1.0-beta.2) — 2026-10-23

> Nightly VPS backups with a copy on the PC, a Home page you compose, a palette that acts, compact mode, .env synced with the server, GitHub on the project page, and Forgy watching the VPS.

### New features

- Synchronisation des .env, GitHub sur la page projet, Forgy plus complet ([623a1cf](https://github.com/victhille/devforge/commit/623a1cf4966781d93db7244f448e031f285b1817))
- **home**: Accueil personnalisable, palette avec actions, mode compact ([618c688](https://github.com/victhille/devforge/commit/618c688ddb8a9edcf9e29a39dae050855d863927))
- **backups**: Sauvegardes automatiques du VPS ([3089b02](https://github.com/victhille/devforge/commit/3089b02478a8a3973aabeefd806a220691b39577))

## [2.1.0-beta.1](https://github.com/victhille/devforge/compare/v2.0.0...v2.1.0-beta.1) — 2026-10-22

> An Update button next to Forgy, and your VPS under control: its web services open in one click, and a Health page points out what needs your attention.

### New features

- **vps**: Bouton Mise à jour, services et santé du VPS ([2aedd4f](https://github.com/victhille/devforge/commit/2aedd4fcb3242962dd4cdf66700c0d53b3c6803e))

### Fixes

- **i18n**: Pas de texte vide pour les niveaux de santé impossibles ([f96000b](https://github.com/victhille/devforge/commit/f96000bf59429c689776750dba092b8d02fa3d66))

_1 technical change(s) (tests, CI, repository docs) not listed._

## [2.0.0](https://github.com/victhille/devforge/compare/v2.0.0-beta.5...v2.0.0) — 2026-10-22

> DevForge 2.0: Forgy acts for you, n8n installs and runs on your VPS (French editor too), a VPN page for WireGuard, Vercel, local voice typing, and settings and a menu shaped your way.

### New features

- **menu**: Favoris du menu au choix ([b37d195](https://github.com/victhille/devforge/commit/b37d1957116f8c34583721059980b33f75f0e503))

### Fixes

- **ssh**: Requêtes HTTP par la session SSH (wg-easy 408, clé d'API n8n) ([ec39d02](https://github.com/victhille/devforge/commit/ec39d027ed9a322e6e701fcff667a897f88c13b1))

## [2.0.0-beta.5](https://github.com/victhille/devforge/compare/v2.0.0-beta.4...v2.0.0-beta.5) — 2026-10-22

> New VPN page: the VPS's WireGuard clients, with add, delete and QR codes, no command line needed.

### New features

- **vpn**: Page VPN pour le WireGuard du VPS (wg-easy) ([0ae1618](https://github.com/victhille/devforge/commit/0ae1618de44f87eb3d1c65b434067a2e87e1b2c6))

### Fixes

- **ui**: Sélecteurs alignés avec les boutons, version au-dessus de « Réduire le menu » ([8185018](https://github.com/victhille/devforge/commit/8185018ebc10eb2a301eada82c0f35d9cc4c2019))

_2 technical change(s) (tests, CI, repository docs) not listed._

## [2.0.0-beta.4](https://github.com/victhille/devforge/compare/v2.0.0-beta.3...v2.0.0-beta.4) — 2026-10-20

> n8n opens only once its editor is ready: no more "Cannot GET /" right after a start.

### Fixes

- **n8n**: Attendre l'éditeur avant d'annoncer que n8n est prêt ([0822470](https://github.com/victhille/devforge/commit/08224701d9cf338f71741791e97116c8149b0f00))

## [2.0.0-beta.3](https://github.com/victhille/devforge/compare/v2.0.0-beta.2...v2.0.0-beta.3) — 2026-10-20

> n8n can show its editor in French: an option on the n8n page uses the community translation, rebuilt for every n8n version.

### New features

- **n8n**: Interface de n8n en français ([2926721](https://github.com/victhille/devforge/commit/2926721ed9f0e09e00b41dcb4659b640fde0e713))

## [2.0.0-beta.2](https://github.com/victhille/devforge/compare/v2.0.0-beta.1...v2.0.0-beta.2) — 2026-10-20

> n8n opens from DevForge with no command, and the domain is checked before the install.

### Fixes

- **n8n**: N8n opens from DevForge with no command, the sub-domain is checked before an HTTPS install, and the old Caddy is removed ([5e4b955](https://github.com/victhille/devforge/commit/5e4b955ab8ced60d9df1562fbeac1fd355357306))

## [2.0.0-beta.1](https://github.com/victhille/devforge/compare/v1.5.0...v2.0.0-beta.1) — 2026-10-20

> DevForge 2.0: Forgy acts, one page per project, a watched VPS, n8n and Vercel.

### New features

- Whisper voice typing on your PC, a guided first launch, better accessibility (keyboard, contrast) and CPU of Docker services ([9a0ba75](https://github.com/victhille/devforge/commit/9a0ba75b029196549b896233abb8cdf4a6bfc9a8))
- Redesigned settings and release notes, a "What's new" window, n8n installed and followed on the VPS, Vercel deployments on the project page ([d3de411](https://github.com/victhille/devforge/commit/d3de411d050201b56e5641157208b0ebd429d949))
- **monitor**: Background VPS watch with 7 days of history, 24 h charts, alerts, and Docker on the VPS ([fea30ad](https://github.com/victhille/devforge/commit/fea30ad55ce14e9cc8578d5e291f6727273eb7c0))
- **projects**: Project page gathering Git, Docker, variables, databases, logs, ports and deploy, with an active project followed by Forgy and the home page ([a513cfe](https://github.com/victhille/devforge/commit/a513cfee40928a5349413e5184b3323088874133))
- **assistant**: Forgy can act: commit, Compose, SQL, ports, scripts, .env variables, always after your approval, with a journal and undo ([79068de](https://github.com/victhille/devforge/commit/79068de6d3df5a8add7205e9b277dc872b145f95))
- V2 groundwork: versioned and backed-up data, local log with a diagnostic report, beta channel, reviewed light theme ([16817cb](https://github.com/victhille/devforge/commit/16817cba0f7c1e1ef8efef1d39781a7ce27ce5e5))

## [1.5.0](https://github.com/victhille/devforge/compare/v1.4.1...v1.5.0) — 2026-10-19

> DevForge gets a new look: a redesigned menu, a lively home page, and Forgy strolling with Boulon.

### New features

- New design: reworked menu, live home page, Forgy panel, redone pages, Forgy strolls with Boulon and a desktop widget ([914eb38](https://github.com/victhille/devforge/commit/914eb3880bfb890b7583c6ae47a5e9dbf5edf1a4))

## [1.4.1](https://github.com/victhille/devforge/compare/v1.4.0...v1.4.1) — 2026-10-18

> A smoother app, especially while it runs in the background.

### Performance

- Smoother app: the mascot costs nothing at rest, faster Git and Docker pages ([4dd05f4](https://github.com/victhille/devforge/commit/4dd05f475d13173b26e4378b8a606352a5a9db80))

## [1.4.0](https://github.com/victhille/devforge/compare/v1.3.0...v1.4.0) — 2026-10-18

> Meet Forgy, the assistant that knows your project and the page you are on.

### New features

- **assistant**: Web search in the assistant (with sources) and shortcuts to Claude Code, Codex, Antigravity, Gemini and the web apps ([6631364](https://github.com/victhille/devforge/commit/663136452eac6c665fb2df546ae4709536bb3ea5))
- **assistant**: Forgy, the assistant's little robot, shows what it is doing (thinking, searching, writing, done…) ([5b58dee](https://github.com/victhille/devforge/commit/5b58dee6432813356c083acfefe3be0d63c906e4))
- **assistant**: Ready-made tasks and cost control for the assistant (right model per task, monthly budget) ([e79709d](https://github.com/victhille/devforge/commit/e79709d825f8b79849e4543da20a369fbe6a3723))
- **assistant**: Built-in AI assistant (Ctrl+J) that knows the project and the current page, read-only ([6b3d8f1](https://github.com/victhille/devforge/commit/6b3d8f165bb03ef88a70521b3c47b61af4cad089))

### Fixes

- **settings**: "See what's new" also opens the notes when already on the Settings page ([4cd1a0b](https://github.com/victhille/devforge/commit/4cd1a0b930efe8db01c13b2686c53f4521babd80))

_1 technical change(s) (tests, CI, repository docs) not listed._

## [1.3.0](https://github.com/victhille/devforge/compare/v1.2.2...v1.3.0) — 2026-10-18

> The API Tester now previews HTML pages.

### New features

- **api-tester**: HTML response preview and response headers tab in the API tester ([2a79cd1](https://github.com/victhille/devforge/commit/2a79cd1f4d0ec0dd9869c25e7c77ace8df756c35))

## [1.2.2](https://github.com/victhille/devforge/compare/v1.2.1...v1.2.2) — 2026-10-18

### Fixes

- **i18n**: The update message and app startup follow the selected language ([fb4ecf8](https://github.com/victhille/devforge/commit/fb4ecf8bf8afdedabc0bf6b12061383400571294))

## [1.2.1](https://github.com/victhille/devforge/compare/v1.2.0...v1.2.1) — 2026-10-18

### Fixes

- **release**: Release notes in the app language (French or English) ([d5fecde](https://github.com/victhille/devforge/commit/d5fecdea02e09a04373f2dbd8494eec59d1677c1))

_2 technical change(s) (tests, CI, repository docs) not listed._

## [1.2.0](https://github.com/victhille/devforge/compare/v1.1.0...v1.2.0) — 2026-10-18

### New features

- **releases**: Versioning with conventional commits, changelog and GitHub releases ([7ba03bc](https://github.com/victhille/devforge/commit/7ba03bca81d27ed52179ad6e772fcc408a2594bf))
- Database explorer like phpMyAdmin, collapsible connections panel ([6060b69](https://github.com/victhille/devforge/commit/6060b69ff1d79b89cd99be309e06ab57b1bf2cff))
- **database**: Handle connections dropped by the server ([78a4663](https://github.com/victhille/devforge/commit/78a46637c98f7e0d13ee4008a7de6fd735b1d20d))
- **docker**: Show compose services as tags, linked DevForge project as a caption ([3efff57](https://github.com/victhille/devforge/commit/3efff574a541be16dde3ccb996020c18541a859a))
- **docker**: Start compose projects from DevForge, safer clean-up, compose-aware DB detection ([45c932d](https://github.com/victhille/devforge/commit/45c932deb7a3301ebdaa54b80947cbe68c2c8bab))
- **database over SSH**: Also try the server's public address from the server ([df391cc](https://github.com/victhille/devforge/commit/df391cc28e1f2c84e264385d6cefe37b18d922d6))
- **database over SSH**: Find the database on the server when its address fails ([ce1cacf](https://github.com/victhille/devforge/commit/ce1cacfe706ee2cfb1d0310b5e893ed9faeccf14))
- **database**: Reach DBs hosted on a saved SSH server through an SSH tunnel ([272bc52](https://github.com/victhille/devforge/commit/272bc520a599b42e35154dd386cb28b97ff0af26))
- Sandbox renderer, add CSP, route API tester through main process ([9ba8b1c](https://github.com/victhille/devforge/commit/9ba8b1c255e5ac375cbd419807f2066185eeb805))

### Security

- Verify SSH server keys (trust on first use) ([36f721a](https://github.com/victhille/devforge/commit/36f721a313221ac51da4ff66b85436b5acea2d8c))
- No shell injection through paths, URLs or script names ([800f86d](https://github.com/victhille/devforge/commit/800f86ddb0845f724c274b4232f1d404e14fb42b))

### Fixes

- Tests, lint and CI; fix bugs they found ([045a062](https://github.com/victhille/devforge/commit/045a0626a293e2909f5b29f34c5afad4e7b37e46))
- Fix remote detection scripts: quote them for the remote shell ([17cd22b](https://github.com/victhille/devforge/commit/17cd22bbbc2208fd193aa1fd33e8f1fe2b9baeee))

### Dependencies and build

- Upgrade Electron 29 -> 44.5.1 and electron-builder 26 ([6bbac95](https://github.com/victhille/devforge/commit/6bbac95742050db03ee842c4f8dd393cdd7f8188))

## 1.1.0 — 2026-10-17

### New features

- One domain suggestion per project even with several dev servers ([0b8a534](https://github.com/victhille/devforge/commit/0b8a534dc5503c8c4c5900f18870cd038f2fcc75))
- Detect deployed projects on a server and create deploy targets ([6aee98f](https://github.com/victhille/devforge/commit/6aee98f28426387e02c5b36f634120c2fe4b1ae2))
- Suggest log files, monitor URLs and local domains from projects ([700e5eb](https://github.com/victhille/devforge/commit/700e5ebfdfaf8783d6ddcd32cc6c2b0b17a3d99a))
- **database**: SSH tunnels, server detection and .env import ([8a93298](https://github.com/victhille/devforge/commit/8a9329809eebce3b2feced1e6640167ce219e4d2))
- Collapsible sidebar (icons only, Ctrl+B) and SSH servers panel ([7370ed0](https://github.com/victhille/devforge/commit/7370ed06d0fe12f495330ec21969f00ffa760d2d))
- Remove duplicated '+' from labels that already have an icon ([303124e](https://github.com/victhille/devforge/commit/303124ec19cf405cf6966cc4250e194ee58e089c))
- Add cron, timestamp and URL tools to the toolbox ([6978692](https://github.com/victhille/devforge/commit/6978692e601e96f4bdc7ff520004b7aa04ca32e8))
- Add webhook tester ([de85a08](https://github.com/victhille/devforge/commit/de85a0816fa6e2a737efba6275975263fb17fcae))
- Add live log file viewer ([62d24f7](https://github.com/victhille/devforge/commit/62d24f7e85ecb26125a5da6a6403ada0a267672b))
- Add database client (PostgreSQL, MySQL/MariaDB, SQLite) ([66d974f](https://github.com/victhille/devforge/commit/66d974f69eff732deab4de76115495d3d6da64da))
- Add local domains (.test) with a built-in reverse proxy ([b1c45c9](https://github.com/victhille/devforge/commit/b1c45c934fdf9f29e1d88d53940e4e560057a865))
- Add background URL monitoring ([fac5aec](https://github.com/victhille/devforge/commit/fac5aecb11d9a279ce52d842a204c6e7854978fc))
- Add one-click deploy over SSH ([287c95f](https://github.com/victhille/devforge/commit/287c95f5e3c3f49ac7d697807954595b6996f2e8))
- Add local Docker panel ([780abb5](https://github.com/victhille/devforge/commit/780abb5c0e94c0e3eaa418b06912f4168b12cf22))
- Add commit assistant and a page error boundary ([c50ee47](https://github.com/victhille/devforge/commit/c50ee47bcdd4439a67dcedb2de01e72363b6e093))
- Add stack launcher ([1ac624f](https://github.com/victhille/devforge/commit/1ac624f88be3b514e7d0e8ecdac2a50fc3349bd1))
- Add .env manager and project runtime version checks ([d359051](https://github.com/victhille/devforge/commit/d3590518f8f10109316a7191c0d75dac20a54a59))
- Add disk cleaner and regroup the sidebar ([8f8b2b0](https://github.com/victhille/devforge/commit/8f8b2b0c531f1260682dadad808a69efa0a32de5))
- Add multi-project Git dashboard and toast notifications ([15a2d28](https://github.com/victhille/devforge/commit/15a2d289913c1bae71e3e52aea0500c80a538ff7))
- Add command palette (Ctrl+K) and a single navigation registry ([06b53f9](https://github.com/victhille/devforge/commit/06b53f929e4410c668059ec1e5018c74e8568a99))
- Make main process non-blocking, lazy-load pages, roomier UI ([afde98a](https://github.com/victhille/devforge/commit/afde98ab31ff1ab0715df430211af9cec3b2fa46))
- Encrypt SSH passwords with safeStorage, remove unused CreationConsole ([71233fd](https://github.com/victhille/devforge/commit/71233fdaf759ba6442b5603d9f33d82260f7a097))
- Initial DevForge state ([dfc6918](https://github.com/victhille/devforge/commit/dfc691855d0723ebc891ca5ea76b26ab4938cb86))

### Fixes

- Fix log suggestion path display on Windows ([fb82f1b](https://github.com/victhille/devforge/commit/fb82f1bbf2d71f3657daf77edbdca5fd015273c7))
- Fix text-base color clash, redesign nav, tabs and buttons ([9155922](https://github.com/victhille/devforge/commit/915592285e44f93785f541de6a656718a0febb7c))

### Internal improvements

- Convert remaining CRLF files to LF ([6e6aa37](https://github.com/victhille/devforge/commit/6e6aa37ae271b1b7d5ca3ff2377b3e1b3d85cb52))
- Normalize line endings to LF (.gitattributes) ([763c286](https://github.com/victhille/devforge/commit/763c286526f28504a6ece779a6a7e63a9ee752c1))
- Silence expected git stderr in getGitStatus ([a02ab11](https://github.com/victhille/devforge/commit/a02ab117627cf878d8b8d48afb3b981f0a198086))
- Move UI to Tailwind v4 and split large files ([0411517](https://github.com/victhille/devforge/commit/0411517399116cbd4bb3c3ea12108cbbf33d8d94))
- Restructure project into feature-based architecture ([e37c3a1](https://github.com/victhille/devforge/commit/e37c3a1f53f7c9e59076a0d1c80dc83a2bed30de))
