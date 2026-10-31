# Notes de version

Toutes les versions de DevForge. Format : [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), versions [SemVer](https://semver.org/lang/fr/).

## [4.0.0](https://github.com/victhille/devforge/compare/v3.9.0...v4.0.0) — 2026-10-31

> Version publique : sécurité renforcée, installeur vérifiable par son empreinte, passage en licence GPL-3.0.

### Nouveautés

- **Sécurité** : Electron 44.10 et dépendances à jour ; l'interface n'obtient plus que le micro (dictée), le presse-papiers et les notifications, ne peut plus quitter les pages de l'app, et l'exécutable refuse de servir de Node ou de charger un code modifié ([56bd172](https://github.com/victhille/devforge/commit/56bd172bc50966092da4d72dca546868b963e7b6))
- **Installeur** : son empreinte SHA-256 s'affiche sous le bouton Télécharger et dans les notes de version, pour vérifier le fichier téléchargé ([b1dab08](https://github.com/victhille/devforge/commit/b1dab08822fda89f6992ecaff79ad8bbc945e444))
- **Licence** : DevForge passe sous GPL-3.0 (les versions jusqu'à la 3.9 restent sous MIT) ; le nom et le logo sont réservés, les contributions passent par un accord de contribution ([f30ac50](https://github.com/victhille/devforge/commit/f30ac50b721eb52458601b3119067fc044e5edfa))

## [3.9.0](https://github.com/victhille/devforge/compare/v3.8.1...v3.9.0) — 2026-10-30

> Modélisation : MCD, MLD, MPD et SQL, base liée, diagrammes UML, logigrammes et architecture, liens tirés à la souris

### Nouveautés

- **v3.9** : Liens tirés depuis les points des blocs, palette glissable ([da54910](https://github.com/victhille/devforge/commit/da5491096c2a113472827233ce9e04dfa2d3f7de))
- **v3.9** : Doc, Forgy lit les modèles, création Symfony réparée ([9d60f4a](https://github.com/victhille/devforge/commit/9d60f4a9e7fa5341281faccd515ea1b7dd19acc8))
- **v3.9** : Diagrammes UML, logigrammes et architecture ([6e4c330](https://github.com/victhille/devforge/commit/6e4c33077736fce794c07c836a2d2e9844113f90))
- **v3.9** : Base liée au MPD, script de rattrapage et import depuis une base ([9c1a52e](https://github.com/victhille/devforge/commit/9c1a52ead42a38e79f6c19f4865a8c8dec46cf9b))
- **v3.9** : MLD et MPD générés du MCD, script SQL par moteur ([3f7e5c2](https://github.com/victhille/devforge/commit/3f7e5c271ab9887b44312786b76f358ebde67385))
- **v3.9** : Nouveau projet comme la maquette et page Modélisation avec éditeur MCD ([87c5595](https://github.com/victhille/devforge/commit/87c559536073cbce74ccee9c37cffbab95531446))

## [3.8.1](https://github.com/victhille/devforge/compare/v3.8.0...v3.8.1) — 2026-10-29

> Notes mises en forme, schéma de la base plus fluide, onglets du projet sans défilement, application plus légère (429 Mo), mise à jour sans fenêtre d'installation, et une revue de toute l'interface.

### Corrections

- **docker** : Espace entre la console et le bloc des services dans l'onglet du projet ([d4f93c4](https://github.com/victhille/devforge/commit/d4f93c47b66139ff9a7c6f92d8d6587b4f897581))
- **v3.8.1** : Schéma, notes mises en forme, onglets du projet, tour de l'appli et ménage du code ([eb62818](https://github.com/victhille/devforge/commit/eb628182272bb663a95dfbb5e912a0f707de99a4))

_1 changement(s) technique(s) (tests, CI, documentation du dépôt) non listé(s)._

## [3.8.0](https://github.com/victhille/devforge/compare/v3.7.0...v3.8.0) — 2026-10-29

> Tâches et notes par projet, alertes du CI GitHub, page Activité, schéma de la base en plein écran et tes propres modèles de projet.

### Nouveautés

- **projects** : Mes modèles de projet, enregistrés depuis la fiche et proposés dans Nouveau projet (v3.8 lot 5) ([db597b5](https://github.com/victhille/devforge/commit/db597b59848364f786e06a98b141ecdcf63f3d98))
- **database** : Schéma de la base en plein écran, déplaçable, mini-carte et export PNG/SVG (v3.8 lot 4) ([2b309d1](https://github.com/victhille/devforge/commit/2b309d1308067b77caabc3dfba6a8c59f58ebf24))
- **git** : Page Activité, commits par semaine de tous les projets et widget Commits (v3.8 lot 3) ([90a49b2](https://github.com/victhille/devforge/commit/90a49b2b3360a350084dbe573fbe5278638d1b5a))
- **github** : Alertes du CI GitHub, notification et point rouge sur la carte (v3.8 lot 2) ([abba6a7](https://github.com/victhille/devforge/commit/abba6a7489401baaf0ebe7ac547df3e37fa117f9))
- **notes** : Tâches et notes par projet, comptées sur la carte, lues par Forgy (v3.8 lot 1) ([e877dbe](https://github.com/victhille/devforge/commit/e877dbe48edbc1c84c4a678218d02f409640f04c))

### Corrections

- **forgy** : Outil project_notes en fin de liste (cache des prompts) ([fff9d67](https://github.com/victhille/devforge/commit/fff9d671df5c8589897c757668b18ab7e910c259))
- **v3.8** : Lien de la page Activité et import inutilisé ([9072fa7](https://github.com/victhille/devforge/commit/9072fa70a9fd2ca95e66dbb8b67daa342a717454))

_5 changement(s) technique(s) (tests, CI, documentation du dépôt) non listé(s)._

## [3.7.0](https://github.com/victhille/devforge/compare/v3.6.0...v3.7.0) — 2026-10-28

> Un onglet Tests dans la fiche projet (Vitest, Jest, Playwright, PHPUnit, pytest, Go, Cargo) : chaque test, ses échecs avec attendu et reçu, relancer, demander à Forgy ; et l'arbre des fichiers montre ce qui a changé depuis le dernier commit, avec le diff.

### Nouveautés

- **fichiers** : Git dans l'arbre de fichiers et le diff dans l'aperçu (v3.7 lot 3) ([94f2821](https://github.com/victhille/devforge/commit/94f282151ff11b6c91bfe1c3fce03bbfdf3c7ce8))
- **tests** : Échecs dépliés, relancer, Forgy (v3.7 lot 2) ([967da22](https://github.com/victhille/devforge/commit/967da22378adc9c0fc94bf43e906139dcd9465b6))
- **tests** : Onglet Tests dans la fiche projet (v3.7 lot 1) ([fc918a1](https://github.com/victhille/devforge/commit/fc918a149be78c53225099729338074b498232b4))

### Corrections

- **tests** : L'endroit d'un échec se lit aussi sous un nom de dossier court de Windows (RUNNER~1) ([ff3df76](https://github.com/victhille/devforge/commit/ff3df7608778e345b3f9fd501538ba9df31d4539))
- **fichiers** : La recherche reste dans sa carte avec de longues lignes, une ligne trouvée plusieurs fois n'apparaît qu'une fois ([3fb3633](https://github.com/victhille/devforge/commit/3fb363315beb96df8004a3bc9e66d37bf663573e))

_2 changement(s) technique(s) (tests, CI, documentation du dépôt) non listé(s)._

## [3.6.0](https://github.com/victhille/devforge/compare/v3.5.3...v3.6.0) — 2026-10-28

> Les paquets Python, Rust, Go, Ruby et Dart se mettent à jour et s'auditent, les lignes d'une table se modifient en une transaction, une table s'exporte (CSV, JSON, SQL) et un CSV s'importe, et une recherche parcourt tout le projet ; un fichier s'ouvre dans la fenêtre de son projet.

### Nouveautés

- **fichiers** : Rechercher dans tout le projet, et ouvrir un résultat à sa ligne (v3.6 lot 5) ([fb66997](https://github.com/victhille/devforge/commit/fb66997ec6cebcbdaaa4df1c9df5f81b34c869ab))
- **base** : Exporter une table (CSV, JSON, SQL) et importer un CSV (v3.6 lot 4) ([c7ef8ca](https://github.com/victhille/devforge/commit/c7ef8cab8f163f1e80c497b2cef7ae4a1590acde))
- **base** : Modifier les lignes d'une table dans Parcourir, en une transaction (v3.6 lot 3) ([fa984a0](https://github.com/victhille/devforge/commit/fa984a04ad625294f8433114d1acd7a1c27d1c7f))
- **forgy** : Paquets Python, Rust, Go, Ruby et Dart dans project_packages et update_packages (v3.6 lot 2) ([a82d475](https://github.com/victhille/devforge/commit/a82d4758bc886f72ecc831787799560541863027))
- **paquets** : Mise à jour et audit des paquets Python, Rust, Go, Ruby et Dart (v3.6 lot 1) ([e03cbd0](https://github.com/victhille/devforge/commit/e03cbd04b044a36ca524eecaccfadf83b60c3be8))

### Corrections

- **fichiers** : Un fichier s'ouvre dans la fenêtre de son projet (VS Code, Cursor, Windsurf, Antigravity, Zed) ([c7c005e](https://github.com/victhille/devforge/commit/c7c005ebd5db4bb96c58e8773a13aeb574e33fb9))

_2 changement(s) technique(s) (tests, CI, documentation du dépôt) non listé(s)._

## [3.5.3](https://github.com/victhille/devforge/compare/v3.5.2...v3.5.3) — 2026-10-28

> Le code des fichiers en couleurs comme dans un IDE, un bouton pour ouvrir le fichier dans ton IDE, et l'onglet Paquets pour les projets Python, Rust, Go, Ruby, Dart, .NET et Java.

### Nouveautés

- **projets** : Code en couleurs, fichier ouvert dans l'IDE, paquets des autres langages (v3.5.3) ([01adcb0](https://github.com/victhille/devforge/commit/01adcb0d03db789e50308be63683a3356a76dd32))

_1 changement(s) technique(s) (tests, CI, documentation du dépôt) non listé(s)._

## [3.5.2](https://github.com/victhille/devforge/compare/v3.5.1...v3.5.2) — 2026-10-28

> L'aperçu des fichiers .md écrits sous Windows ne plante plus, un clic sur une carte groupe ouvre sa fiche, et l'onglet Fichiers laisse toute la place à l'arbre et à l'aperçu.

### Corrections

- **projets** : Aperçu des .md Windows, carte groupe cliquable, onglet Fichiers sans scripts ([d5f0f19](https://github.com/victhille/devforge/commit/d5f0f1924d392b8edd9bee5f58c213ea473407de))

_1 changement(s) technique(s) (tests, CI, documentation du dépôt) non listé(s)._

## [3.5.1](https://github.com/victhille/devforge/compare/v3.5.0...v3.5.1) — 2026-10-28

> Cartes groupe plus nettes avec le reste du dossier, aperçu des fichiers (Markdown, images, PDF), tables créées et modifiées depuis la page Base de données, copie en JSON, console qui se ferme avec son dernier onglet.

### Corrections

- Retours d'essai de la 3.5.0 (v3.5.1) ([ff58774](https://github.com/victhille/devforge/commit/ff58774fe30ab9920fe10e0c4a145633ddff88b9))

_1 changement(s) technique(s) (tests, CI, documentation du dépôt) non listé(s)._

## [3.5.0](https://github.com/victhille/devforge/compare/v3.4.1...v3.5.0) — 2026-10-28

> Tous tes projets, partout : plusieurs dossiers de projets, projets imbriqués en groupes, IDE détectés ou ajoutés à la main (un par projet), aide et exemples dans chaque outil, commandes perso dans la doc, suggestions grisées dans le terminal.

### Nouveautés

- **terminal** : Suggestion grisée en fin de ligne (v3.5 lot 6) ([131444e](https://github.com/victhille/devforge/commit/131444e0a7d830c9ca092f1fd6d32828a06c7df3))
- **doc** : Commandes perso, vérifiées et complétées (v3.5 lot 5) ([e25700c](https://github.com/victhille/devforge/commit/e25700c7c3c845f2c748cf3b707062219955a652))
- **outils** : Aide et exemples dans la boîte à outils (v3.5 lot 4) ([cd2c020](https://github.com/victhille/devforge/commit/cd2c0208dc367227d2c346ba057fefc2194ebc40))
- **ide** : IDE détectés, ajoutés à la main et propres à chaque projet (v3.5 lot 3) ([591fd6f](https://github.com/victhille/devforge/commit/591fd6f5e6f627bda25cb67af8c531207917ac1d))
- **projets** : Projets imbriqués en groupes (v3.5 lot 2) ([5051e2b](https://github.com/victhille/devforge/commit/5051e2bb5b80bdd7775768d5fd3b41953f4b41b9))
- **projets** : Plusieurs dossiers de projets (v3.5 lot 1) ([0aacec8](https://github.com/victhille/devforge/commit/0aacec8ab61ca6929a7485b52b0dd46de30ed3e0))

_1 changement(s) technique(s) (tests, CI, documentation du dépôt) non listé(s)._

## [3.4.1](https://github.com/victhille/devforge/compare/v3.4.0...v3.4.1) — 2026-10-28

> Correctifs : bouton IDE selon le réglage, filtres utiles, pages générées plus propres (CSS à part, accueil selon la connexion, React/Vue rangés), Node simple avec npm test, Symfony sans dépôt en double.

### Corrections

- **projets** : Correctifs 3.4.1 (IDE, filtres, pages générées) ([4323768](https://github.com/victhille/devforge/commit/432376833433ed84368ab8ef6f2751f4c417214b))

_1 changement(s) technique(s) (tests, CI, documentation du dépôt) non listé(s)._

## [3.4.0](https://github.com/victhille/devforge/compare/v3.3.1...v3.4.0) — 2026-10-28

> Un projet qui démarre prêt : page d'accueil DevForge, et connexion, inscription et API d'authentification communes à Next.js, Laravel, Symfony, React et Vue.

### Nouveautés

- **projets** : Authentification React et Vue, client du contrat DevForge (v3.4 lot 6) ([9eb3e81](https://github.com/victhille/devforge/commit/9eb3e81a87e4c676cacc571b2f8bb08bbd5b50d4))
- **projets** : Authentification Symfony sur le contrat DevForge (v3.4 lot 5) ([21b1131](https://github.com/victhille/devforge/commit/21b1131b06e4aa9b59303c2ca5091f7617d93346))
- **projets** : Authentification Laravel sur le contrat DevForge (v3.4 lot 4) ([d04d1a5](https://github.com/victhille/devforge/commit/d04d1a500981b2befc44bbfcdb837f97307d5e89))
- **projets** : Authentification Next.js sur le contrat DevForge (v3.4 lot 3) ([8bd5d62](https://github.com/victhille/devforge/commit/8bd5d6213a79d89dec7e166ac214315ab03de99d))
- **projets** : Contrat d'API d'authentification commun (v3.4 lot 2) ([9ffb8a9](https://github.com/victhille/devforge/commit/9ffb8a907a5f7c15a8e0bae4a624d952c1ab922c))
- **projets** : Page d'accueil DevForge à la création (v3.4 lot 1) ([9db4adb](https://github.com/victhille/devforge/commit/9db4adbf13d069a5f977ef7369527f0adf9a4ca5))

### Corrections

- **projets** : Dashboard Next.js compatible Cache Components, affichage de l'accueil ([4897159](https://github.com/victhille/devforge/commit/4897159bb165dce41953e58d40166a5eb7238d35))

_2 changement(s) technique(s) (tests, CI, documentation du dépôt) non listé(s)._

## [3.3.1](https://github.com/victhille/devforge/compare/v3.3.0...v3.3.1) — 2026-10-27

> Création de projet fiabilisée : .gitignore avant le premier commit, Tailwind 4 et Prisma 7 configurés, branche main, journal lisible et console réglable.

### Nouveautés

- **console** : Console de création réglable, journal lisible, Laravel prêt à l'emploi ([edfac81](https://github.com/victhille/devforge/commit/edfac8108eb4e383649d742a41527ef332c27cba))

### Corrections

- **projets** : Next.js crée son dépôt sur main et garde son propre Tailwind ([c61f2d5](https://github.com/victhille/devforge/commit/c61f2d533f8c355aa9e817003be7bbb02dc32db5))
- **projets** : Création de projet et journal corrigés après les essais réels ([91205d9](https://github.com/victhille/devforge/commit/91205d9cf64e909191c870d58259f8a9f17afb84))

_1 changement(s) technique(s) (tests, CI, documentation du dépôt) non listé(s)._

## [3.3.0](https://github.com/victhille/devforge/compare/v3.2.0...v3.3.0) — 2026-10-27

> La fiche projet affiche sa base de données et ses paquets (npm, pnpm, yarn, Composer) : retards, vulnérabilités et mises à jour au choix, avec retour en arrière ; Forgy sait aussi les lire et les proposer.

### Nouveautés

- **aide** : F1 sur l'onglet Paquets ouvre sa propre page de doc ([70ce82c](https://github.com/victhille/devforge/commit/70ce82c9f6e881729903c999d5536adbb96c520f))
- **forgy** : Forgy dit ce qui est en retard ou vulnérable dans un projet, et propose une mise à jour annulable ([240ae45](https://github.com/victhille/devforge/commit/240ae45fa787620905caaa15128d2506147cf850))
- **paquets** : L'onglet Paquets lit aussi composer.json : Packagist, composer audit, mises à jour (dans Sail si besoin) ([41a8c98](https://github.com/victhille/devforge/commit/41a8c9833ee4a8f71895a375dd68492b0ac11746))
- **paquets** : Onglet Paquets : paquets en retard, vulnérabilités, mise à jour au choix avec retour en arrière ([be05b3d](https://github.com/victhille/devforge/commit/be05b3d06c99bfa0cba25dce3c2ae510b8cd2625))
- **projet** : La base de données s'affiche dans la fiche projet, et la page Base de données ramène au projet ([ce7ce30](https://github.com/victhille/devforge/commit/ce7ce308ab1619e8eca4c2a025cf55df24e021c0))

### Corrections

- **paquets** : Une vulnérabilité Composer sans gravité indiquée s'affiche « gravité non précisée » ([78fba0b](https://github.com/victhille/devforge/commit/78fba0bc4963e1cdb13913de1f35a0249e46499c))

_11 changement(s) technique(s) (tests, CI, documentation du dépôt) non listé(s)._

## [3.2.0](https://github.com/victhille/devforge/compare/v3.1.0...v3.2.0) — 2026-10-27

> Chaque page ouvre sa documentation (bouton « ? » ou F1), n8n et les alertes ntfy se règlent dans Connexions, plus de mélange français / anglais, et Forgy reconnaît ANTHROPIC_API_KEY.

### Nouveautés

- **connexions** : N8n et les alertes ntfy se règlent, se testent et se retirent dans Connexions ([352f7a6](https://github.com/victhille/devforge/commit/352f7a6e75069e6e8bd780b5ad8972a24cf5d126))
- **aide** : L'aide de chaque page sur le site, d'un clic ou avec F1 ([3822876](https://github.com/victhille/devforge/commit/3822876bfd488c189f377fb4f79fdd883274bc92))

### Corrections

- **langue** : Plus de mélange français / anglais, Forgy reconnaît ANTHROPIC_API_KEY ([b950932](https://github.com/victhille/devforge/commit/b950932817eaf24f32dc1e777488236cbb5af624))

_12 changement(s) technique(s) (tests, CI, documentation du dépôt) non listé(s)._

## [3.1.0](https://github.com/victhille/devforge/compare/v3.0.0...v3.1.0) — 2026-10-27

> Le menu ne montre les pages qui demandent un serveur (santé, services, sauvegardes, n8n, page de statut, VPN) qu'une fois un serveur configuré ; Paramètres › Connexions s'ouvre sans attendre.

### Nouveautés

- **menu** : Les pages qui demandent un serveur attendent qu'il y en ait un ([ef89c41](https://github.com/victhille/devforge/commit/ef89c417c0c55ce486488d2d1ce86c36bd444a99))

### Dépendances et build

- **lint** : Les worktrees de .claude/ hors du lint ([34bf957](https://github.com/victhille/devforge/commit/34bf957a7f73f1a15b3877e075906a45de9d796a))

_7 changement(s) technique(s) (tests, CI, documentation du dépôt) non listé(s)._

## [3.0.0](https://github.com/victhille/devforge/compare/v2.4.0...v3.0.0) — 2026-10-26

> DevForge devient public : rien de l'auteur dedans, tout se configure dans Paramètres › Connexions, premier lancement guidé, export, import et « Tout effacer ».

### Nouveautés

- **données** : Tout effacer, exporter et importer sa configuration ([f9f14ce](https://github.com/victhille/devforge/commit/f9f14cea2e3ea10012737e876511d4e25f8781b6))
- **public** : Rien de personnel dans le logiciel ([4ed973a](https://github.com/victhille/devforge/commit/4ed973afcd42a639c34aaa29deb644b304e7aeb1))
- **premier-lancement** : Langue, comptes, pages « à configurer » ([9b2a09d](https://github.com/victhille/devforge/commit/9b2a09df3baf3f91a3d1d18a99c4efe3360e495a))
- **paramètres** : Section Connexions (comptes, clés, serveurs, bases) ([c83179e](https://github.com/victhille/devforge/commit/c83179e107c54bb8823672f851bf11f5d5ffc519))
- **accueil** : Les cartes en Masonry ([edd302c](https://github.com/victhille/devforge/commit/edd302ced5ec96ceabcd1bf4c2eed42ef91323b3))

### Corrections

- **données** : La page vide sa mémoire elle-même avant de tout effacer ([0d2f907](https://github.com/victhille/devforge/commit/0d2f907ce66aa92aabe91c0938dd0c26eb63a5bd))
- **connexions** : Sondes lentes gardées une minute, effacement qui n'attend plus Chromium ([70f7a23](https://github.com/victhille/devforge/commit/70f7a230122842ed6563684ebf3012f2ad4c82a3))

### Dépendances et build

- **public** : Mises à jour sans jeton (dépôt public) ([0001a53](https://github.com/victhille/devforge/commit/0001a5366f6c5e49e23798f59cea6a457def7b09))

_4 changement(s) technique(s) (tests, CI, documentation du dépôt) non listé(s)._

## [2.4.0](https://github.com/victhille/devforge/compare/v2.3.1...v2.4.0) — 2026-10-25

> Nouveau logo : l'enclume orange de DevForge mobile.

### Nouveautés

- **design** : Le logo de DevForge mobile (enclume orange), une seule flèche sur « Retour » ([ca9e520](https://github.com/victhille/devforge/commit/ca9e5204d7f1d38e088e6a5d7c37732573b6e1dc))

_2 changement(s) technique(s) (tests, CI, documentation du dépôt) non listé(s)._

## [2.3.1](https://github.com/victhille/devforge/compare/v2.3.0...v2.3.1) — 2026-10-25

> Le premier bloc d'un terminal cmd n'affiche plus la commande interne de DevForge.

### Corrections

- **terminal** : L'écho de la commande retiré même après la bannière de cmd ([9118ef4](https://github.com/victhille/devforge/commit/9118ef4334870098431868d604b6b56f69d27426))

## [2.3.0](https://github.com/victhille/devforge/compare/v2.2.0...v2.3.0) — 2026-10-25

> Laravel Sail, Auth.js et retour en arrière Prisma dans les ateliers, Forgy dans les trois ateliers, une base Docker propre à chaque projet, codes de retour dans cmd.

### Nouveautés

- **forgy** : Forgy dans les ateliers Laravel et Next.js ([c6d1145](https://github.com/victhille/devforge/commit/c6d11458e3a69902e91aeff95cbe457a08314bad))
- **laravel** : Sail à la création et dans l'atelier ([8afa8fd](https://github.com/victhille/devforge/commit/8afa8fdaabaf30e69e68f3d2518f72d4dda601c9))
- **nextjs** : Auth.js dans l'atelier (GitHub, Google, e-mail) ([58600a8](https://github.com/victhille/devforge/commit/58600a840373645bb630d4d02af3ef2ea68f5685))
- **nextjs** : Revenir en arrière sur une migration Prisma ([0df1216](https://github.com/victhille/devforge/commit/0df1216e6c52da3f4958ddeabaaae07df50018dd))
- **terminal** : Code de retour dans cmd, shells gardés sur la page projet ([93f6258](https://github.com/victhille/devforge/commit/93f6258d8c0524370ba470a2a41a0237ce29d5d9))
- **projets** : Une base Docker propre à chaque projet ([401977d](https://github.com/victhille/devforge/commit/401977d360588ce4504054d2ee3eaf5d35c27535))

_1 changement(s) technique(s) (tests, CI, documentation du dépôt) non listé(s)._

## [2.2.0](https://github.com/victhille/devforge/compare/v2.1.0...v2.2.0) — 2026-10-25

> Projets complets dès la création, ateliers Symfony, Laravel et Next.js, lanceur global, page de statut et terminal en blocs.

### Nouveautés

- **ateliers** : Ateliers Laravel et Next.js ([52e93ac](https://github.com/victhille/devforge/commit/52e93ac0d3fa374ba96444a331e1eec52644a142))
- **terminal** : Terminal en blocs ([7fe9e77](https://github.com/victhille/devforge/commit/7fe9e775e4efb250ec6012b725d82cc8ce8da14f))
- **statut** : Page de statut et surveillance 24 h/24 depuis le VPS ([a290c7c](https://github.com/victhille/devforge/commit/a290c7c2427c354e13b5af0a1e5c0a5162396a8f))
- **lanceur** : Lanceur global sur Ctrl+Alt+Espace ([2430d34](https://github.com/victhille/devforge/commit/2430d34edbc6b1c0ab7e8353df599a2f07217313))
- **symfony** : Atelier Symfony dans la page projet ([cfed7ed](https://github.com/victhille/devforge/commit/cfed7ed45195707d2aca478f36588950c8dc9b0c))
- **projets** : Création enrichie (base, options, Git et GitHub) ([c9918a7](https://github.com/victhille/devforge/commit/c9918a78bd5127c310feee1a724e247b23004f84))

### Corrections

- **statut** : Retours de la première installation sur le VPS ([faf5f10](https://github.com/victhille/devforge/commit/faf5f108fbe9495a7b87ba14f127fc2f72a52148))

_2 changement(s) technique(s) (tests, CI, documentation du dépôt) non listé(s)._

## [2.1.0](https://github.com/victhille/devforge/compare/v2.1.0-beta.4...v2.1.0) — 2026-10-24

> DevForge 2.1 : ton VPS sous contrôle (services en un clic, santé, sauvegardes de nuit), un accueil à composer, une palette qui agit, le mode compact, les .env synchronisés, GitHub sur la page projet, Automations sur l'accueil, Forgy qui veille sur tout ça, des mises à jour qui arrivent toutes seules et un menu mieux rangé.

### Nouveautés

- **menu** : 6 groupes de 5 pages au plus ([2c0e8f0](https://github.com/victhille/devforge/commit/2c0e8f095dc64d9ead15c01b77c6025360a10e2e))

## [2.1.0-beta.4](https://github.com/victhille/devforge/compare/v2.1.0-beta.3...v2.1.0-beta.4) — 2026-10-23

> Tes automatisations Automations s'affichent sur l'accueil de DevForge, et Forgy peut lire leur flux.

### Nouveautés

- **automations** : Widget Automatisations et lecture du flux par Forgy ([f237ba2](https://github.com/victhille/devforge/commit/f237ba2b3c2b3678cc893bbe4db3169304b13ae4))

## [2.1.0-beta.3](https://github.com/victhille/devforge/compare/v2.1.0-beta.2...v2.1.0-beta.3) — 2026-10-23

> Les mises à jour arrivent enfin toutes seules : DevForge lit les versions avec ta connexion GitHub CLI, et le bouton « Mettre à jour » apparaît à côté de Forgy.

### Corrections

- **updates** : Lire les versions du dépôt privé avec le jeton de GitHub CLI ([b30db5d](https://github.com/victhille/devforge/commit/b30db5dcd59d268d219b390c288cb4006083f76b))

## [2.1.0-beta.2](https://github.com/victhille/devforge/compare/v2.1.0-beta.1...v2.1.0-beta.2) — 2026-10-23

> Sauvegardes de nuit du VPS avec copie sur le PC, accueil à composer soi-même, palette qui agit, mode compact, .env synchronisés avec le serveur, GitHub sur la page projet, et Forgy qui veille sur le VPS.

### Nouveautés

- Synchronisation des .env, GitHub sur la page projet, Forgy plus complet ([0f42c13](https://github.com/victhille/devforge/commit/0f42c136f73073c513033d5c2816d588021c32fb))
- **home** : Accueil personnalisable, palette avec actions, mode compact ([4ab77a2](https://github.com/victhille/devforge/commit/4ab77a22b5830be084631bb9744e8cc0813cbdfc))
- **backups** : Sauvegardes automatiques du VPS ([2f51720](https://github.com/victhille/devforge/commit/2f5172092c4df14c5171038611618aa157480474))

## [2.1.0-beta.1](https://github.com/victhille/devforge/compare/v2.0.0...v2.1.0-beta.1) — 2026-10-22

> Un bouton « Mettre à jour » à côté de Forgy, et ton VPS sous contrôle : ses services web s'ouvrent en un clic, et une page Santé signale ce qui demande ton attention.

### Nouveautés

- **vps** : Bouton Mise à jour, services et santé du VPS ([e8ff195](https://github.com/victhille/devforge/commit/e8ff1952b2ff997b368338c859b97e42837aeaba))

### Corrections

- **i18n** : Pas de texte vide pour les niveaux de santé impossibles ([22952bf](https://github.com/victhille/devforge/commit/22952bff137552191c86eaa512f7f06a74570309))

_1 changement(s) technique(s) (tests, CI, documentation du dépôt) non listé(s)._

## [2.0.0](https://github.com/victhille/devforge/compare/v2.0.0-beta.5...v2.0.0) — 2026-10-22

> DevForge 2.0 : Forgy agit pour toi, n8n s'installe et se pilote sur ton VPS (aussi en français), une page VPN pour WireGuard, Vercel, la dictée vocale en local, des paramètres et un menu à ton goût.

### Nouveautés

- **menu** : Favoris du menu au choix ([81c1b44](https://github.com/victhille/devforge/commit/81c1b44642bf6bf73471dec58956967de0a263a2))

### Corrections

- **ssh** : Requêtes HTTP par la session SSH (wg-easy 408, clé d'API n8n) ([25b0231](https://github.com/victhille/devforge/commit/25b0231d4b80ab005871826ef9442ca149ed8569))

## [2.0.0-beta.5](https://github.com/victhille/devforge/compare/v2.0.0-beta.4...v2.0.0-beta.5) — 2026-10-22

> Nouvelle page VPN : les clients WireGuard du VPS, avec ajout, suppression et QR code, sans ligne de commande.

### Nouveautés

- **vpn** : Page VPN pour le WireGuard du VPS (wg-easy) ([cd98eba](https://github.com/victhille/devforge/commit/cd98eba915df169e7ab61c689ba86df91e889e7e))

### Corrections

- **ui** : Sélecteurs alignés avec les boutons, version au-dessus de « Réduire le menu » ([92a7642](https://github.com/victhille/devforge/commit/92a7642a87c347810ea3fbb6bbdc9f9250f95c54))

_2 changement(s) technique(s) (tests, CI, documentation du dépôt) non listé(s)._

## [2.0.0-beta.4](https://github.com/victhille/devforge/compare/v2.0.0-beta.3...v2.0.0-beta.4) — 2026-10-20

> n8n s'ouvre seulement quand son éditeur est prêt : plus de « Cannot GET / » juste après un démarrage.

### Corrections

- **n8n** : Attendre l'éditeur avant d'annoncer que n8n est prêt ([723e661](https://github.com/victhille/devforge/commit/723e6613d31d814497ac43307ef51340e3e38290))

## [2.0.0-beta.3](https://github.com/victhille/devforge/compare/v2.0.0-beta.2...v2.0.0-beta.3) — 2026-10-20

> n8n peut s'afficher en français : une option sur la page n8n utilise la traduction communautaire, mise à jour à chaque version.

### Nouveautés

- **n8n** : Interface de n8n en français ([a2644db](https://github.com/victhille/devforge/commit/a2644db89ae6c08c4256f43ab724816b729c42da))

## [2.0.0-beta.2](https://github.com/victhille/devforge/compare/v2.0.0-beta.1...v2.0.0-beta.2) — 2026-10-20

> n8n s'ouvre depuis DevForge sans commande, et le domaine est vérifié avant l'installation.

### Corrections

- **n8n** : N8n s'ouvre depuis DevForge sans commande, le sous-domaine est vérifié avant l'installation HTTPS, et l'ancien Caddy est retiré ([db58d44](https://github.com/victhille/devforge/commit/db58d442beed13ff0b9ffdb9537a77df216d6e62))

## [2.0.0-beta.1](https://github.com/victhille/devforge/compare/v1.5.0...v2.0.0-beta.1) — 2026-10-20

> DevForge 2.0 : Forgy agit, une page par projet, le VPS surveillé, n8n et Vercel.

### Nouveautés

- Dictée Whisper sur ton PC, premier démarrage guidé, meilleure accessibilité (clavier, contrastes) et CPU des services Docker ([f43c747](https://github.com/victhille/devforge/commit/f43c7476b5a85e678bdc85f69f594d7fb6389437))
- Paramètres et notes de version repensés, fenêtre « Quoi de neuf », n8n installé et suivi sur le VPS, déploiements Vercel sur la page projet ([aceecac](https://github.com/victhille/devforge/commit/aceecacf7c578dff3b9c92b698339cca51bed290))
- **monitor** : Surveillance du VPS en arrière-plan avec 7 jours d'historique, courbes 24 h, alertes, et Docker sur le VPS ([834d7ca](https://github.com/victhille/devforge/commit/834d7ca3b79380904ec31040de69baeb6f15e219))
- **projects** : Page projet qui réunit Git, Docker, variables, bases, logs, ports et déploiement, avec un projet actif suivi par Forgy et l'accueil ([c33050f](https://github.com/victhille/devforge/commit/c33050fcb9796842caa07efef62e0cb153aa3ccd))
- **assistant** : Forgy peut agir : commit, Compose, SQL, ports, scripts, variables .env, toujours après ta validation, avec journal et annulation ([8078bef](https://github.com/victhille/devforge/commit/8078bef608b06ffec83e5e794967db11b195e3be))
- Bases de la v2 : données versionnées et sauvegardées, journal local avec rapport de diagnostic, canal bêta, thème clair revu ([a8f41db](https://github.com/victhille/devforge/commit/a8f41db7616d99b292e9bfa09d1841f0811390dc))

## [1.5.0](https://github.com/victhille/devforge/compare/v1.4.1...v1.5.0) — 2026-10-19

> DevForge change de tête : menu repensé, accueil vivant, et Forgy qui se promène avec Boulon.

### Nouveautés

- Nouveau design : menu repensé, accueil vivant, panneau Forgy, pages refaites, Forgy se promène avec Boulon et widget de bureau ([5269c6f](https://github.com/victhille/devforge/commit/5269c6f994ff1a67bb472538019cf8183f9c29b6))

## [1.4.1](https://github.com/victhille/devforge/compare/v1.4.0...v1.4.1) — 2026-10-18

> Une application plus fluide, surtout quand elle tourne en arrière-plan.

### Performances

- Application plus fluide : la mascotte ne consomme plus rien au repos, pages Git et Docker plus rapides ([d8b1c39](https://github.com/victhille/devforge/commit/d8b1c394168a780a43e978ae0499ceadd08751dd))

## [1.4.0](https://github.com/victhille/devforge/compare/v1.3.0...v1.4.0) — 2026-10-18

> Arrivée de Forgy, l'assistant qui connaît ton projet et la page où tu es.

### Nouveautés

- **assistant** : Recherche web dans l'assistant (avec sources) et raccourcis vers Claude Code, Codex, Antigravity, Gemini et les apps web ([a16b0ef](https://github.com/victhille/devforge/commit/a16b0ef5622e107096ee2f0e5b534bad2b38a494))
- **assistant** : Forgy, le petit robot de l'assistant, montre ce qu'il fait (réfléchit, cherche, écrit, a fini…) ([34863f1](https://github.com/victhille/devforge/commit/34863f12a27dea2df4e96cdce55325cdae7cd53b))
- **assistant** : Tâches prêtes à l'emploi et maîtrise du coût de l'assistant (modèle adapté à chaque tâche, budget mensuel) ([4784969](https://github.com/victhille/devforge/commit/47849695549eadaee480d7ee743a0f5a29c0a843))
- **assistant** : Assistant IA intégré (Ctrl+J) qui connaît le projet et la page en cours, en lecture seule ([91d4583](https://github.com/victhille/devforge/commit/91d4583bd344a35ad4e12882e21ae18db4b92143))

### Corrections

- **settings** : « Voir les nouveautés » ouvre aussi les notes quand on est déjà sur la page Paramètres ([8d863b4](https://github.com/victhille/devforge/commit/8d863b479b05aa9356a0c8f4aeda6dca6066d48d))

_1 changement(s) technique(s) (tests, CI, documentation du dépôt) non listé(s)._

## [1.3.0](https://github.com/victhille/devforge/compare/v1.2.2...v1.3.0) — 2026-10-18

> L'API Tester sait afficher les pages HTML.

### Nouveautés

- **api-tester** : Aperçu des réponses HTML et onglet des en-têtes de réponse dans l'API Tester ([c5cd4c1](https://github.com/victhille/devforge/commit/c5cd4c1038c7c25f0641f57176123256bf476dec))

## [1.2.2](https://github.com/victhille/devforge/compare/v1.2.1...v1.2.2) — 2026-10-18

### Corrections

- **i18n** : Le message de mise à jour et le démarrage de l'application respectent la langue choisie ([792db33](https://github.com/victhille/devforge/commit/792db335100ee3b5d09a96b7676f6c7bffa65dda))

## [1.2.1](https://github.com/victhille/devforge/compare/v1.2.0...v1.2.1) — 2026-10-18

### Corrections

- **release** : Notes de version dans la langue de l'application (français ou anglais) ([5697bec](https://github.com/victhille/devforge/commit/5697bec3a9c39afeaddb23346158f31cde96f9f5))

_2 changement(s) technique(s) (tests, CI, documentation du dépôt) non listé(s)._

## [1.2.0](https://github.com/victhille/devforge/compare/v1.1.0...v1.2.0) — 2026-10-18

### Nouveautés

- **versions** : Versions automatiques à partir des commits, notes de version et publication sur GitHub ([10231a1](https://github.com/victhille/devforge/commit/10231a16ba84c8c06066061e6baecd3ccf5c5cea))
- Explorateur de base façon phpMyAdmin (structure, index, relations, infos) et panneau des connexions rétractable ([3997dd8](https://github.com/victhille/devforge/commit/3997dd888eb5730dc36d37f85524f16f557930a9))
- **base de données** : Plus de plantage quand le serveur coupe la connexion (ex. arrêt d'un conteneur) : reconnexion automatique ([fa5c603](https://github.com/victhille/devforge/commit/fa5c603ed26b87db1119792db980f3cc01ec7b31))
- **docker** : Les projets Compose affichent leurs services, le projet DevForge lié passe en légende ([ad91998](https://github.com/victhille/devforge/commit/ad919987125173b65d50e42624c01f37b500f92a))
- **docker** : Lancer les projets Compose depuis DevForge, nettoyage qui épargne leurs conteneurs, détection des bases depuis le compose ([ccac89f](https://github.com/victhille/devforge/commit/ccac89fee8bff775635a8a0cafbf3eeda2375e64))
- **BDD via SSH** : Essai aussi de l'adresse publique du serveur, depuis le serveur ([5a1371f](https://github.com/victhille/devforge/commit/5a1371fd9e6a9aa71f8d666ea29493a98e3998f0))
- **BDD via SSH** : Recherche de la base dans les conteneurs Docker du serveur quand son adresse ne répond pas ([3733ba6](https://github.com/victhille/devforge/commit/3733ba64820641b5e20bb1082d27f7393077e616))
- **base de données** : Accès aux bases hébergées sur un serveur SSH enregistré via un tunnel SSH automatique ([d834c47](https://github.com/victhille/devforge/commit/d834c474c70a5c8edcc2877c24d5ebab84dbd2f0))
- Interface isolée (sandbox + CSP), le testeur d'API passe par le processus principal ([99b6885](https://github.com/victhille/devforge/commit/99b68853ce41beec7c775a5513c6f7ba6a7f20b0))

### Sécurité

- Vérification des clés des serveurs SSH (confiance à la première connexion) ([fae5336](https://github.com/victhille/devforge/commit/fae533648ef7bdce3aa57620509a849bc2f4a5f3))
- Plus d'injection de commandes via les chemins, URL ou noms de scripts ([fbac784](https://github.com/victhille/devforge/commit/fbac7846db062f122739472ef97edb41679a6892))

### Corrections

- Tests, lint et CI ; correction du cron (dimanche = 7) et des antislashs doublés dans les .env ([fc8fd2a](https://github.com/victhille/devforge/commit/fc8fd2a02dfa54fae396d0991001bd2b322e2c33))
- Détection sur serveur distant : scripts correctement protégés pour le shell distant ([f5d5097](https://github.com/victhille/devforge/commit/f5d5097a553fa4e35e99b3408762097945999c33))

### Dépendances et build

- Electron 29 → 44.5.1 et electron-builder 26 ([400dea5](https://github.com/victhille/devforge/commit/400dea5856e54c0e5ad507122aa8743c14931cd7))

## 1.1.0 — 2026-10-17

### Nouveautés

- Une seule suggestion de domaine par projet, même avec plusieurs serveurs de dev ([19df9cb](https://github.com/victhille/devforge/commit/19df9cb8e888ecac6e51dbf02f20421e865420f8))
- Détection des projets déployés sur un serveur et création des cibles de déploiement ([e87f81f](https://github.com/victhille/devforge/commit/e87f81ff55f6636ca59a93bd8fe8d1cf89cb36d6))
- Suggestions de fichiers de log, d’URL à surveiller et de domaines locaux depuis les projets ([94e90c9](https://github.com/victhille/devforge/commit/94e90c9ca8ccad72bd17fda9ca6c92edf5edcf6d))
- **base de données** : Tunnels SSH, détection sur serveur et import depuis les .env ([f35a7a7](https://github.com/victhille/devforge/commit/f35a7a7c00e5f42abc898dcbe317fa820aee5361))
- Barre latérale rétractable (icônes seules, Ctrl+B) et panneau des serveurs SSH ([214c3e3](https://github.com/victhille/devforge/commit/214c3e35b557a76e70e22a48d730d0c4153da109))
- Suppression du « + » en double sur les boutons qui ont déjà une icône ([24bcc41](https://github.com/victhille/devforge/commit/24bcc414fc2cd114971d5ffac553607bbbe6813d))
- Outils cron, timestamp et URL dans la boîte à outils ([dfed783](https://github.com/victhille/devforge/commit/dfed783db0e64029e1321d5f18a5edc16298edbd))
- Testeur de webhooks ([14641b3](https://github.com/victhille/devforge/commit/14641b397c58110dc01a6acde2767576b55f2ca7))
- Lecteur de fichiers de log en direct ([62fccd0](https://github.com/victhille/devforge/commit/62fccd090d22634f75d6826193f5bed4bd57ab22))
- Client de base de données (PostgreSQL, MySQL/MariaDB, SQLite) ([b33c1b9](https://github.com/victhille/devforge/commit/b33c1b9819ca2890cdeef0030f24ad329655f441))
- Domaines locaux (.test) avec reverse proxy intégré ([4c0f0fb](https://github.com/victhille/devforge/commit/4c0f0fbe6cd059ac5c2db554379c9aadf91d5255))
- Surveillance d'URL en arrière-plan ([d5f687d](https://github.com/victhille/devforge/commit/d5f687d7661966ce128130b1225bf3158f67450d))
- Déploiement en un clic via SSH ([817eba1](https://github.com/victhille/devforge/commit/817eba150bf533fc85926006bec2f43ca9f77fce))
- Panneau Docker local ([c4576f9](https://github.com/victhille/devforge/commit/c4576f940070ffc46ce47d3d2ef65eaff5154a89))
- Assistant de commit et protection des pages contre les erreurs ([5625f9c](https://github.com/victhille/devforge/commit/5625f9c532ad88fee22f89a7e6bc3fd26353a5cb))
- Lanceur de stacks ([5c6a123](https://github.com/victhille/devforge/commit/5c6a1230e087d6f323d9d5f7e31046fff216a19f))
- Gestionnaire de .env et vérification des versions requises par les projets ([96ec86d](https://github.com/victhille/devforge/commit/96ec86d8792d76a98abaa1248eeeaef6ab58b6df))
- Nettoyeur de disque et barre latérale réorganisée ([5776d07](https://github.com/victhille/devforge/commit/5776d07f15c73919e8f376004481ec31bb13bace))
- Tableau de bord Git multi-projets et notifications ([1061393](https://github.com/victhille/devforge/commit/1061393ff6367a825cb196ce0523574325bf14d3))
- Palette de commandes (Ctrl+K) et registre de navigation unique ([9b8beea](https://github.com/victhille/devforge/commit/9b8beea207d34704f7c0d093072afc497b80c9c1))
- Processus principal non bloquant, pages chargées à la demande, interface plus aérée ([008f303](https://github.com/victhille/devforge/commit/008f3034cb9acb76ffed66d77c8497f150f50b52))
- Mots de passe SSH chiffrés (safeStorage), suppression de code inutilisé ([133c6d9](https://github.com/victhille/devforge/commit/133c6d91df872212c4be45c15fb31e53839a8238))
- État initial de DevForge ([9ab2849](https://github.com/victhille/devforge/commit/9ab2849380d038c1e1d2d1b3c590a09d432710db))

### Corrections

- Affichage des chemins des logs suggérés sous Windows ([33d124f](https://github.com/victhille/devforge/commit/33d124ff2e4d066131bd5403951d8035b1404e3c))
- Conflit de couleur du texte, refonte de la navigation, des onglets et des boutons ([bb1d636](https://github.com/victhille/devforge/commit/bb1d6367bcd8d699922e66f7ec4e426e79a6b52a))

### Améliorations internes

- Conversion des derniers fichiers CRLF en LF ([4bcf26a](https://github.com/victhille/devforge/commit/4bcf26aade96566ac3ae061727ac9f90f5b763da))
- Fins de ligne normalisées en LF (.gitattributes) ([53a082a](https://github.com/victhille/devforge/commit/53a082a2bb733fd68862e47cebbfa3671a033c6d))
- Messages git attendus masqués dans getGitStatus ([eb0bf19](https://github.com/victhille/devforge/commit/eb0bf196c9a3218aef944c1d25ee3ee660bcbd9e))
- Interface passée à Tailwind v4, gros fichiers découpés ([efc35bf](https://github.com/victhille/devforge/commit/efc35bfd24db2847e24b274bf290842f6cb8b9b3))
- Architecture réorganisée par fonctionnalité ([67ea2d4](https://github.com/victhille/devforge/commit/67ea2d4f4181a4ba2fa62816670a4ec20d1ba10d))
