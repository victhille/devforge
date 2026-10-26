# Feuille de route v3.0 — DevForge public

**Cap** : DevForge devient un logiciel public. Celui qui le récupère n'y trouve rien de alice (ni serveur, ni compte, ni projet) et le configure entièrement pour en faire son propre outil de gestion de dev.
**Base** : v2.4.0.

## Ce que l'audit a trouvé (26/10/2026)

Bonne nouvelle de départ : les serveurs, clés et comptes ne sont pas dans le code. Ils se saisissent dans l'appli et restent sur le PC (`%APPDATA%\DevForge`, secrets chiffrés par Windows). Restent liés à alice :
- la source des mises à jour (`victhille/devforge` dans `updater.ts`) et les liens GitHub et « Signaler un problème » des Paramètres ;
- le module Automations (appli personnelle) : page, widget de l'accueil, outil de Forgy ;
- des exemples écrits en dur (« Téléphone de alice ») ;
- surtout l'historique Git et `docs/` : IP du VPS, hosting, noms de projets de test, adresses sslip.io.

## Décisions prises

- **Historique** : réécrit (git filter-repo) pour effacer les infos sensibles de tous les commits, puis ce dépôt devient public.
- **Automations** : retiré du logiciel.
- **Licence** : MIT.

## Vue d'ensemble

| Lot | Contenu | Taille |
|---|---|---|
| 1 | Paramètres › Connexions : chaque service, son état, le configurer, le tester, le retirer | L |
| 2 | Premier lancement et pages « à configurer » | M |
| 3 | Rien de personnel dans le logiciel (Automations retiré, exemples, mises à jour) | M |
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
- **n8n**, **alertes ntfy** (page de statut), **DevForge mobile** (pont d'approbation).

Règles : un secret ne se réaffiche jamais (seulement « renseigné ») ; chaque service non configuré reste simplement à configurer, sans erreur ailleurs.

**Fini quand** chaque service se configure, se teste et se retire depuis cette seule section.

**Fait** (Paramètres › Connexions, en tête du menu) :
- GitHub (état de GitHub CLI, jeton à saisir, tester, retirer), identité Git (`git config --global`), clé Forgy (le test liste les modèles : rien n'est facturé), Vercel, Docker (version du moteur, lien d'installation) ;
- serveurs SSH et bases de données : liste, tester, retirer, et ajout depuis cette section (les formulaires des pages SSH et Base de données s'ouvrent ici) ;
- aucun secret ne revient à l'écran : seulement « renseigné » ou « aucun ».

**Reste** : n8n et les alertes ntfy se règlent encore depuis leur page (ils dépendent d'un serveur) ; le pont DevForge mobile est sur la branche `feat/mobile-bridge`, pas encore fusionnée.

## Lot 2 — Premier lancement et pages « à configurer »

- Assistant de premier lancement : langue (celle du système par défaut), dossier des projets, puis les connexions utiles, toutes facultatives et passables.
- Une page qui dépend d'un service non configuré (VPS, Vercel, n8n, page de statut…) montre « Configurer {service} », qui mène à la bonne ligne de Connexions, au lieu d'une page vide ou d'une erreur.
- Le menu et l'accueil n'affichent que ce qui sert.

**Fini quand** un profil vide se configure de bout en bout sans jamais voir d'erreur de service manquant.

## Lot 3 — Rien de personnel dans le logiciel

- Automations retiré : page, widget, outil `automations_feed`, réglages, types, tests.
- Les exemples deviennent neutres (« Mon téléphone », « mon-serveur »).
- Mises à jour et liens « À propos » lus dans `package.json` (`repository`) : un fork pointe vers son propre dépôt.
- L'image n8n en français (`ghcr.io/victhille/n8n-fr`) reste une option publique, présentée comme traduction communautaire.
- Recherche automatique en CI : l'IP, les noms de projets privés et l'adresse e-mail font échouer le build s'ils réapparaissent.

**Fini quand** une recherche des mots personnels dans `src/`, `scripts/`, `docs/` et les tests ne trouve rien.

## Lot 4 — Effacer, exporter, importer

- « Tout effacer » : connexions, clés, historique, journal, réglages ; confirmation forte.
- Exporter sa configuration (sans les secrets) et la réimporter sur un autre PC.

**Fini quand** « Tout effacer » ramène à l'écran de premier lancement, et qu'un import retrouve la configuration (secrets à ressaisir).

## Lot 5 — Dépôt public

- Recherche de secrets sur tout l'historique (gitleaks) avant et après.
- Réécriture de l'historique (git filter-repo) : retirer l'IP, les noms de projets et de comptes, les anciennes feuilles de route trop personnelles ; garder un historique lisible.
- Sauvegarde complète du dépôt avant, et vérification que l'appli et les releases continuent de marcher après (tags, CI, mises à jour automatiques des installations existantes).
- `LICENSE` (MIT), `README` (ce que c'est, captures, installation, compilation), `CONTRIBUTING`.
- Puis le dépôt passe en public.

**Fini quand** gitleaks ne trouve rien sur tout l'historique et que le dépôt est public, avec une release qui s'installe et se met à jour.

## Lot 6 — Vérification sur une installation vierge

- Installer depuis la release publique sur un profil Windows vierge (ou une VM) : rien de alice, premier lancement, configuration complète d'un serveur, d'un compte GitHub, d'une clé Forgy.
- Ta propre installation reprend ses données sans rien perdre.

**Fini quand** les deux parcours marchent : celui d'un inconnu, et le tien.

## Questions encore ouvertes

- Signature du code (un certificat évite l'alerte SmartScreen de Windows, mais il est payant) : à décider avant le lot 5.
- Langue par défaut : celle du système, l'anglais sinon. À confirmer.
