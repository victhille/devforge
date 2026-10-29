# Notes de version

Toutes les versions de DevForge. Format : [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), versions [SemVer](https://semver.org/lang/fr/).

## [3.8.1](https://github.com/victhille/devforge/compare/v3.8.0...v3.8.1) — 2026-10-29

> Notes mises en forme, schéma de la base plus fluide, onglets du projet sans défilement, application plus légère (429 Mo), mise à jour sans fenêtre d'installation, et une revue de toute l'interface.

### Corrections

- **docker** : Espace entre la console et le bloc des services dans l'onglet du projet ([a05470b](https://github.com/victhille/devforge/commit/a05470bbfc49d6dcd907591b66b0b45e6dcb3b12))
- **v3.8.1** : Schéma, notes mises en forme, onglets du projet, tour de l'appli et ménage du code ([045288a](https://github.com/victhille/devforge/commit/045288a3e41d0ffd1d9612755f62827be3eaf19f))

_1 changement(s) technique(s) (tests, CI, documentation du dépôt) non listé(s)._

## [3.8.0](https://github.com/victhille/devforge/compare/v3.7.0...v3.8.0) — 2026-10-29

> Tâches et notes par projet, alertes du CI GitHub, page Activité, schéma de la base en plein écran et tes propres modèles de projet.

### Nouveautés

- **projects** : Mes modèles de projet, enregistrés depuis la fiche et proposés dans Nouveau projet (v3.8 lot 5) ([99e56c7](https://github.com/victhille/devforge/commit/99e56c77854adffe9eec74ff6a64ddf2059b6770))
- **database** : Schéma de la base en plein écran, déplaçable, mini-carte et export PNG/SVG (v3.8 lot 4) ([1939082](https://github.com/victhille/devforge/commit/193908209d8af0725083a704274df36577981dae))
- **git** : Page Activité, commits par semaine de tous les projets et widget Commits (v3.8 lot 3) ([036334e](https://github.com/victhille/devforge/commit/036334ed3d7f69189678408906979438fab74a2f))
- **github** : Alertes du CI GitHub, notification et point rouge sur la carte (v3.8 lot 2) ([8e4cd38](https://github.com/victhille/devforge/commit/8e4cd380e057250f7323bff42eeb4a7ed65d95f5))
- **notes** : Tâches et notes par projet, comptées sur la carte, lues par Forgy (v3.8 lot 1) ([2acd98a](https://github.com/victhille/devforge/commit/2acd98ad41848fc4aedbd1579383944000197476))

### Corrections

- **forgy** : Outil project_notes en fin de liste (cache des prompts) ([b31386e](https://github.com/victhille/devforge/commit/b31386ed63adb494febe90eb51ff4406fa7d81eb))
- **v3.8** : Lien de la page Activité et import inutilisé ([320b14a](https://github.com/victhille/devforge/commit/320b14ac1e54149457a788cdbfa6cde9a1256878))

_5 changement(s) technique(s) (tests, CI, documentation du dépôt) non listé(s)._

## [3.7.0](https://github.com/victhille/devforge/compare/v3.6.0...v3.7.0) — 2026-10-28

> Un onglet Tests dans la fiche projet (Vitest, Jest, Playwright, PHPUnit, pytest, Go, Cargo) : chaque test, ses échecs avec attendu et reçu, relancer, demander à Forgy ; et l'arbre des fichiers montre ce qui a changé depuis le dernier commit, avec le diff.

### Nouveautés

- **fichiers** : Git dans l'arbre de fichiers et le diff dans l'aperçu (v3.7 lot 3) ([6443b29](https://github.com/victhille/devforge/commit/6443b29afc2101648922cb12a0e268dd82053031))
- **tests** : Échecs dépliés, relancer, Forgy (v3.7 lot 2) ([f9cec82](https://github.com/victhille/devforge/commit/f9cec82ff6a1a53950eb8a9c2911fe9d9182d651))
- **tests** : Onglet Tests dans la fiche projet (v3.7 lot 1) ([64d3357](https://github.com/victhille/devforge/commit/64d3357e7c43bfa374b60a824dff310cf9c5798f))

### Corrections

- **tests** : L'endroit d'un échec se lit aussi sous un nom de dossier court de Windows (RUNNER~1) ([4a397f1](https://github.com/victhille/devforge/commit/4a397f1ac4f00a96d1d2f7b669d3682f9ace3c61))
- **fichiers** : La recherche reste dans sa carte avec de longues lignes, une ligne trouvée plusieurs fois n'apparaît qu'une fois ([087dfc8](https://github.com/victhille/devforge/commit/087dfc8071c896bb8e7a77fef085eab78dd0f488))

_2 changement(s) technique(s) (tests, CI, documentation du dépôt) non listé(s)._

## [3.6.0](https://github.com/victhille/devforge/compare/v3.5.3...v3.6.0) — 2026-10-28

> Les paquets Python, Rust, Go, Ruby et Dart se mettent à jour et s'auditent, les lignes d'une table se modifient en une transaction, une table s'exporte (CSV, JSON, SQL) et un CSV s'importe, et une recherche parcourt tout le projet ; un fichier s'ouvre dans la fenêtre de son projet.

### Nouveautés

- **fichiers** : Rechercher dans tout le projet, et ouvrir un résultat à sa ligne (v3.6 lot 5) ([14a1cff](https://github.com/victhille/devforge/commit/14a1cff186f4d2e888e94186c59daf6711c9629b))
- **base** : Exporter une table (CSV, JSON, SQL) et importer un CSV (v3.6 lot 4) ([81bbdb1](https://github.com/victhille/devforge/commit/81bbdb1b9ff68de879e891b4d7481a35d49d2605))
- **base** : Modifier les lignes d'une table dans Parcourir, en une transaction (v3.6 lot 3) ([6f5f9eb](https://github.com/victhille/devforge/commit/6f5f9eb73c49caea2bc206940ef5291118b5e5cb))
- **forgy** : Paquets Python, Rust, Go, Ruby et Dart dans project_packages et update_packages (v3.6 lot 2) ([ef0ff0f](https://github.com/victhille/devforge/commit/ef0ff0fc25c86d02234a6d32e9d1b8d09b25202e))
- **paquets** : Mise à jour et audit des paquets Python, Rust, Go, Ruby et Dart (v3.6 lot 1) ([2d1e5d6](https://github.com/victhille/devforge/commit/2d1e5d6ae28943c07aa7ffa6f06ecc4cd9c109ae))

### Corrections

- **fichiers** : Un fichier s'ouvre dans la fenêtre de son projet (VS Code, Cursor, Windsurf, Antigravity, Zed) ([d6a1e95](https://github.com/victhille/devforge/commit/d6a1e95aaebd88db8f37675bd4efb4b52d1e07fc))

_2 changement(s) technique(s) (tests, CI, documentation du dépôt) non listé(s)._

## [3.5.3](https://github.com/victhille/devforge/compare/v3.5.2...v3.5.3) — 2026-10-28

> Le code des fichiers en couleurs comme dans un IDE, un bouton pour ouvrir le fichier dans ton IDE, et l'onglet Paquets pour les projets Python, Rust, Go, Ruby, Dart, .NET et Java.

### Nouveautés

- **projets** : Code en couleurs, fichier ouvert dans l'IDE, paquets des autres langages (v3.5.3) ([bd9b3d4](https://github.com/victhille/devforge/commit/bd9b3d438c461cb663e61b428ba1723deb1eba11))

_1 changement(s) technique(s) (tests, CI, documentation du dépôt) non listé(s)._

## [3.5.2](https://github.com/victhille/devforge/compare/v3.5.1...v3.5.2) — 2026-10-28

> L'aperçu des fichiers .md écrits sous Windows ne plante plus, un clic sur une carte groupe ouvre sa fiche, et l'onglet Fichiers laisse toute la place à l'arbre et à l'aperçu.

### Corrections

- **projets** : Aperçu des .md Windows, carte groupe cliquable, onglet Fichiers sans scripts ([b2c9f3e](https://github.com/victhille/devforge/commit/b2c9f3e4a0143e4e6f8245635e6ad1f8419f4d79))

_1 changement(s) technique(s) (tests, CI, documentation du dépôt) non listé(s)._

## [3.5.1](https://github.com/victhille/devforge/compare/v3.5.0...v3.5.1) — 2026-10-28

> Cartes groupe plus nettes avec le reste du dossier, aperçu des fichiers (Markdown, images, PDF), tables créées et modifiées depuis la page Base de données, copie en JSON, console qui se ferme avec son dernier onglet.

### Corrections

- Retours d'essai de la 3.5.0 (v3.5.1) ([a6be2f6](https://github.com/victhille/devforge/commit/a6be2f6be02ab54a94ff0ea2db1466accfdc5732))

_1 changement(s) technique(s) (tests, CI, documentation du dépôt) non listé(s)._

## [3.5.0](https://github.com/victhille/devforge/compare/v3.4.1...v3.5.0) — 2026-10-28

> Tous tes projets, partout : plusieurs dossiers de projets, projets imbriqués en groupes, IDE détectés ou ajoutés à la main (un par projet), aide et exemples dans chaque outil, commandes perso dans la doc, suggestions grisées dans le terminal.

### Nouveautés

- **terminal** : Suggestion grisée en fin de ligne (v3.5 lot 6) ([e074cf8](https://github.com/victhille/devforge/commit/e074cf8ff84f61ba6bbaa23d964a4ecb5cd8bad3))
- **doc** : Commandes perso, vérifiées et complétées (v3.5 lot 5) ([3c04008](https://github.com/victhille/devforge/commit/3c04008762b8e4f9ed417c113e38d520194ee612))
- **outils** : Aide et exemples dans la boîte à outils (v3.5 lot 4) ([c52e6ec](https://github.com/victhille/devforge/commit/c52e6ece30e51d836419e9adc084b321a683bd3a))
- **ide** : IDE détectés, ajoutés à la main et propres à chaque projet (v3.5 lot 3) ([fad61f7](https://github.com/victhille/devforge/commit/fad61f7559dffa407d99aff40a66b004ae0c64f8))
- **projets** : Projets imbriqués en groupes (v3.5 lot 2) ([3ac27d8](https://github.com/victhille/devforge/commit/3ac27d8baed2e58259e9933beb03f41a7690b7ed))
- **projets** : Plusieurs dossiers de projets (v3.5 lot 1) ([9ebfa42](https://github.com/victhille/devforge/commit/9ebfa428c851bf41a051fd337bde1bcaaf9d3c9e))

_1 changement(s) technique(s) (tests, CI, documentation du dépôt) non listé(s)._

## [3.4.1](https://github.com/victhille/devforge/compare/v3.4.0...v3.4.1) — 2026-10-28

> Correctifs : bouton IDE selon le réglage, filtres utiles, pages générées plus propres (CSS à part, accueil selon la connexion, React/Vue rangés), Node simple avec npm test, Symfony sans dépôt en double.

### Corrections

- **projets** : Correctifs 3.4.1 (IDE, filtres, pages générées) ([b407415](https://github.com/victhille/devforge/commit/b407415fb763591be0076fbf8d4d27ee7d497abe))

_1 changement(s) technique(s) (tests, CI, documentation du dépôt) non listé(s)._

## [3.4.0](https://github.com/victhille/devforge/compare/v3.3.1...v3.4.0) — 2026-10-28

> Un projet qui démarre prêt : page d'accueil DevForge, et connexion, inscription et API d'authentification communes à Next.js, Laravel, Symfony, React et Vue.

### Nouveautés

- **projets** : Authentification React et Vue, client du contrat DevForge (v3.4 lot 6) ([fc8f135](https://github.com/victhille/devforge/commit/fc8f135628bc00be167fb03ccdb30a396c6b0997))
- **projets** : Authentification Symfony sur le contrat DevForge (v3.4 lot 5) ([82de044](https://github.com/victhille/devforge/commit/82de0449f9ffcc76f4317798be0701c531719a2c))
- **projets** : Authentification Laravel sur le contrat DevForge (v3.4 lot 4) ([955275b](https://github.com/victhille/devforge/commit/955275b4bb0d557d3feed11934e5d433a922cfda))
- **projets** : Authentification Next.js sur le contrat DevForge (v3.4 lot 3) ([5e5a1d3](https://github.com/victhille/devforge/commit/5e5a1d3156877cd81e99261f9d3e534d116f5571))
- **projets** : Contrat d'API d'authentification commun (v3.4 lot 2) ([96c73b2](https://github.com/victhille/devforge/commit/96c73b24daeeaa53e4da4de1e1eee8afa7b64757))
- **projets** : Page d'accueil DevForge à la création (v3.4 lot 1) ([faa8c88](https://github.com/victhille/devforge/commit/faa8c882205d0d889cb811f3c77008c806599994))

### Corrections

- **projets** : Dashboard Next.js compatible Cache Components, affichage de l'accueil ([5453597](https://github.com/victhille/devforge/commit/5453597ee7ed7a064264e514abca5945a5998e04))

_2 changement(s) technique(s) (tests, CI, documentation du dépôt) non listé(s)._

## [3.3.1](https://github.com/victhille/devforge/compare/v3.3.0...v3.3.1) — 2026-10-27

> Création de projet fiabilisée : .gitignore avant le premier commit, Tailwind 4 et Prisma 7 configurés, branche main, journal lisible et console réglable.

### Nouveautés

- **console** : Console de création réglable, journal lisible, Laravel prêt à l'emploi ([bd92845](https://github.com/victhille/devforge/commit/bd928451052a2f28cbcb6da8e836a5abf9eac200))

### Corrections

- **projets** : Next.js crée son dépôt sur main et garde son propre Tailwind ([785a35a](https://github.com/victhille/devforge/commit/785a35a8d2493d406e659a7d655da052c0b67eed))
- **projets** : Création de projet et journal corrigés après les essais réels ([0834fa5](https://github.com/victhille/devforge/commit/0834fa5c0d39d769fd212798ee3520a970f4b7b6))

_1 changement(s) technique(s) (tests, CI, documentation du dépôt) non listé(s)._

## [3.3.0](https://github.com/victhille/devforge/compare/v3.2.0...v3.3.0) — 2026-10-27

> La fiche projet affiche sa base de données et ses paquets (npm, pnpm, yarn, Composer) : retards, vulnérabilités et mises à jour au choix, avec retour en arrière ; Forgy sait aussi les lire et les proposer.

### Nouveautés

- **aide** : F1 sur l'onglet Paquets ouvre sa propre page de doc ([adbaea8](https://github.com/victhille/devforge/commit/adbaea87e7dc07d3e5098d44affae28e24ba38f9))
- **forgy** : Forgy dit ce qui est en retard ou vulnérable dans un projet, et propose une mise à jour annulable ([f56c142](https://github.com/victhille/devforge/commit/f56c1422b148921d86210fc30ef7713c9fe47399))
- **paquets** : L'onglet Paquets lit aussi composer.json : Packagist, composer audit, mises à jour (dans Sail si besoin) ([5db213f](https://github.com/victhille/devforge/commit/5db213f4236c1c25ceb858a0d2201feb3752188b))
- **paquets** : Onglet Paquets : paquets en retard, vulnérabilités, mise à jour au choix avec retour en arrière ([a8438d2](https://github.com/victhille/devforge/commit/a8438d259c7a7def7c3d11d78f516024996f277b))
- **projet** : La base de données s'affiche dans la fiche projet, et la page Base de données ramène au projet ([3768ec3](https://github.com/victhille/devforge/commit/3768ec3c1024ad7aa4ffdccb89b34837eaa45235))

### Corrections

- **paquets** : Une vulnérabilité Composer sans gravité indiquée s'affiche « gravité non précisée » ([b3cd880](https://github.com/victhille/devforge/commit/b3cd8800c4d441f5c0b6eca38a2f066ee2e2115b))

_11 changement(s) technique(s) (tests, CI, documentation du dépôt) non listé(s)._

## [3.2.0](https://github.com/victhille/devforge/compare/v3.1.0...v3.2.0) — 2026-10-27

> Chaque page ouvre sa documentation (bouton « ? » ou F1), n8n et les alertes ntfy se règlent dans Connexions, plus de mélange français / anglais, et Forgy reconnaît ANTHROPIC_API_KEY.

### Nouveautés

- **connexions** : N8n et les alertes ntfy se règlent, se testent et se retirent dans Connexions ([e2b7513](https://github.com/victhille/devforge/commit/e2b7513c150fc1dd88ce1275443969cb22bc8d54))
- **aide** : L'aide de chaque page sur le site, d'un clic ou avec F1 ([7eec232](https://github.com/victhille/devforge/commit/7eec23205114f98950adb48b983ff1c159eb1803))

### Corrections

- **langue** : Plus de mélange français / anglais, Forgy reconnaît ANTHROPIC_API_KEY ([cc6297f](https://github.com/victhille/devforge/commit/cc6297fd41f0663ff9777c07b93701b7f4f0aa14))

_12 changement(s) technique(s) (tests, CI, documentation du dépôt) non listé(s)._

## [3.1.0](https://github.com/victhille/devforge/compare/v3.0.0...v3.1.0) — 2026-10-27

> Le menu ne montre les pages qui demandent un serveur (santé, services, sauvegardes, n8n, page de statut, VPN) qu'une fois un serveur configuré ; Paramètres › Connexions s'ouvre sans attendre.

### Nouveautés

- **menu** : Les pages qui demandent un serveur attendent qu'il y en ait un ([164329e](https://github.com/victhille/devforge/commit/164329ed10c2e0bd4863a1b714b63438000b690f))

### Dépendances et build

- **lint** : Les worktrees de .claude/ hors du lint ([630ba4a](https://github.com/victhille/devforge/commit/630ba4a7d5d72d256c71b02a032737a3b3615f55))

_7 changement(s) technique(s) (tests, CI, documentation du dépôt) non listé(s)._

## [3.0.0](https://github.com/victhille/devforge/compare/v2.4.0...v3.0.0) — 2026-10-26

> DevForge devient public : rien de l'auteur dedans, tout se configure dans Paramètres › Connexions, premier lancement guidé, export, import et « Tout effacer ».

### Nouveautés

- **données** : Tout effacer, exporter et importer sa configuration ([1bdf1b9](https://github.com/victhille/devforge/commit/1bdf1b90fc3dd52cef0834bfdd5b8ea3b5830989))
- **public** : Rien de personnel dans le logiciel ([4359fc9](https://github.com/victhille/devforge/commit/4359fc9c65e886801916a3c68fb7caddb59b249f))
- **premier-lancement** : Langue, comptes, pages « à configurer » ([03e838b](https://github.com/victhille/devforge/commit/03e838b74612b0fcb20d40d216538b58b8867933))
- **paramètres** : Section Connexions (comptes, clés, serveurs, bases) ([b5067ea](https://github.com/victhille/devforge/commit/b5067ea49e2b43c46f96045ac74ac9276476f4b6))
- **accueil** : Les cartes en Masonry ([3f4ab35](https://github.com/victhille/devforge/commit/3f4ab3518ea34359b7dc06c5525de7b055b99cec))

### Corrections

- **données** : La page vide sa mémoire elle-même avant de tout effacer ([cf439b6](https://github.com/victhille/devforge/commit/cf439b676b7bcbec36e1491753b10d6bad7e54b5))
- **connexions** : Sondes lentes gardées une minute, effacement qui n'attend plus Chromium ([672f4c0](https://github.com/victhille/devforge/commit/672f4c0b520724486b9d806414586f2c6fc46bfe))

### Dépendances et build

- **public** : Mises à jour sans jeton (dépôt public) ([5517213](https://github.com/victhille/devforge/commit/551721327f67c9dcb72932b3c0a405d9bc232107))

_4 changement(s) technique(s) (tests, CI, documentation du dépôt) non listé(s)._

## [2.4.0](https://github.com/victhille/devforge/compare/v2.3.1...v2.4.0) — 2026-10-25

> Nouveau logo : l'enclume orange de DevForge mobile.

### Nouveautés

- **design** : Le logo de DevForge mobile (enclume orange), une seule flèche sur « Retour » ([99b557f](https://github.com/victhille/devforge/commit/99b557f2855e3067c122acd78254a156dfb90ae4))

_2 changement(s) technique(s) (tests, CI, documentation du dépôt) non listé(s)._

## [2.3.1](https://github.com/victhille/devforge/compare/v2.3.0...v2.3.1) — 2026-10-25

> Le premier bloc d'un terminal cmd n'affiche plus la commande interne de DevForge.

### Corrections

- **terminal** : L'écho de la commande retiré même après la bannière de cmd ([8b64691](https://github.com/victhille/devforge/commit/8b6469143217ad5471baa555d825dcf3f1286dfd))

## [2.3.0](https://github.com/victhille/devforge/compare/v2.2.0...v2.3.0) — 2026-10-25

> Laravel Sail, Auth.js et retour en arrière Prisma dans les ateliers, Forgy dans les trois ateliers, une base Docker propre à chaque projet, codes de retour dans cmd.

### Nouveautés

- **forgy** : Forgy dans les ateliers Laravel et Next.js ([da54d26](https://github.com/victhille/devforge/commit/da54d26781151d6ee04bb7caa3897cecd5b62c14))
- **laravel** : Sail à la création et dans l'atelier ([3f052d9](https://github.com/victhille/devforge/commit/3f052d9d5e5a1d4508d00e4b326487e2eae1a5e1))
- **nextjs** : Auth.js dans l'atelier (GitHub, Google, e-mail) ([f9fc632](https://github.com/victhille/devforge/commit/f9fc632a60536ad43d2d83138534882f0aa0f066))
- **nextjs** : Revenir en arrière sur une migration Prisma ([59bd03d](https://github.com/victhille/devforge/commit/59bd03d9c78f4de882f5070ed15df77b0a2b7fb5))
- **terminal** : Code de retour dans cmd, shells gardés sur la page projet ([98d2976](https://github.com/victhille/devforge/commit/98d2976dc08ea58e4f9065092b72ef7b8d6a9a2c))
- **projets** : Une base Docker propre à chaque projet ([b447a6b](https://github.com/victhille/devforge/commit/b447a6b6fa8acaf58ba762a63a425c9fd5ee56ff))

_1 changement(s) technique(s) (tests, CI, documentation du dépôt) non listé(s)._

## [2.2.0](https://github.com/victhille/devforge/compare/v2.1.0...v2.2.0) — 2026-10-25

> Projets complets dès la création, ateliers Symfony, Laravel et Next.js, lanceur global, page de statut et terminal en blocs.

### Nouveautés

- **ateliers** : Ateliers Laravel et Next.js ([1ce2c5f](https://github.com/victhille/devforge/commit/1ce2c5f8cef904b17709189ac63472e5f97e9862))
- **terminal** : Terminal en blocs ([3880478](https://github.com/victhille/devforge/commit/38804783dc36c7f847d058e3ef6805822cfcb465))
- **statut** : Page de statut et surveillance 24 h/24 depuis le VPS ([9870658](https://github.com/victhille/devforge/commit/9870658ede57a0cd63de5db0eb7a859e5018ac63))
- **lanceur** : Lanceur global sur Ctrl+Alt+Espace ([928b6d2](https://github.com/victhille/devforge/commit/928b6d200eb0e86afa25563bb8ae1de10a23696d))
- **symfony** : Atelier Symfony dans la page projet ([5149fea](https://github.com/victhille/devforge/commit/5149fea56d18da6d649aeda01eb1f0bac0ccd441))
- **projets** : Création enrichie (base, options, Git et GitHub) ([a30dec7](https://github.com/victhille/devforge/commit/a30dec712e695c4750eae4bbfb545b3cbfd2c6c2))

### Corrections

- **statut** : Retours de la première installation sur le VPS ([935d407](https://github.com/victhille/devforge/commit/935d40726ac9586804cd117f04b238f255762321))

_2 changement(s) technique(s) (tests, CI, documentation du dépôt) non listé(s)._

## [2.1.0](https://github.com/victhille/devforge/compare/v2.1.0-beta.4...v2.1.0) — 2026-10-24

> DevForge 2.1 : ton VPS sous contrôle (services en un clic, santé, sauvegardes de nuit), un accueil à composer, une palette qui agit, le mode compact, les .env synchronisés, GitHub sur la page projet, Automations sur l'accueil, Forgy qui veille sur tout ça, des mises à jour qui arrivent toutes seules et un menu mieux rangé.

### Nouveautés

- **menu** : 6 groupes de 5 pages au plus ([dbc525c](https://github.com/victhille/devforge/commit/dbc525c9f2648a01582f5edc921981726f500bb2))

## [2.1.0-beta.4](https://github.com/victhille/devforge/compare/v2.1.0-beta.3...v2.1.0-beta.4) — 2026-10-23

> Tes automatisations Automations s'affichent sur l'accueil de DevForge, et Forgy peut lire leur flux.

### Nouveautés

- **automations** : Widget Automatisations et lecture du flux par Forgy ([390197b](https://github.com/victhille/devforge/commit/390197b95e84b73c7df52c83a36d00978ff9b619))

## [2.1.0-beta.3](https://github.com/victhille/devforge/compare/v2.1.0-beta.2...v2.1.0-beta.3) — 2026-10-23

> Les mises à jour arrivent enfin toutes seules : DevForge lit les versions avec ta connexion GitHub CLI, et le bouton « Mettre à jour » apparaît à côté de Forgy.

### Corrections

- **updates** : Lire les versions du dépôt privé avec le jeton de GitHub CLI ([6acd991](https://github.com/victhille/devforge/commit/6acd991259630b75e3537d089ca73da6eb043643))

## [2.1.0-beta.2](https://github.com/victhille/devforge/compare/v2.1.0-beta.1...v2.1.0-beta.2) — 2026-10-23

> Sauvegardes de nuit du VPS avec copie sur le PC, accueil à composer soi-même, palette qui agit, mode compact, .env synchronisés avec le serveur, GitHub sur la page projet, et Forgy qui veille sur le VPS.

### Nouveautés

- Synchronisation des .env, GitHub sur la page projet, Forgy plus complet ([60e8d8f](https://github.com/victhille/devforge/commit/60e8d8f89fbc4147dbb93e66d4f1295be032f118))
- **home** : Accueil personnalisable, palette avec actions, mode compact ([8571469](https://github.com/victhille/devforge/commit/857146922120f81d634061a91f99029aee846f5e))
- **backups** : Sauvegardes automatiques du VPS ([e88a02f](https://github.com/victhille/devforge/commit/e88a02fc07f112731a74af9da96150e847da60c7))

## [2.1.0-beta.1](https://github.com/victhille/devforge/compare/v2.0.0...v2.1.0-beta.1) — 2026-10-22

> Un bouton « Mettre à jour » à côté de Forgy, et ton VPS sous contrôle : ses services web s'ouvrent en un clic, et une page Santé signale ce qui demande ton attention.

### Nouveautés

- **vps** : Bouton Mise à jour, services et santé du VPS ([683dc98](https://github.com/victhille/devforge/commit/683dc9865731806b27fa97f5feb82511adcceac2))

### Corrections

- **i18n** : Pas de texte vide pour les niveaux de santé impossibles ([340d276](https://github.com/victhille/devforge/commit/340d2769069eeda3eb450c03e046ae0798ed931c))

_1 changement(s) technique(s) (tests, CI, documentation du dépôt) non listé(s)._

## [2.0.0](https://github.com/victhille/devforge/compare/v2.0.0-beta.5...v2.0.0) — 2026-10-22

> DevForge 2.0 : Forgy agit pour toi, n8n s'installe et se pilote sur ton VPS (aussi en français), une page VPN pour WireGuard, Vercel, la dictée vocale en local, des paramètres et un menu à ton goût.

### Nouveautés

- **menu** : Favoris du menu au choix ([d7c8c5b](https://github.com/victhille/devforge/commit/d7c8c5b7641a375fa96b2101b260a743a25a691f))

### Corrections

- **ssh** : Requêtes HTTP par la session SSH (wg-easy 408, clé d'API n8n) ([e3b715e](https://github.com/victhille/devforge/commit/e3b715eed9488c509a7195c0a625a67e9d314ae7))

## [2.0.0-beta.5](https://github.com/victhille/devforge/compare/v2.0.0-beta.4...v2.0.0-beta.5) — 2026-10-22

> Nouvelle page VPN : les clients WireGuard du VPS, avec ajout, suppression et QR code, sans ligne de commande.

### Nouveautés

- **vpn** : Page VPN pour le WireGuard du VPS (wg-easy) ([3c29da6](https://github.com/victhille/devforge/commit/3c29da697c834abbbd85006a0ff3d76573b70399))

### Corrections

- **ui** : Sélecteurs alignés avec les boutons, version au-dessus de « Réduire le menu » ([c91b062](https://github.com/victhille/devforge/commit/c91b062c04374ccf6ccd104f32f7c99821fbf3a6))

_2 changement(s) technique(s) (tests, CI, documentation du dépôt) non listé(s)._

## [2.0.0-beta.4](https://github.com/victhille/devforge/compare/v2.0.0-beta.3...v2.0.0-beta.4) — 2026-10-20

> n8n s'ouvre seulement quand son éditeur est prêt : plus de « Cannot GET / » juste après un démarrage.

### Corrections

- **n8n** : Attendre l'éditeur avant d'annoncer que n8n est prêt ([f8ca814](https://github.com/victhille/devforge/commit/f8ca814c14960f1b659fa26389ee7831e2e4d671))

## [2.0.0-beta.3](https://github.com/victhille/devforge/compare/v2.0.0-beta.2...v2.0.0-beta.3) — 2026-10-20

> n8n peut s'afficher en français : une option sur la page n8n utilise la traduction communautaire, mise à jour à chaque version.

### Nouveautés

- **n8n** : Interface de n8n en français ([88de1d7](https://github.com/victhille/devforge/commit/88de1d709db84827f150840981ee18ab28709056))

## [2.0.0-beta.2](https://github.com/victhille/devforge/compare/v2.0.0-beta.1...v2.0.0-beta.2) — 2026-10-20

> n8n s'ouvre depuis DevForge sans commande, et le domaine est vérifié avant l'installation.

### Corrections

- **n8n** : N8n s'ouvre depuis DevForge sans commande, le sous-domaine est vérifié avant l'installation HTTPS, et l'ancien Caddy est retiré ([54b4266](https://github.com/victhille/devforge/commit/54b426690b49b60dc0b4b4a449de44a23bbb5f6e))

## [2.0.0-beta.1](https://github.com/victhille/devforge/compare/v1.5.0...v2.0.0-beta.1) — 2026-10-20

> DevForge 2.0 : Forgy agit, une page par projet, le VPS surveillé, n8n et Vercel.

### Nouveautés

- Dictée Whisper sur ton PC, premier démarrage guidé, meilleure accessibilité (clavier, contrastes) et CPU des services Docker ([7e27bce](https://github.com/victhille/devforge/commit/7e27bce849d3ea1ecfc706fdfb29f1ac1c5726c8))
- Paramètres et notes de version repensés, fenêtre « Quoi de neuf », n8n installé et suivi sur le VPS, déploiements Vercel sur la page projet ([11ca027](https://github.com/victhille/devforge/commit/11ca027a7ef4906386caa707d187989503206aa7))
- **monitor** : Surveillance du VPS en arrière-plan avec 7 jours d'historique, courbes 24 h, alertes, et Docker sur le VPS ([4a99ccf](https://github.com/victhille/devforge/commit/4a99ccf291ba06ae0d039cf8452bd96b6c1d89a6))
- **projects** : Page projet qui réunit Git, Docker, variables, bases, logs, ports et déploiement, avec un projet actif suivi par Forgy et l'accueil ([16d1df4](https://github.com/victhille/devforge/commit/16d1df41c951df9b94c4af1d22c442ffb0be65e7))
- **assistant** : Forgy peut agir : commit, Compose, SQL, ports, scripts, variables .env, toujours après ta validation, avec journal et annulation ([514e07b](https://github.com/victhille/devforge/commit/514e07bfb3251ec199cb0a3505030cd59dda6ff7))
- Bases de la v2 : données versionnées et sauvegardées, journal local avec rapport de diagnostic, canal bêta, thème clair revu ([3d02955](https://github.com/victhille/devforge/commit/3d029554b07e9ebd258cfe21447e26071afe99ca))

## [1.5.0](https://github.com/victhille/devforge/compare/v1.4.1...v1.5.0) — 2026-10-19

> DevForge change de tête : menu repensé, accueil vivant, et Forgy qui se promène avec Boulon.

### Nouveautés

- Nouveau design : menu repensé, accueil vivant, panneau Forgy, pages refaites, Forgy se promène avec Boulon et widget de bureau ([aaa9095](https://github.com/victhille/devforge/commit/aaa909513fd2a3afd8829534915705f7f90daefa))

## [1.4.1](https://github.com/victhille/devforge/compare/v1.4.0...v1.4.1) — 2026-10-18

> Une application plus fluide, surtout quand elle tourne en arrière-plan.

### Performances

- Application plus fluide : la mascotte ne consomme plus rien au repos, pages Git et Docker plus rapides ([3e70743](https://github.com/victhille/devforge/commit/3e70743fd41ae7b187b584646d1775afc181d024))

## [1.4.0](https://github.com/victhille/devforge/compare/v1.3.0...v1.4.0) — 2026-10-18

> Arrivée de Forgy, l'assistant qui connaît ton projet et la page où tu es.

### Nouveautés

- **assistant** : Recherche web dans l'assistant (avec sources) et raccourcis vers Claude Code, Codex, Antigravity, Gemini et les apps web ([1ec40c3](https://github.com/victhille/devforge/commit/1ec40c3dae6ff5c2c5f50cb4af44d5a47bc659e4))
- **assistant** : Forgy, le petit robot de l'assistant, montre ce qu'il fait (réfléchit, cherche, écrit, a fini…) ([e5713a7](https://github.com/victhille/devforge/commit/e5713a7dd1e1231dccebb326f527745f5930e6f8))
- **assistant** : Tâches prêtes à l'emploi et maîtrise du coût de l'assistant (modèle adapté à chaque tâche, budget mensuel) ([7ff3773](https://github.com/victhille/devforge/commit/7ff3773c4a3bf4e52ffcb21b09bb597f41909a98))
- **assistant** : Assistant IA intégré (Ctrl+J) qui connaît le projet et la page en cours, en lecture seule ([700a03e](https://github.com/victhille/devforge/commit/700a03e47f357844179a3d250c8134917da61ee2))

### Corrections

- **settings** : « Voir les nouveautés » ouvre aussi les notes quand on est déjà sur la page Paramètres ([a304117](https://github.com/victhille/devforge/commit/a3041176cbd940fb871f72dca43600e3a3f53557))

_1 changement(s) technique(s) (tests, CI, documentation du dépôt) non listé(s)._

## [1.3.0](https://github.com/victhille/devforge/compare/v1.2.2...v1.3.0) — 2026-10-18

> L'API Tester sait afficher les pages HTML.

### Nouveautés

- **api-tester** : Aperçu des réponses HTML et onglet des en-têtes de réponse dans l'API Tester ([f9b5e0e](https://github.com/victhille/devforge/commit/f9b5e0eed7a1f658a4a1235645bef73750284571))

## [1.2.2](https://github.com/victhille/devforge/compare/v1.2.1...v1.2.2) — 2026-10-18

### Corrections

- **i18n** : Le message de mise à jour et le démarrage de l'application respectent la langue choisie ([4c21e30](https://github.com/victhille/devforge/commit/4c21e30e4e440e40f5a17b94120b63206843352d))

## [1.2.1](https://github.com/victhille/devforge/compare/v1.2.0...v1.2.1) — 2026-10-18

### Corrections

- **release** : Notes de version dans la langue de l'application (français ou anglais) ([1fed93c](https://github.com/victhille/devforge/commit/1fed93c651af7a415e54f135f3488cebb14e4a9a))

_2 changement(s) technique(s) (tests, CI, documentation du dépôt) non listé(s)._

## [1.2.0](https://github.com/victhille/devforge/compare/v1.1.0...v1.2.0) — 2026-10-18

### Nouveautés

- **versions** : Versions automatiques à partir des commits, notes de version et publication sur GitHub ([20f2137](https://github.com/victhille/devforge/commit/20f2137342509a07a9dca14610b3884a63079ec9))
- Explorateur de base façon phpMyAdmin (structure, index, relations, infos) et panneau des connexions rétractable ([366a147](https://github.com/victhille/devforge/commit/366a147c24a6c8b3f88829af9276e8ddb25f9a9c))
- **base de données** : Plus de plantage quand le serveur coupe la connexion (ex. arrêt d'un conteneur) : reconnexion automatique ([77e7c64](https://github.com/victhille/devforge/commit/77e7c6418eedcf777b2e741fdc08c4547b89cf40))
- **docker** : Les projets Compose affichent leurs services, le projet DevForge lié passe en légende ([08b73ee](https://github.com/victhille/devforge/commit/08b73ee05b82bf1a6e117207018c955d28c408dc))
- **docker** : Lancer les projets Compose depuis DevForge, nettoyage qui épargne leurs conteneurs, détection des bases depuis le compose ([19ef439](https://github.com/victhille/devforge/commit/19ef439ec668eb219553079f14711d943ed1f29c))
- **BDD via SSH** : Essai aussi de l'adresse publique du serveur, depuis le serveur ([5a6c7e8](https://github.com/victhille/devforge/commit/5a6c7e82a50afedaf9130c59f7cc63ddc41cd864))
- **BDD via SSH** : Recherche de la base dans les conteneurs Docker du serveur quand son adresse ne répond pas ([35c20b3](https://github.com/victhille/devforge/commit/35c20b3862ccadeca03074ad497825a489b2fd91))
- **base de données** : Accès aux bases hébergées sur un serveur SSH enregistré via un tunnel SSH automatique ([9fbbb46](https://github.com/victhille/devforge/commit/9fbbb46c765ffa138322f46efce3479f12c27523))
- Interface isolée (sandbox + CSP), le testeur d'API passe par le processus principal ([62db7bd](https://github.com/victhille/devforge/commit/62db7bdad5be4354d02d2f41e83e28d7715ecc6a))

### Sécurité

- Vérification des clés des serveurs SSH (confiance à la première connexion) ([24bfc8e](https://github.com/victhille/devforge/commit/24bfc8e9fa5c7c44e35bb40bbde479218b4b1e15))
- Plus d'injection de commandes via les chemins, URL ou noms de scripts ([5129c57](https://github.com/victhille/devforge/commit/5129c5747cf25b02ea198e1217f67ef5f9a3e061))

### Corrections

- Tests, lint et CI ; correction du cron (dimanche = 7) et des antislashs doublés dans les .env ([e363c5f](https://github.com/victhille/devforge/commit/e363c5f5553d0473ccc99cbcec739ac66d5067f9))
- Détection sur serveur distant : scripts correctement protégés pour le shell distant ([9076848](https://github.com/victhille/devforge/commit/9076848068937ffac62f110a58f8c351003b99b2))

### Dépendances et build

- Electron 29 → 44.5.1 et electron-builder 26 ([ad0e114](https://github.com/victhille/devforge/commit/ad0e114ee7cf6c939598138de10767c61b7a1b1f))

## 1.1.0 — 2026-10-17

### Nouveautés

- Une seule suggestion de domaine par projet, même avec plusieurs serveurs de dev ([a6ff66d](https://github.com/victhille/devforge/commit/a6ff66d56390880107ad65ab187fd0cba735ac72))
- Détection des projets déployés sur un serveur et création des cibles de déploiement ([872866a](https://github.com/victhille/devforge/commit/872866a17fc0f2c76ea43a3733c784959341e01c))
- Suggestions de fichiers de log, d’URL à surveiller et de domaines locaux depuis les projets ([7fead84](https://github.com/victhille/devforge/commit/7fead8445c6719a71c7cd3aa5afd9d3b552ecc03))
- **base de données** : Tunnels SSH, détection sur serveur et import depuis les .env ([20d9247](https://github.com/victhille/devforge/commit/20d9247ee2b4e3eb2afe8c6e69176c2fb31e61a4))
- Barre latérale rétractable (icônes seules, Ctrl+B) et panneau des serveurs SSH ([5fa8e5e](https://github.com/victhille/devforge/commit/5fa8e5e30f217ac388dd0f9bcbd9793ad3ae565d))
- Suppression du « + » en double sur les boutons qui ont déjà une icône ([65d5fa0](https://github.com/victhille/devforge/commit/65d5fa08a5a785e55721fc5de78ff8a5603eac27))
- Outils cron, timestamp et URL dans la boîte à outils ([4596521](https://github.com/victhille/devforge/commit/4596521ef667fed2b8572c6b93c5fac2dce35275))
- Testeur de webhooks ([a6ad7c2](https://github.com/victhille/devforge/commit/a6ad7c24b3f11bbcb8c9bbdc822cca7f1e70144a))
- Lecteur de fichiers de log en direct ([9c4dc6a](https://github.com/victhille/devforge/commit/9c4dc6aa9f707b72ad844262818f36eedda5aeac))
- Client de base de données (PostgreSQL, MySQL/MariaDB, SQLite) ([c4d2f2a](https://github.com/victhille/devforge/commit/c4d2f2a34336893fc1171e43ae0506b060251b5a))
- Domaines locaux (.test) avec reverse proxy intégré ([4e22a33](https://github.com/victhille/devforge/commit/4e22a336e1613f81d9aff8578c8af95e456febd8))
- Surveillance d'URL en arrière-plan ([3879966](https://github.com/victhille/devforge/commit/38799668e8fc396a609d4f5b98d45732f6f308b0))
- Déploiement en un clic via SSH ([982e9d3](https://github.com/victhille/devforge/commit/982e9d39d5dcdc4eb2080b8f06bfed563beb4017))
- Panneau Docker local ([3fc43a6](https://github.com/victhille/devforge/commit/3fc43a629384d6ada0c3d268485692257559c509))
- Assistant de commit et protection des pages contre les erreurs ([f681b22](https://github.com/victhille/devforge/commit/f681b22a8f40ead8fdf0c0b3c5aca27afb9d3367))
- Lanceur de stacks ([10d1e72](https://github.com/victhille/devforge/commit/10d1e72943b43438e72f2816a373a1a5e5574b84))
- Gestionnaire de .env et vérification des versions requises par les projets ([f3fcd19](https://github.com/victhille/devforge/commit/f3fcd19948fe569d7cbcb34aa48f4fa04eacbbe5))
- Nettoyeur de disque et barre latérale réorganisée ([b99cc85](https://github.com/victhille/devforge/commit/b99cc8587b0a63316b8a976cb687b340866f1277))
- Tableau de bord Git multi-projets et notifications ([b4ec602](https://github.com/victhille/devforge/commit/b4ec60296538d18c5e0dabb9f2d4b6ce61cb6ea2))
- Palette de commandes (Ctrl+K) et registre de navigation unique ([dbaf952](https://github.com/victhille/devforge/commit/dbaf9525b12338664357b1b40b38254ff0570ab1))
- Processus principal non bloquant, pages chargées à la demande, interface plus aérée ([fe61b89](https://github.com/victhille/devforge/commit/fe61b8958c328d28bbb1960626a8d3a0eafa4749))
- Mots de passe SSH chiffrés (safeStorage), suppression de code inutilisé ([97db1de](https://github.com/victhille/devforge/commit/97db1de791f3fb4ca376a07182bf2aa88aba8c53))
- État initial de DevForge ([71ed165](https://github.com/victhille/devforge/commit/71ed16524431040ae8cee493854c988c7f27c0fc))

### Corrections

- Affichage des chemins des logs suggérés sous Windows ([838ed1e](https://github.com/victhille/devforge/commit/838ed1e1a1fae51b308d521169b76aef3c2c54a2))
- Conflit de couleur du texte, refonte de la navigation, des onglets et des boutons ([e07462f](https://github.com/victhille/devforge/commit/e07462f6b6fe7ea96dca2a858fcf19067163fed4))

### Améliorations internes

- Conversion des derniers fichiers CRLF en LF ([fa11155](https://github.com/victhille/devforge/commit/fa11155b8c3bf82c5f191079446294a1a4708a5b))
- Fins de ligne normalisées en LF (.gitattributes) ([2ac70ce](https://github.com/victhille/devforge/commit/2ac70ce194686322b7b7b7d2a48aba72e702ed1b))
- Messages git attendus masqués dans getGitStatus ([2f8ee4d](https://github.com/victhille/devforge/commit/2f8ee4d95d003b7f7be7e3e5b313a66009862b1a))
- Interface passée à Tailwind v4, gros fichiers découpés ([bff973b](https://github.com/victhille/devforge/commit/bff973bfd88c482bbc894c42021049e72b708d95))
- Architecture réorganisée par fonctionnalité ([7a8ef9c](https://github.com/victhille/devforge/commit/7a8ef9cc301a3d2bd5ff389d4e52689ada280937))
