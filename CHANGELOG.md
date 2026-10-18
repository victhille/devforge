# Notes de version

Toutes les versions de DevForge. Format : [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), versions [SemVer](https://semver.org/lang/fr/).

## [1.2.0](https://github.com/victhille/devforge/compare/v1.1.0...v1.2.0) — 2026-10-18

### Nouveautés

- **release** : Versioning with conventional commits, changelog and GitHub releases ([00cad77](https://github.com/victhille/devforge/commit/00cad77b4900085b0792f3dcd070d4e1c03202b3))
- Database explorer like phpMyAdmin, collapsible connections panel ([cc30530](https://github.com/victhille/devforge/commit/cc305308c6139e7ad7b2378ce52235daccfcfc90))
- **database** : Handle connections dropped by the server ([b320fbb](https://github.com/victhille/devforge/commit/b320fbb2bfc6397fd5965b6626f51d7e8dd54b72))
- **docker** : Show compose services as tags, linked DevForge project as a caption ([fc37cc1](https://github.com/victhille/devforge/commit/fc37cc14306d6d4c94e691131585a969196a36c3))
- **docker** : Start compose projects from DevForge, safer clean-up, compose-aware DB detection ([6ab43ed](https://github.com/victhille/devforge/commit/6ab43ed6d500938c7b68c97667c0b664d8d5264a))
- **database over ssh** : Also try the server's public address from the server ([4040f7d](https://github.com/victhille/devforge/commit/4040f7d0cbe566f899c20af0dc2045dc8470745f))
- **database over ssh** : Find the database on the server when its address fails ([3696e67](https://github.com/victhille/devforge/commit/3696e67bfaf17645b355098f61c3772dff26ce30))
- **database** : Reach DBs hosted on a saved SSH server through an SSH tunnel ([2a5bd60](https://github.com/victhille/devforge/commit/2a5bd603b42c5dd56b307ab416be26237de3948c))
- Sandbox renderer, add CSP, route API tester through main process ([532d934](https://github.com/victhille/devforge/commit/532d934a98a00b6abef65bc6255b398823d5bfcb))

### Sécurité

- Verify SSH server keys (trust on first use) ([6bc543b](https://github.com/victhille/devforge/commit/6bc543be6e5c28c89fec1e80dd88cfd2d0700fa5))
- No shell injection through paths, URLs or script names ([ec42992](https://github.com/victhille/devforge/commit/ec42992047e21299655e830a9834da528eed9e00))

### Corrections

- Tests, lint and CI; fix bugs they found ([bc42178](https://github.com/victhille/devforge/commit/bc421782bd4d72dad28df784b83cb8f22815de85))
- Fix remote detection scripts: quote them for the remote shell ([53bbc54](https://github.com/victhille/devforge/commit/53bbc54cb1b6fdc1917e99202195c4fbaa23645a))

### Dépendances et build

- Upgrade Electron 29 -> 44.5.1 and electron-builder 26 ([51cbe7a](https://github.com/victhille/devforge/commit/51cbe7a4ef1c9b93c0e4f1bd781600a2bf839a23))

## 1.1.0 — 2026-10-17

### Nouveautés

- One domain suggestion per project even with several dev servers ([f12711d](https://github.com/victhille/devforge/commit/f12711db9b1fa8deb346de574230ecb2fa265e17))
- Detect deployed projects on a server and create deploy targets ([ea2c7eb](https://github.com/victhille/devforge/commit/ea2c7eb1634df6eb7e7ba8eff34f575f44cac6d2))
- Suggest log files, monitor URLs and local domains from projects ([4cfdd3f](https://github.com/victhille/devforge/commit/4cfdd3fec962a64f5096c0b215c30e7ce4b23d49))
- **database** : SSH tunnels, server detection and .env import ([27cc1a4](https://github.com/victhille/devforge/commit/27cc1a4bf0e7ccc4459dbabacc121add0ada1aab))
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
- **initial commit** : Current DevForge state ([0146628](https://github.com/victhille/devforge/commit/014662859d2afacec261577e6b15b21e8fd46cfb))

### Corrections

- Fix log suggestion path display on Windows ([fed7485](https://github.com/victhille/devforge/commit/fed74851e69330bcaafd14860c7e501f77f5f06f))
- Fix text-base color clash, redesign nav, tabs and buttons ([dd32e2e](https://github.com/victhille/devforge/commit/dd32e2e99dc53d9df02aaa8a202a52247c6e1854))

### Améliorations internes

- Convert remaining CRLF files to LF ([f0da60d](https://github.com/victhille/devforge/commit/f0da60d851c576bcd926b500b2ac1231216ed3e8))
- Normalize line endings to LF (.gitattributes) ([84d437a](https://github.com/victhille/devforge/commit/84d437afc96e46c4e5193097562802a0fbff0f73))
- Silence expected git stderr in getGitStatus ([faaa833](https://github.com/victhille/devforge/commit/faaa833844e8eb98d29137a40401eff36ebf72a2))
- Move UI to Tailwind v4 and split large files ([5b4ee84](https://github.com/victhille/devforge/commit/5b4ee8458c66321fdf3dec94b5258c254e044d4f))
- Restructure project into feature-based architecture ([32dd6f5](https://github.com/victhille/devforge/commit/32dd6f5efc59f243e50584b66ec227020bc171b9))
