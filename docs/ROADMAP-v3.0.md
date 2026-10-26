# Feuille de route v3.0 — DevForge public

**Cap** : DevForge devient un logiciel public. Celui qui le récupère n'y trouve rien de l'auteur (ni serveur, ni compte, ni projet) et le configure entièrement pour en faire son propre outil de gestion de dev.
**Base** : v2.4.0.

## Ce que l'audit a trouvé (26/10/2026)

Bonne nouvelle de départ : les serveurs, clés et comptes ne sont pas dans le code. Ils se saisissent dans l'appli et restent sur le PC (`%APPDATA%\DevForge`, secrets chiffrés par Windows). Restent liés à l'auteur :
- la source des mises à jour (`victhille/devforge` dans `updater.ts`) et les liens GitHub et « Signaler un problème » des Paramètres ;
- le module d'automatisations personnelles (appli de l'auteur) : page, widget de l'accueil, outil de Forgy ;
- des exemples écrits en dur (« Téléphone de l'auteur ») ;
- surtout l'historique Git et `docs/` : IP du VPS, hébergeur, noms de projets de test, adresses sslip.io.

## Décisions prises

- **Historique** : réécrit (git filter-repo) pour effacer les infos sensibles de tous les commits, puis ce dépôt devient public.
- **Module d'automatisations personnelles** : retiré du logiciel.
- **Licence** : MIT.

## Vue d'ensemble

| Lot | Contenu | Taille |
|---|---|---|
| 1 | Paramètres › Connexions : chaque service, son état, le configurer, le tester, le retirer | L |
| 2 | Premier lancement et pages « à configurer » | M |
| 3 | Rien de personnel dans le logiciel (module personnel retiré, exemples, mises à jour) | M |
| 4 | Effacer, exporter, importer sa configuration | S |
| 5 | Dépôt public : historique réécrit, recherche de secrets, MIT, README | M |
| 6 | Vérification sur une installation vierge | S |

Taille : S ≈ 1 à 2 sessions, M ≈ 3 à 5, L ≈ 6 et plus.

## Lot 1 — Paramètres › Connexions

Une section unique qui liste tout ce que DevForge peut joindre, avec pour chacun : l'état (connecté, à configurer, en erreur), « Configurer », « Tester », « Déconnecter », et où c'est rangé.
- **GitHub** : compte via GitHub CLI (`gh auth login`) ou jeton ; identité Git (nom, e-mail) pour les commits.
- **Forgy** : clé API Anthropic.
- **Serveurs (VPS)** : connexions SSH (hôte, utilisateur, clé), test de connexion, surveillance.
- **Docker** : moteur local détecté, ou Docker d'un serveur par SSH.
- **Vercel** : jeton.
- **Bases de données** : connexions enregistrées.
- **n8n**, **alertes ntfy** (page de statut).

Règles : un secret ne se réaffiche jamais (seulement « renseigné ») ; chaque service non configuré reste simplement à configurer, sans erreur ailleurs.

**Fini quand** chaque service se configure, se teste et se retire depuis cette seule section.

**Fait** (Paramètres › Connexions, en tête du menu) :
- GitHub (état de GitHub CLI, jeton à saisir, tester, retirer), identité Git (`git config --global`), clé Forgy (le test liste les modèles : rien n'est facturé), Vercel, Docker (version du moteur, lien d'installation) ;
- serveurs SSH et bases de données : liste, tester, retirer, et ajout depuis cette section (les formulaires des pages SSH et Base de données s'ouvrent ici) ;
- aucun secret ne revient à l'écran : seulement « renseigné » ou « aucun ».

**Reste** : n8n et les alertes ntfy se règlent encore depuis leur page (ils dépendent d'un serveur).

## Lot 2 — Premier lancement et pages « à configurer »

- Assistant de premier lancement : langue (celle du système par défaut), dossier des projets, puis les connexions utiles, toutes facultatives et passables.
- Une page qui dépend d'un service non configuré (VPS, Vercel, n8n, page de statut…) montre « Configurer {service} », qui mène à la bonne ligne de Connexions, au lieu d'une page vide ou d'une erreur.
- Le menu et l'accueil n'affichent que ce qui sert.

**Fini quand** un profil vide se configure de bout en bout sans jamais voir d'erreur de service manquant.

**Fait** :
- premier lancement en 5 étapes : bienvenue avec choix de la langue (celle de Windows par défaut à la première installation, changée sur-le-champ), dossier des projets, **tes comptes** (identité Git, GitHub CLI détecté ou jeton facultatif, renvoi vers Connexions pour serveur, Vercel et bases), clé Forgy, fin ; tout reste passable ;
- composant commun « à configurer » : les pages qui agissent sur un serveur (n8n, page de statut, VPN, santé, services, sauvegardes, Docker distant, surveillance) et les widgets serveur de l'accueil montrent « Aucun serveur configuré » et un bouton vers Paramètres › Connexions, au lieu d'un message sans issue.

**Reste** : le menu montre encore toutes les pages, même celles dont le service n'est pas configuré (elles mènent à « à configurer ») ; à décider s'il faut les masquer.

## Lot 3 — Rien de personnel dans le logiciel

- Module personnel retiré : page, widget, outil de Forgy, réglages, types, tests.
- Les exemples deviennent neutres (« Mon téléphone », « mon-serveur »).
- Mises à jour et liens « À propos » lus dans `package.json` (`repository`) : un fork pointe vers son propre dépôt.
- L'image n8n en français (`ghcr.io/victhille/n8n-fr`) reste une option publique, présentée comme traduction communautaire.
- Recherche automatique en CI : l'IP, les noms de projets privés et l'adresse e-mail font échouer le build s'ils réapparaissent.

**Fini quand** une recherche des mots personnels dans `src/`, `scripts/`, `docs/` et les tests ne trouve rien.

**Fait** :
- module personnel d'automatisations retiré (service, page, widget de l'accueil, outil de Forgy, types, tests) ; un réglage d'accueil qui le contenait l'oublie tout seul ;
- exemples neutres : « Mon téléphone », adresse de documentation `203.0.113.10` (RFC 5737), prénoms et projets d'exemple ;
- mises à jour et liens « À propos » lus dans `package.json` (`build.publish`, `repository`), injectés au build : un fork change ces deux champs ; un dépôt public se met à jour sans jeton, un privé en demande un ;
- `scripts/check-personal.mjs` : échoue si un mot personnel revient ; la liste n'est jamais dans le dépôt (`.personal-patterns` ignoré par Git en local, secret `PERSONAL_PATTERNS` en CI, étape sautée tant qu'il manque) ; plus aucun fichier n'est exclu depuis le lot 5.

**Reste** : créer le secret `PERSONAL_PATTERNS` dans GitHub ; l'image n8n en français reste sous `ghcr.io/victhille/n8n-fr` (projet public).

## Lot 4 — Effacer, exporter, importer

- « Tout effacer » : connexions, clés, historique, journal, réglages ; confirmation forte.
- Exporter sa configuration (sans les secrets) et la réimporter sur un autre PC.

**Fini quand** « Tout effacer » ramène à l'écran de premier lancement, et qu'un import retrouve la configuration (secrets à ressaisir).

**Fait** (Paramètres › Données) :
- « Tout effacer », confirmé en tapant « effacer » : connexions, clés, projets, historiques, journal, sauvegardes de DevForge, réglages et mémoire de la page ; les modèles de dictée téléchargés et les dossiers de projets restent ; DevForge redémarre sur l'écran de bienvenue ;
- « Exporter » : un fichier JSON (projets, serveurs, bases, déploiements, surveillance, n8n, page de statut, VPN, réglages, réglages de Forgy) d'où tout champ secret est retiré (`…Enc`, mots de passe, jetons, clés) ;
- « Importer » : vérifie le fichier, fait une sauvegarde, écrit seulement les fichiers connus, marque le premier lancement comme fait, redémarre ; les secrets sont à ressaisir dans Connexions ;
- la liste des données sauvegardées (`DATA_ENTRIES`) comprend maintenant GitHub, sauvegardes VPS, page de statut, VPN, historique du terminal, hosts.

## Lot 5 — Dépôt public

- Recherche de secrets sur tout l'historique (gitleaks) avant et après.
- Réécriture de l'historique (git filter-repo) : retirer l'IP, les noms de projets et de comptes, les anciennes feuilles de route trop personnelles ; garder un historique lisible.
- Sauvegarde complète du dépôt avant, et vérification que l'appli et les releases continuent de marcher après (tags, CI, mises à jour automatiques des installations existantes).
- `LICENSE` (MIT), `README` (ce que c'est, captures, installation, compilation), `CONTRIBUTING`.
- Puis le dépôt passe en public.

**Fini quand** gitleaks ne trouve rien sur tout l'historique et que le dépôt est public, avec une release qui s'installe et se met à jour.

**Fait** :
- `scripts/scan-history.mjs` remplace gitleaks : cherche jetons (GitHub, Anthropic, OpenAI, AWS, Google, Slack, npm, Vercel), clés privées, mots de passe dans les URL, fichiers `.env` ou de clés, et les mots personnels, dans chaque version de chaque fichier, chaque message et chaque auteur ; n'affiche que l'endroit. Résultat : aucun secret dans tout l'historique (deux faux positifs : des modèles `${password}` et un exemple de test) ; les mots personnels sont dans d'anciens fichiers, un message de commit et l'auteur ;
- `LICENSE` (MIT, « DevForge contributors »), `README.md` et `README.en.md` (installation, configuration, compilation, fork), `CONTRIBUTING.md`, `"license": "MIT"` ;
- réécriture répétée sur une copie miroir (git filter-repo) : anciennes feuilles de route v1 à v2.3 retirées, mots personnels remplacés par des exemples neutres dans les fichiers et les messages, module personnel renommé « automations » (contenu et noms de fichiers, pour que les anciens commits restent cohérents), e-mail des commits remplacé par l'adresse GitHub privée (le nom reste) ; 130 commits, 23 tags ; le code final est identique à l'actuel ; les liens du CHANGELOG sont repointés vers les nouveaux commits (90 vérifiés un par un) ;
- les installeurs déjà publiés (v1.5.0 à v2.4.0) contiennent l'ancien code : décision de les supprimer après la 3.0.0.

- historique réécrit pour de bon et poussé en force (`main` et les 23 tags), liens du CHANGELOG corrigés, plus aucune exclusion dans `check-personal.mjs` ;
- projet DevForge mobile abandonné (26/10/2026) : branche, application et services du serveur supprimés ; notes des 22 releases corrigées (liens vers les nouveaux commits, mêmes remplacements que l'historique) ;
- `private: false` dans `build.publish` : un dépôt public se met à jour sans jeton ;
- CI : la section Connexions garde une minute les réponses de GitHub CLI et Docker, et « Tout effacer » vide la mémoire de la page sans `clearStorageData` (qui pouvait ne jamais rendre la main).

**Reste**, dans l'ordre :
1. faire purger par le support GitHub les anciens commits encore consultables par leur identifiant ; passer le dépôt en public ; publier la 3.0.0 ;
2. une fois les installations à jour : supprimer à la main les releases v1.5.0 à v2.4.0.

## Lot 6 — Vérification sur une installation vierge

- Installer depuis la release publique sur un profil Windows vierge (ou une VM) : rien de l'auteur, premier lancement, configuration complète d'un serveur, d'un compte GitHub, d'une clé Forgy.
- Ta propre installation reprend ses données sans rien perdre.

**Fini quand** les deux parcours marchent : celui d'un inconnu, et le tien.

**Fait** (26/10/2026) :
- installeur public téléchargé sans connexion : empreinte identique à `latest.yml` ; ouvert sans l'installer (9 737 fichiers de l'app, 474 d'Electron) : aucun mot personnel, aucune adresse e-mail de l'auteur, aucun jeton ; seule « clé privée » trouvée : la clé de test publique de la bibliothèque `ssh2` ;
- l'app ne contient que le code compilé et ses dépendances (ni sources, ni tests, ni scripts) ; `app-update.yml` : `victhille/devforge`, `private: false` ; le flux de mises à jour se lit sans jeton ;
- **ton parcours** : la 2.4.0 s'est mise à jour toute seule en 3.0.0 ; projets, serveur, bases, clé Forgy et réglages intacts ; aucune erreur au journal. Le téléchargement différentiel a échoué une fois (l'ancienne blockmap est restée dans le dépôt archivé) : installeur complet téléchargé à la place, sans conséquence.

**Reste : le parcours d'un inconnu**, sur un profil Windows vierge (nouvel utilisateur Windows ou machine virtuelle) :
1. télécharger `DevForge-Setup-v3.0.0.exe` depuis la page des releases ; SmartScreen : « Informations complémentaires » puis « Exécuter quand même » ;
2. premier lancement : l'écran de bienvenue est dans la langue de Windows ; aucun projet, serveur, compte ni widget rempli ; « À propos » pointe vers `victhille/devforge` ;
3. suivre les 5 étapes : langue, dossier de projets, comptes (identité Git, GitHub CLI ou jeton), clé Forgy, fin ; tout passer une fois, puis tout refaire depuis Paramètres › Connexions ;
4. Connexions : ajouter un serveur SSH et le tester, enregistrer un jeton GitHub et le tester, une clé Forgy et la tester, puis tout retirer ;
5. ouvrir les pages qui dépendent d'un serveur (n8n, page de statut, VPN, santé…) : elles disent « Aucun serveur configuré » et mènent à Connexions, sans erreur ;
6. Données : exporter, « Tout effacer » (retour à l'écran de bienvenue), importer : la configuration revient, les secrets sont à ressaisir ;
7. créer un projet de bout en bout (Node ou Next.js), l'ouvrir dans le terminal.

## Questions encore ouvertes

- Signature du code (un certificat évite l'alerte SmartScreen de Windows, mais il est payant) : à décider avant le lot 5.
- Langue par défaut : celle du système, l'anglais sinon. À confirmer.
