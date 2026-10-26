# Notes de version

Toutes les versions de DevForge. Format : [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), versions [SemVer](https://semver.org/lang/fr/).

## [2.4.0](https://github.com/victhille/devforge/compare/v2.3.1...v2.4.0) — 2026-10-25

> Nouveau logo : l'enclume orange de DevForge mobile.

### Nouveautés

- **design** : Le logo de DevForge mobile (enclume orange), une seule flèche sur « Retour » ([998e489](https://github.com/victhille/devforge/commit/998e4891da13ca95c56b7bb9c75b67162787b3c9))

_2 changement(s) technique(s) (tests, CI, documentation du dépôt) non listé(s)._

## [2.3.1](https://github.com/victhille/devforge/compare/v2.3.0...v2.3.1) — 2026-10-25

> Le premier bloc d'un terminal cmd n'affiche plus la commande interne de DevForge.

### Corrections

- **terminal** : L'écho de la commande retiré même après la bannière de cmd ([9ba95ad](https://github.com/victhille/devforge/commit/9ba95ad2b7575a6eec167965384a56857c750406))

## [2.3.0](https://github.com/victhille/devforge/compare/v2.2.0...v2.3.0) — 2026-10-25

> Laravel Sail, Auth.js et retour en arrière Prisma dans les ateliers, Forgy dans les trois ateliers, une base Docker propre à chaque projet, codes de retour dans cmd.

### Nouveautés

- **forgy** : Forgy dans les ateliers Laravel et Next.js ([be31e09](https://github.com/victhille/devforge/commit/be31e09dd6e4250381814bbc4e6c41b69b10e6f9))
- **laravel** : Sail à la création et dans l'atelier ([7af9319](https://github.com/victhille/devforge/commit/7af931997818e34ff8dca03c38be9dcb35edd339))
- **nextjs** : Auth.js dans l'atelier (GitHub, Google, e-mail) ([e6424fb](https://github.com/victhille/devforge/commit/e6424fbfaec6bab13d1b10e5f21e9c48d7e1112a))
- **nextjs** : Revenir en arrière sur une migration Prisma ([70d397a](https://github.com/victhille/devforge/commit/70d397afa2f254f3ed4e561a34741038cada824f))
- **terminal** : Code de retour dans cmd, shells gardés sur la page projet ([f39d4f0](https://github.com/victhille/devforge/commit/f39d4f06422b50ef92f08fd9f0e9072d052208d5))
- **projets** : Une base Docker propre à chaque projet ([fe2dfc2](https://github.com/victhille/devforge/commit/fe2dfc262d791c1e83af28278aadb17934571680))

_1 changement(s) technique(s) (tests, CI, documentation du dépôt) non listé(s)._

## [2.2.0](https://github.com/victhille/devforge/compare/v2.1.0...v2.2.0) — 2026-10-25

> Projets complets dès la création, ateliers Symfony, Laravel et Next.js, lanceur global, page de statut et terminal en blocs.

### Nouveautés

- **ateliers** : Ateliers Laravel et Next.js ([d03fa05](https://github.com/victhille/devforge/commit/d03fa050c7c5aa8b6ad6be18abe4efa60d208fc8))
- **terminal** : Terminal en blocs ([02bf360](https://github.com/victhille/devforge/commit/02bf360fe6acbfe37df19f5be810c4954697631d))
- **statut** : Page de statut et surveillance 24 h/24 depuis le VPS ([5c1e944](https://github.com/victhille/devforge/commit/5c1e9443b8e29e77a8f0e03d4bbb964accce6bcc))
- **lanceur** : Lanceur global sur Ctrl+Alt+Espace ([ab2eace](https://github.com/victhille/devforge/commit/ab2eace99cc3c7539c0cfcc117993ee46f551338))
- **symfony** : Atelier Symfony dans la page projet ([8eaf177](https://github.com/victhille/devforge/commit/8eaf177aec3c854687ce9ba3fb1a2b3a89955358))
- **projets** : Création enrichie (base, options, Git et GitHub) ([00f79cd](https://github.com/victhille/devforge/commit/00f79cdaa052ad2d119f16b8fecf4b503f731c78))

### Corrections

- **statut** : Retours de la première installation sur le VPS ([b34cf94](https://github.com/victhille/devforge/commit/b34cf944a22ab70d9c72074679f767b688f6cb8f))

_2 changement(s) technique(s) (tests, CI, documentation du dépôt) non listé(s)._

## [2.1.0](https://github.com/victhille/devforge/compare/v2.1.0-beta.4...v2.1.0) — 2026-10-24

> DevForge 2.1 : ton VPS sous contrôle (services en un clic, santé, sauvegardes de nuit), un accueil à composer, une palette qui agit, le mode compact, les .env synchronisés, GitHub sur la page projet, Automations sur l'accueil, Forgy qui veille sur tout ça, des mises à jour qui arrivent toutes seules et un menu mieux rangé.

### Nouveautés

- **menu** : 6 groupes de 5 pages au plus ([cb44c1b](https://github.com/victhille/devforge/commit/cb44c1b1194ee86e05037ba3501124e60c04e012))

## [2.1.0-beta.4](https://github.com/victhille/devforge/compare/v2.1.0-beta.3...v2.1.0-beta.4) — 2026-10-23

> Tes automatisations Automations s'affichent sur l'accueil de DevForge, et Forgy peut lire leur flux.

### Nouveautés

- **automations** : Widget Automatisations et lecture du flux par Forgy ([568dbc1](https://github.com/victhille/devforge/commit/568dbc1583e5207cfd7fefa2fb6fbdd79b017e66))

## [2.1.0-beta.3](https://github.com/victhille/devforge/compare/v2.1.0-beta.2...v2.1.0-beta.3) — 2026-10-23

> Les mises à jour arrivent enfin toutes seules : DevForge lit les versions avec ta connexion GitHub CLI, et le bouton « Mettre à jour » apparaît à côté de Forgy.

### Corrections

- **updates** : Lire les versions du dépôt privé avec le jeton de GitHub CLI ([782dfc4](https://github.com/victhille/devforge/commit/782dfc4b3b86e3d4b739f31fbf93a871f2a67edb))

## [2.1.0-beta.2](https://github.com/victhille/devforge/compare/v2.1.0-beta.1...v2.1.0-beta.2) — 2026-10-23

> Sauvegardes de nuit du VPS avec copie sur le PC, accueil à composer soi-même, palette qui agit, mode compact, .env synchronisés avec le serveur, GitHub sur la page projet, et Forgy qui veille sur le VPS.

### Nouveautés

- Synchronisation des .env, GitHub sur la page projet, Forgy plus complet ([623a1cf](https://github.com/victhille/devforge/commit/623a1cf4966781d93db7244f448e031f285b1817))
- **home** : Accueil personnalisable, palette avec actions, mode compact ([618c688](https://github.com/victhille/devforge/commit/618c688ddb8a9edcf9e29a39dae050855d863927))
- **backups** : Sauvegardes automatiques du VPS ([3089b02](https://github.com/victhille/devforge/commit/3089b02478a8a3973aabeefd806a220691b39577))

## [2.1.0-beta.1](https://github.com/victhille/devforge/compare/v2.0.0...v2.1.0-beta.1) — 2026-10-22

> Un bouton « Mettre à jour » à côté de Forgy, et ton VPS sous contrôle : ses services web s'ouvrent en un clic, et une page Santé signale ce qui demande ton attention.

### Nouveautés

- **vps** : Bouton Mise à jour, services et santé du VPS ([2aedd4f](https://github.com/victhille/devforge/commit/2aedd4fcb3242962dd4cdf66700c0d53b3c6803e))

### Corrections

- **i18n** : Pas de texte vide pour les niveaux de santé impossibles ([f96000b](https://github.com/victhille/devforge/commit/f96000bf59429c689776750dba092b8d02fa3d66))

_1 changement(s) technique(s) (tests, CI, documentation du dépôt) non listé(s)._

## [2.0.0](https://github.com/victhille/devforge/compare/v2.0.0-beta.5...v2.0.0) — 2026-10-22

> DevForge 2.0 : Forgy agit pour toi, n8n s'installe et se pilote sur ton VPS (aussi en français), une page VPN pour WireGuard, Vercel, la dictée vocale en local, des paramètres et un menu à ton goût.

### Nouveautés

- **menu** : Favoris du menu au choix ([b37d195](https://github.com/victhille/devforge/commit/b37d1957116f8c34583721059980b33f75f0e503))

### Corrections

- **ssh** : Requêtes HTTP par la session SSH (wg-easy 408, clé d'API n8n) ([ec39d02](https://github.com/victhille/devforge/commit/ec39d027ed9a322e6e701fcff667a897f88c13b1))

## [2.0.0-beta.5](https://github.com/victhille/devforge/compare/v2.0.0-beta.4...v2.0.0-beta.5) — 2026-10-22

> Nouvelle page VPN : les clients WireGuard du VPS, avec ajout, suppression et QR code, sans ligne de commande.

### Nouveautés

- **vpn** : Page VPN pour le WireGuard du VPS (wg-easy) ([0ae1618](https://github.com/victhille/devforge/commit/0ae1618de44f87eb3d1c65b434067a2e87e1b2c6))

### Corrections

- **ui** : Sélecteurs alignés avec les boutons, version au-dessus de « Réduire le menu » ([8185018](https://github.com/victhille/devforge/commit/8185018ebc10eb2a301eada82c0f35d9cc4c2019))

_2 changement(s) technique(s) (tests, CI, documentation du dépôt) non listé(s)._

## [2.0.0-beta.4](https://github.com/victhille/devforge/compare/v2.0.0-beta.3...v2.0.0-beta.4) — 2026-10-20

> n8n s'ouvre seulement quand son éditeur est prêt : plus de « Cannot GET / » juste après un démarrage.

### Corrections

- **n8n** : Attendre l'éditeur avant d'annoncer que n8n est prêt ([0822470](https://github.com/victhille/devforge/commit/08224701d9cf338f71741791e97116c8149b0f00))

## [2.0.0-beta.3](https://github.com/victhille/devforge/compare/v2.0.0-beta.2...v2.0.0-beta.3) — 2026-10-20

> n8n peut s'afficher en français : une option sur la page n8n utilise la traduction communautaire, mise à jour à chaque version.

### Nouveautés

- **n8n** : Interface de n8n en français ([2926721](https://github.com/victhille/devforge/commit/2926721ed9f0e09e00b41dcb4659b640fde0e713))

## [2.0.0-beta.2](https://github.com/victhille/devforge/compare/v2.0.0-beta.1...v2.0.0-beta.2) — 2026-10-20

> n8n s'ouvre depuis DevForge sans commande, et le domaine est vérifié avant l'installation.

### Corrections

- **n8n** : N8n s'ouvre depuis DevForge sans commande, le sous-domaine est vérifié avant l'installation HTTPS, et l'ancien Caddy est retiré ([5e4b955](https://github.com/victhille/devforge/commit/5e4b955ab8ced60d9df1562fbeac1fd355357306))

## [2.0.0-beta.1](https://github.com/victhille/devforge/compare/v1.5.0...v2.0.0-beta.1) — 2026-10-20

> DevForge 2.0 : Forgy agit, une page par projet, le VPS surveillé, n8n et Vercel.

### Nouveautés

- Dictée Whisper sur ton PC, premier démarrage guidé, meilleure accessibilité (clavier, contrastes) et CPU des services Docker ([9a0ba75](https://github.com/victhille/devforge/commit/9a0ba75b029196549b896233abb8cdf4a6bfc9a8))
- Paramètres et notes de version repensés, fenêtre « Quoi de neuf », n8n installé et suivi sur le VPS, déploiements Vercel sur la page projet ([d3de411](https://github.com/victhille/devforge/commit/d3de411d050201b56e5641157208b0ebd429d949))
- **monitor** : Surveillance du VPS en arrière-plan avec 7 jours d'historique, courbes 24 h, alertes, et Docker sur le VPS ([fea30ad](https://github.com/victhille/devforge/commit/fea30ad55ce14e9cc8578d5e291f6727273eb7c0))
- **projects** : Page projet qui réunit Git, Docker, variables, bases, logs, ports et déploiement, avec un projet actif suivi par Forgy et l'accueil ([a513cfe](https://github.com/victhille/devforge/commit/a513cfee40928a5349413e5184b3323088874133))
- **assistant** : Forgy peut agir : commit, Compose, SQL, ports, scripts, variables .env, toujours après ta validation, avec journal et annulation ([79068de](https://github.com/victhille/devforge/commit/79068de6d3df5a8add7205e9b277dc872b145f95))
- Bases de la v2 : données versionnées et sauvegardées, journal local avec rapport de diagnostic, canal bêta, thème clair revu ([16817cb](https://github.com/victhille/devforge/commit/16817cba0f7c1e1ef8efef1d39781a7ce27ce5e5))

## [1.5.0](https://github.com/victhille/devforge/compare/v1.4.1...v1.5.0) — 2026-10-19

> DevForge change de tête : menu repensé, accueil vivant, et Forgy qui se promène avec Boulon.

### Nouveautés

- Nouveau design : menu repensé, accueil vivant, panneau Forgy, pages refaites, Forgy se promène avec Boulon et widget de bureau ([914eb38](https://github.com/victhille/devforge/commit/914eb3880bfb890b7583c6ae47a5e9dbf5edf1a4))

## [1.4.1](https://github.com/victhille/devforge/compare/v1.4.0...v1.4.1) — 2026-10-18

> Une application plus fluide, surtout quand elle tourne en arrière-plan.

### Performances

- Application plus fluide : la mascotte ne consomme plus rien au repos, pages Git et Docker plus rapides ([4dd05f4](https://github.com/victhille/devforge/commit/4dd05f475d13173b26e4378b8a606352a5a9db80))

## [1.4.0](https://github.com/victhille/devforge/compare/v1.3.0...v1.4.0) — 2026-10-18

> Arrivée de Forgy, l'assistant qui connaît ton projet et la page où tu es.

### Nouveautés

- **assistant** : Recherche web dans l'assistant (avec sources) et raccourcis vers Claude Code, Codex, Antigravity, Gemini et les apps web ([6631364](https://github.com/victhille/devforge/commit/663136452eac6c665fb2df546ae4709536bb3ea5))
- **assistant** : Forgy, le petit robot de l'assistant, montre ce qu'il fait (réfléchit, cherche, écrit, a fini…) ([5b58dee](https://github.com/victhille/devforge/commit/5b58dee6432813356c083acfefe3be0d63c906e4))
- **assistant** : Tâches prêtes à l'emploi et maîtrise du coût de l'assistant (modèle adapté à chaque tâche, budget mensuel) ([e79709d](https://github.com/victhille/devforge/commit/e79709d825f8b79849e4543da20a369fbe6a3723))
- **assistant** : Assistant IA intégré (Ctrl+J) qui connaît le projet et la page en cours, en lecture seule ([6b3d8f1](https://github.com/victhille/devforge/commit/6b3d8f165bb03ef88a70521b3c47b61af4cad089))

### Corrections

- **settings** : « Voir les nouveautés » ouvre aussi les notes quand on est déjà sur la page Paramètres ([4cd1a0b](https://github.com/victhille/devforge/commit/4cd1a0b930efe8db01c13b2686c53f4521babd80))

_1 changement(s) technique(s) (tests, CI, documentation du dépôt) non listé(s)._

## [1.3.0](https://github.com/victhille/devforge/compare/v1.2.2...v1.3.0) — 2026-10-18

> L'API Tester sait afficher les pages HTML.

### Nouveautés

- **api-tester** : Aperçu des réponses HTML et onglet des en-têtes de réponse dans l'API Tester ([2a79cd1](https://github.com/victhille/devforge/commit/2a79cd1f4d0ec0dd9869c25e7c77ace8df756c35))

## [1.2.2](https://github.com/victhille/devforge/compare/v1.2.1...v1.2.2) — 2026-10-18

### Corrections

- **i18n** : Le message de mise à jour et le démarrage de l'application respectent la langue choisie ([fb4ecf8](https://github.com/victhille/devforge/commit/fb4ecf8bf8afdedabc0bf6b12061383400571294))

## [1.2.1](https://github.com/victhille/devforge/compare/v1.2.0...v1.2.1) — 2026-10-18

### Corrections

- **release** : Notes de version dans la langue de l'application (français ou anglais) ([d5fecde](https://github.com/victhille/devforge/commit/d5fecdea02e09a04373f2dbd8494eec59d1677c1))

_2 changement(s) technique(s) (tests, CI, documentation du dépôt) non listé(s)._

## [1.2.0](https://github.com/victhille/devforge/compare/v1.1.0...v1.2.0) — 2026-10-18

### Nouveautés

- **versions** : Versions automatiques à partir des commits, notes de version et publication sur GitHub ([7ba03bc](https://github.com/victhille/devforge/commit/7ba03bca81d27ed52179ad6e772fcc408a2594bf))
- Explorateur de base façon phpMyAdmin (structure, index, relations, infos) et panneau des connexions rétractable ([6060b69](https://github.com/victhille/devforge/commit/6060b69ff1d79b89cd99be309e06ab57b1bf2cff))
- **base de données** : Plus de plantage quand le serveur coupe la connexion (ex. arrêt d'un conteneur) : reconnexion automatique ([78a4663](https://github.com/victhille/devforge/commit/78a46637c98f7e0d13ee4008a7de6fd735b1d20d))
- **docker** : Les projets Compose affichent leurs services, le projet DevForge lié passe en légende ([3efff57](https://github.com/victhille/devforge/commit/3efff574a541be16dde3ccb996020c18541a859a))
- **docker** : Lancer les projets Compose depuis DevForge, nettoyage qui épargne leurs conteneurs, détection des bases depuis le compose ([45c932d](https://github.com/victhille/devforge/commit/45c932deb7a3301ebdaa54b80947cbe68c2c8bab))
- **BDD via SSH** : Essai aussi de l'adresse publique du serveur, depuis le serveur ([df391cc](https://github.com/victhille/devforge/commit/df391cc28e1f2c84e264385d6cefe37b18d922d6))
- **BDD via SSH** : Recherche de la base dans les conteneurs Docker du serveur quand son adresse ne répond pas ([ce1cacf](https://github.com/victhille/devforge/commit/ce1cacfe706ee2cfb1d0310b5e893ed9faeccf14))
- **base de données** : Accès aux bases hébergées sur un serveur SSH enregistré via un tunnel SSH automatique ([272bc52](https://github.com/victhille/devforge/commit/272bc520a599b42e35154dd386cb28b97ff0af26))
- Interface isolée (sandbox + CSP), le testeur d'API passe par le processus principal ([9ba8b1c](https://github.com/victhille/devforge/commit/9ba8b1c255e5ac375cbd419807f2066185eeb805))

### Sécurité

- Vérification des clés des serveurs SSH (confiance à la première connexion) ([36f721a](https://github.com/victhille/devforge/commit/36f721a313221ac51da4ff66b85436b5acea2d8c))
- Plus d'injection de commandes via les chemins, URL ou noms de scripts ([800f86d](https://github.com/victhille/devforge/commit/800f86ddb0845f724c274b4232f1d404e14fb42b))

### Corrections

- Tests, lint et CI ; correction du cron (dimanche = 7) et des antislashs doublés dans les .env ([045a062](https://github.com/victhille/devforge/commit/045a0626a293e2909f5b29f34c5afad4e7b37e46))
- Détection sur serveur distant : scripts correctement protégés pour le shell distant ([17cd22b](https://github.com/victhille/devforge/commit/17cd22bbbc2208fd193aa1fd33e8f1fe2b9baeee))

### Dépendances et build

- Electron 29 → 44.5.1 et electron-builder 26 ([6bbac95](https://github.com/victhille/devforge/commit/6bbac95742050db03ee842c4f8dd393cdd7f8188))

## 1.1.0 — 2026-10-17

### Nouveautés

- Une seule suggestion de domaine par projet, même avec plusieurs serveurs de dev ([0b8a534](https://github.com/victhille/devforge/commit/0b8a534dc5503c8c4c5900f18870cd038f2fcc75))
- Détection des projets déployés sur un serveur et création des cibles de déploiement ([6aee98f](https://github.com/victhille/devforge/commit/6aee98f28426387e02c5b36f634120c2fe4b1ae2))
- Suggestions de fichiers de log, d’URL à surveiller et de domaines locaux depuis les projets ([700e5eb](https://github.com/victhille/devforge/commit/700e5ebfdfaf8783d6ddcd32cc6c2b0b17a3d99a))
- **base de données** : Tunnels SSH, détection sur serveur et import depuis les .env ([8a93298](https://github.com/victhille/devforge/commit/8a9329809eebce3b2feced1e6640167ce219e4d2))
- Barre latérale rétractable (icônes seules, Ctrl+B) et panneau des serveurs SSH ([7370ed0](https://github.com/victhille/devforge/commit/7370ed06d0fe12f495330ec21969f00ffa760d2d))
- Suppression du « + » en double sur les boutons qui ont déjà une icône ([303124e](https://github.com/victhille/devforge/commit/303124ec19cf405cf6966cc4250e194ee58e089c))
- Outils cron, timestamp et URL dans la boîte à outils ([6978692](https://github.com/victhille/devforge/commit/6978692e601e96f4bdc7ff520004b7aa04ca32e8))
- Testeur de webhooks ([de85a08](https://github.com/victhille/devforge/commit/de85a0816fa6e2a737efba6275975263fb17fcae))
- Lecteur de fichiers de log en direct ([62d24f7](https://github.com/victhille/devforge/commit/62d24f7e85ecb26125a5da6a6403ada0a267672b))
- Client de base de données (PostgreSQL, MySQL/MariaDB, SQLite) ([66d974f](https://github.com/victhille/devforge/commit/66d974f69eff732deab4de76115495d3d6da64da))
- Domaines locaux (.test) avec reverse proxy intégré ([b1c45c9](https://github.com/victhille/devforge/commit/b1c45c934fdf9f29e1d88d53940e4e560057a865))
- Surveillance d'URL en arrière-plan ([fac5aec](https://github.com/victhille/devforge/commit/fac5aecb11d9a279ce52d842a204c6e7854978fc))
- Déploiement en un clic via SSH ([287c95f](https://github.com/victhille/devforge/commit/287c95f5e3c3f49ac7d697807954595b6996f2e8))
- Panneau Docker local ([780abb5](https://github.com/victhille/devforge/commit/780abb5c0e94c0e3eaa418b06912f4168b12cf22))
- Assistant de commit et protection des pages contre les erreurs ([c50ee47](https://github.com/victhille/devforge/commit/c50ee47bcdd4439a67dcedb2de01e72363b6e093))
- Lanceur de stacks ([1ac624f](https://github.com/victhille/devforge/commit/1ac624f88be3b514e7d0e8ecdac2a50fc3349bd1))
- Gestionnaire de .env et vérification des versions requises par les projets ([d359051](https://github.com/victhille/devforge/commit/d3590518f8f10109316a7191c0d75dac20a54a59))
- Nettoyeur de disque et barre latérale réorganisée ([8f8b2b0](https://github.com/victhille/devforge/commit/8f8b2b0c531f1260682dadad808a69efa0a32de5))
- Tableau de bord Git multi-projets et notifications ([15a2d28](https://github.com/victhille/devforge/commit/15a2d289913c1bae71e3e52aea0500c80a538ff7))
- Palette de commandes (Ctrl+K) et registre de navigation unique ([06b53f9](https://github.com/victhille/devforge/commit/06b53f929e4410c668059ec1e5018c74e8568a99))
- Processus principal non bloquant, pages chargées à la demande, interface plus aérée ([afde98a](https://github.com/victhille/devforge/commit/afde98ab31ff1ab0715df430211af9cec3b2fa46))
- Mots de passe SSH chiffrés (safeStorage), suppression de code inutilisé ([71233fd](https://github.com/victhille/devforge/commit/71233fdaf759ba6442b5603d9f33d82260f7a097))
- État initial de DevForge ([dfc6918](https://github.com/victhille/devforge/commit/dfc691855d0723ebc891ca5ea76b26ab4938cb86))

### Corrections

- Affichage des chemins des logs suggérés sous Windows ([fb82f1b](https://github.com/victhille/devforge/commit/fb82f1bbf2d71f3657daf77edbdca5fd015273c7))
- Conflit de couleur du texte, refonte de la navigation, des onglets et des boutons ([9155922](https://github.com/victhille/devforge/commit/915592285e44f93785f541de6a656718a0febb7c))

### Améliorations internes

- Conversion des derniers fichiers CRLF en LF ([6e6aa37](https://github.com/victhille/devforge/commit/6e6aa37ae271b1b7d5ca3ff2377b3e1b3d85cb52))
- Fins de ligne normalisées en LF (.gitattributes) ([763c286](https://github.com/victhille/devforge/commit/763c286526f28504a6ece779a6a7e63a9ee752c1))
- Messages git attendus masqués dans getGitStatus ([a02ab11](https://github.com/victhille/devforge/commit/a02ab117627cf878d8b8d48afb3b981f0a198086))
- Interface passée à Tailwind v4, gros fichiers découpés ([0411517](https://github.com/victhille/devforge/commit/0411517399116cbd4bb3c3ea12108cbbf33d8d94))
- Architecture réorganisée par fonctionnalité ([e37c3a1](https://github.com/victhille/devforge/commit/e37c3a1f53f7c9e59076a0d1c80dc83a2bed30de))
