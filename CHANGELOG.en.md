# Release notes

Every DevForge version. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), [SemVer](https://semver.org/) versions.

## [2.0.0-beta.5](https://github.com/victhille/devforge/compare/v2.0.0-beta.4...v2.0.0-beta.5) — 2026-10-22

> New VPN page: the VPS's WireGuard clients, with add, delete and QR codes, no command line needed.

### New features

- **vpn**: Page VPN pour le WireGuard du VPS (wg-easy) ([f107860](https://github.com/victhille/devforge/commit/f1078600d0dee28d3bc5b18dd61b20ef45631a4f))

### Fixes

- **ui**: Sélecteurs alignés avec les boutons, version au-dessus de « Réduire le menu » ([2e4632d](https://github.com/victhille/devforge/commit/2e4632dda0997daf2e8746947df56df08609b38a))

_2 technical change(s) (tests, CI, repository docs) not listed._

## [2.0.0-beta.4](https://github.com/victhille/devforge/compare/v2.0.0-beta.3...v2.0.0-beta.4) — 2026-10-20

> n8n opens only once its editor is ready: no more "Cannot GET /" right after a start.

### Fixes

- **n8n**: Attendre l'éditeur avant d'annoncer que n8n est prêt ([d163a8d](https://github.com/victhille/devforge/commit/d163a8dc4d68c0b548d63db7b8399526c9eea9eb))

## [2.0.0-beta.3](https://github.com/victhille/devforge/compare/v2.0.0-beta.2...v2.0.0-beta.3) — 2026-10-20

> n8n can show its editor in French: an option on the n8n page uses the community translation, rebuilt for every n8n version.

### New features

- **n8n**: Interface de n8n en français ([f83a32d](https://github.com/victhille/devforge/commit/f83a32df23758f5d4dc8903bc333227fa61d1431))

## [2.0.0-beta.2](https://github.com/victhille/devforge/compare/v2.0.0-beta.1...v2.0.0-beta.2) — 2026-10-20

> n8n opens from DevForge with no command, and the domain is checked before the install.

### Fixes

- **n8n**: N8n opens from DevForge with no command, the sub-domain is checked before an HTTPS install, and the old Caddy is removed ([3e07965](https://github.com/victhille/devforge/commit/3e0796573e688197574e1b3ceaac1703daa129bc))

## [2.0.0-beta.1](https://github.com/victhille/devforge/compare/v1.5.0...v2.0.0-beta.1) — 2026-10-20

> DevForge 2.0: Forgy acts, one page per project, a watched VPS, n8n and Vercel.

### New features

- Whisper voice typing on your PC, a guided first launch, better accessibility (keyboard, contrast) and CPU of Docker services ([1d0366a](https://github.com/victhille/devforge/commit/1d0366ae1554bcca1ad8478f97f108bfef765a5d))
- Redesigned settings and release notes, a "What's new" window, n8n installed and followed on the VPS, Vercel deployments on the project page ([0264ac2](https://github.com/victhille/devforge/commit/0264ac2bf75376957f3ba28115cf9a8c9144979e))
- **monitor**: Background VPS watch with 7 days of history, 24 h charts, alerts, and Docker on the VPS ([7176d77](https://github.com/victhille/devforge/commit/7176d77e811826a95f870136f85330bb3617506e))
- **projects**: Project page gathering Git, Docker, variables, databases, logs, ports and deploy, with an active project followed by Forgy and the home page ([1973870](https://github.com/victhille/devforge/commit/1973870fb7e39e26a2a99490810568505b959a2e))
- **assistant**: Forgy can act: commit, Compose, SQL, ports, scripts, .env variables, always after your approval, with a journal and undo ([298a5f2](https://github.com/victhille/devforge/commit/298a5f29f487553cae1cebd6e30b61151605a3de))
- V2 groundwork: versioned and backed-up data, local log with a diagnostic report, beta channel, reviewed light theme ([f2581d2](https://github.com/victhille/devforge/commit/f2581d2b52cc27ee58b0e373d73e4c9312a247ff))

## [1.5.0](https://github.com/victhille/devforge/compare/v1.4.1...v1.5.0) — 2026-10-19

> DevForge gets a new look: a redesigned menu, a lively home page, and Forgy strolling with Boulon.

### New features

- New design: reworked menu, live home page, Forgy panel, redone pages, Forgy strolls with Boulon and a desktop widget ([3260e55](https://github.com/victhille/devforge/commit/3260e55c94c7707bc823420a483f058c5ed7fbae))

## [1.4.1](https://github.com/victhille/devforge/compare/v1.4.0...v1.4.1) — 2026-10-18

> A smoother app, especially while it runs in the background.

### Performance

- Smoother app: the mascot costs nothing at rest, faster Git and Docker pages ([c2c739e](https://github.com/victhille/devforge/commit/c2c739e5e17fc765fc6e9e0ec0d487b27fac6285))

## [1.4.0](https://github.com/victhille/devforge/compare/v1.3.0...v1.4.0) — 2026-10-18

> Meet Forgy, the assistant that knows your project and the page you are on.

### New features

- **assistant**: Web search in the assistant (with sources) and shortcuts to Claude Code, Codex, Antigravity, Gemini and the web apps ([e093320](https://github.com/victhille/devforge/commit/e093320e242818181c5256f77bfca948d11d7558))
- **assistant**: Forgy, the assistant's little robot, shows what it is doing (thinking, searching, writing, done…) ([70a57d3](https://github.com/victhille/devforge/commit/70a57d3ad3208122e21d40df90a8fed95c3d1f0a))
- **assistant**: Ready-made tasks and cost control for the assistant (right model per task, monthly budget) ([96c722a](https://github.com/victhille/devforge/commit/96c722a05296734d92d7246f536338eb8b1b7c28))
- **assistant**: Built-in AI assistant (Ctrl+J) that knows the project and the current page, read-only ([5c60467](https://github.com/victhille/devforge/commit/5c60467bc19a5203db1757404071a65cd3aed8e6))

### Fixes

- **settings**: "See what's new" also opens the notes when already on the Settings page ([5776309](https://github.com/victhille/devforge/commit/5776309ec58a767ede609a545082565bbc5a59c8))

_1 technical change(s) (tests, CI, repository docs) not listed._

## [1.3.0](https://github.com/victhille/devforge/compare/v1.2.2...v1.3.0) — 2026-10-18

> The API Tester now previews HTML pages.

### New features

- **api-tester**: HTML response preview and response headers tab in the API tester ([82f9300](https://github.com/victhille/devforge/commit/82f9300616e1dfd3b0b12528520b19541881eae8))

## [1.2.2](https://github.com/victhille/devforge/compare/v1.2.1...v1.2.2) — 2026-10-18

### Fixes

- **i18n**: The update message and app startup follow the selected language ([6a2acde](https://github.com/victhille/devforge/commit/6a2acde8d9902e059431bb7cf9922d07868926d5))

## [1.2.1](https://github.com/victhille/devforge/compare/v1.2.0...v1.2.1) — 2026-10-18

### Fixes

- **release**: Release notes in the app language (French or English) ([52fd18a](https://github.com/victhille/devforge/commit/52fd18a2535e046739a79acb5becdd2119ca431b))

_2 technical change(s) (tests, CI, repository docs) not listed._

## [1.2.0](https://github.com/victhille/devforge/compare/v1.1.0...v1.2.0) — 2026-10-18

### New features

- **releases**: Versioning with conventional commits, changelog and GitHub releases ([00cad77](https://github.com/victhille/devforge/commit/00cad77b4900085b0792f3dcd070d4e1c03202b3))
- Database explorer like phpMyAdmin, collapsible connections panel ([cc30530](https://github.com/victhille/devforge/commit/cc305308c6139e7ad7b2378ce52235daccfcfc90))
- **database**: Handle connections dropped by the server ([b320fbb](https://github.com/victhille/devforge/commit/b320fbb2bfc6397fd5965b6626f51d7e8dd54b72))
- **docker**: Show compose services as tags, linked DevForge project as a caption ([fc37cc1](https://github.com/victhille/devforge/commit/fc37cc14306d6d4c94e691131585a969196a36c3))
- **docker**: Start compose projects from DevForge, safer clean-up, compose-aware DB detection ([6ab43ed](https://github.com/victhille/devforge/commit/6ab43ed6d500938c7b68c97667c0b664d8d5264a))
- **database over SSH**: Also try the server's public address from the server ([4040f7d](https://github.com/victhille/devforge/commit/4040f7d0cbe566f899c20af0dc2045dc8470745f))
- **database over SSH**: Find the database on the server when its address fails ([3696e67](https://github.com/victhille/devforge/commit/3696e67bfaf17645b355098f61c3772dff26ce30))
- **database**: Reach DBs hosted on a saved SSH server through an SSH tunnel ([2a5bd60](https://github.com/victhille/devforge/commit/2a5bd603b42c5dd56b307ab416be26237de3948c))
- Sandbox renderer, add CSP, route API tester through main process ([532d934](https://github.com/victhille/devforge/commit/532d934a98a00b6abef65bc6255b398823d5bfcb))

### Security

- Verify SSH server keys (trust on first use) ([6bc543b](https://github.com/victhille/devforge/commit/6bc543be6e5c28c89fec1e80dd88cfd2d0700fa5))
- No shell injection through paths, URLs or script names ([ec42992](https://github.com/victhille/devforge/commit/ec42992047e21299655e830a9834da528eed9e00))

### Fixes

- Tests, lint and CI; fix bugs they found ([bc42178](https://github.com/victhille/devforge/commit/bc421782bd4d72dad28df784b83cb8f22815de85))
- Fix remote detection scripts: quote them for the remote shell ([53bbc54](https://github.com/victhille/devforge/commit/53bbc54cb1b6fdc1917e99202195c4fbaa23645a))

### Dependencies and build

- Upgrade Electron 29 -> 44.5.1 and electron-builder 26 ([51cbe7a](https://github.com/victhille/devforge/commit/51cbe7a4ef1c9b93c0e4f1bd781600a2bf839a23))

## 1.1.0 — 2026-10-17

### New features

- One domain suggestion per project even with several dev servers ([f12711d](https://github.com/victhille/devforge/commit/f12711db9b1fa8deb346de574230ecb2fa265e17))
- Detect deployed projects on a server and create deploy targets ([ea2c7eb](https://github.com/victhille/devforge/commit/ea2c7eb1634df6eb7e7ba8eff34f575f44cac6d2))
- Suggest log files, monitor URLs and local domains from projects ([4cfdd3f](https://github.com/victhille/devforge/commit/4cfdd3fec962a64f5096c0b215c30e7ce4b23d49))
- **database**: SSH tunnels, server detection and .env import ([27cc1a4](https://github.com/victhille/devforge/commit/27cc1a4bf0e7ccc4459dbabacc121add0ada1aab))
- Collapsible sidebar (icons only, Ctrl+B) and SSH servers panel ([7e7913f](https://github.com/victhille/devforge/commit/7e7913f4281284ad17b9e1088497e0046dc0f7e8))
- Remove duplicated '+' from labels that already have an icon ([4ab4654](https://github.com/victhille/devforge/commit/4ab46541c5f1d902bcf69ec0a859036a12e08f87))
- Add cron, timestamp and URL tools to the toolbox ([f81f181](https://github.com/victhille/devforge/commit/f81f1814d558eb390e97744e7dbca294fbe994e4))
- Add webhook tester ([220974f](https://github.com/victhille/devforge/commit/220974fd8c6cde2f378ad1484ec2b36a23b2c094))
- Add live log file viewer ([4d18232](https://github.com/victhille/devforge/commit/4d1823219a93e5518a41e113cdc9715ea7622179))
- Add database client (PostgreSQL, MySQL/MariaDB, SQLite) ([8ad3fb5](https://github.com/victhille/devforge/commit/8ad3fb5495b327814dda0808a406fc2d7fb0aaae))
- Add local domains (.test) with a built-in reverse proxy ([e84d654](https://github.com/victhille/devforge/commit/e84d65469856e8851ee7cda94a8dcb1a9821ead3))
- Add background URL monitoring ([6ce2087](https://github.com/victhille/devforge/commit/6ce2087e47ac6ffac022f8b0486873676b481045))
- Add one-click deploy over SSH ([c7d5d27](https://github.com/victhille/devforge/commit/c7d5d271cdd1b40232e71668979db12150c10728))
- Add local Docker panel ([c3dd44c](https://github.com/victhille/devforge/commit/c3dd44c58afe91f2715a258abdea293b3c2e8f1e))
- Add commit assistant and a page error boundary ([3ca5023](https://github.com/victhille/devforge/commit/3ca50238a5ee6f12a198e53ee70f58530ad10f6c))
- Add stack launcher ([786e944](https://github.com/victhille/devforge/commit/786e9441e373216a12547cbc53110ba63fb44fc2))
- Add .env manager and project runtime version checks ([b325b8f](https://github.com/victhille/devforge/commit/b325b8f79d544b087ae75ac92d3f31ea63f9c7d0))
- Add disk cleaner and regroup the sidebar ([d496858](https://github.com/victhille/devforge/commit/d496858dd64cc7c1562fa18929220cded7f6e33c))
- Add multi-project Git dashboard and toast notifications ([127c46a](https://github.com/victhille/devforge/commit/127c46a9f4ee7ef4d3f4fc5dd353963ac3db2640))
- Add command palette (Ctrl+K) and a single navigation registry ([615e2a4](https://github.com/victhille/devforge/commit/615e2a4b59d042b39b286d21822bfb80baab62bc))
- Make main process non-blocking, lazy-load pages, roomier UI ([344376d](https://github.com/victhille/devforge/commit/344376dce4606f3d808c090438462a2f2796f5e1))
- Encrypt SSH passwords with safeStorage, remove unused CreationConsole ([f368250](https://github.com/victhille/devforge/commit/f368250f6d87edcd6e3f7478c6473feddf841866))
- Initial DevForge state ([0146628](https://github.com/victhille/devforge/commit/014662859d2afacec261577e6b15b21e8fd46cfb))

### Fixes

- Fix log suggestion path display on Windows ([fed7485](https://github.com/victhille/devforge/commit/fed74851e69330bcaafd14860c7e501f77f5f06f))
- Fix text-base color clash, redesign nav, tabs and buttons ([dd32e2e](https://github.com/victhille/devforge/commit/dd32e2e99dc53d9df02aaa8a202a52247c6e1854))

### Internal improvements

- Convert remaining CRLF files to LF ([f0da60d](https://github.com/victhille/devforge/commit/f0da60d851c576bcd926b500b2ac1231216ed3e8))
- Normalize line endings to LF (.gitattributes) ([84d437a](https://github.com/victhille/devforge/commit/84d437afc96e46c4e5193097562802a0fbff0f73))
- Silence expected git stderr in getGitStatus ([faaa833](https://github.com/victhille/devforge/commit/faaa833844e8eb98d29137a40401eff36ebf72a2))
- Move UI to Tailwind v4 and split large files ([5b4ee84](https://github.com/victhille/devforge/commit/5b4ee8458c66321fdf3dec94b5258c254e044d4f))
- Restructure project into feature-based architecture ([32dd6f5](https://github.com/victhille/devforge/commit/32dd6f5efc59f243e50584b66ec227020bc171b9))
