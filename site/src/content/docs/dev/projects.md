---
title: Projets
description: La liste de tes projets et la fiche de chaque projet, avec Git, GitHub, Docker, variables, paquets, base, logs, ports, déploiement, Vercel, terminal et ateliers par framework.
---

## La liste des projets

La page **Projets** montre :

- **Vos projets** : ceux que DevForge suit. Chaque carte affiche le framework, l'état Git (« modifs en cours ») et des boutons **Ouvrir** (dans l'IDE choisi), **VS Code**, **Terminal**, **Scripts** (les scripts du `package.json`), **Favori** et **Retirer**.
- **Détectés dans…** : les projets trouvés dans ton dossier de projets mais pas encore suivis. **Importer** les ajoute.

Filtre par framework (**Tous**, React, Symfony…) ou par nom ; **Rescanner** relit le dossier. Le dossier parcouru est le **dossier de projets par défaut** des [Paramètres](/devforge/settings/general/).

**Retirer** un projet l'enlève de DevForge ; le dossier n'est jamais supprimé.

## La fiche d'un projet

![La fiche d'un projet Next.js](../../../assets/screens/project-fr.png)

Clique sur un projet pour ouvrir sa fiche. En haut : le nom, le chemin (cliquer ouvre le dossier), et les boutons **Favori**, **Ouvrir dans l'IDE**, **Ouvrir un terminal**, **Retirer de DevForge** et **Demander à Forgy** (Forgy s'ouvre avec ce projet en contexte). Ouvrir une fiche rend le projet **actif**.

Les onglets n'apparaissent que s'ils ont un sens pour ce projet :

| Onglet | Contenu |
|---|---|
| Vue d'ensemble | une tuile par sujet (Git, Docker, variables, base, ports…) avec son résumé et **Voir** |
| Git | branche, fichiers modifiés, commits à pousser ou à récupérer, dernier commit, **Commit…**, **Pull**, **Push**, **Fetch** |
| GitHub | si le dépôt est sur GitHub : GitHub Actions (avec **Relancer les échecs**), pull requests ouvertes, versions publiées |
| Atelier Symfony / Next.js / Laravel | selon le framework, voir plus bas |
| Terminal | un terminal intégré ouvert dans le dossier du projet |
| Docker | le projet Compose du dossier (ou du dossier parent) : services, état, démarrer / arrêter |
| Variables | les fichiers `.env` et leurs clés, voir [Variables .env](/devforge/system/env-files/) |
| Paquets | si le projet a un `package.json` ou un `composer.json` : versions, vulnérabilités, mises à jour ; voir [Paquets](/devforge/dev/packages/) |
| Base de données | la base liée, explorée sur place (voir plus bas) ; **Lier une connexion…** |
| Logs | les fichiers de log trouvés (`storage/logs`, `var/log`, `logs`…), suivis en direct ; on peut en ajouter un par son chemin |
| Ports & domaines | les ports trouvés dans la config (`.env`, scripts, Compose), en écoute ou libres, **Libérer** ; les domaines locaux liés |
| Déploiement | les cibles de déploiement du projet et **Synchroniser le .env** avec le serveur |
| Vercel | si le dossier est lié à Vercel : déploiements, variables, domaines |
| Fichiers | l'arborescence du projet et la liste de ses scripts, avec **Lancer** |

Ce que DevForge a **trouvé** seul (une base, un domaine, un port) est marqué *trouvé* ; ce que tu as lié à la main, *ajouté*. **Retirer du projet** masque un élément ; **Réafficher** le remet.

### La base de données du projet

L'onglet **Base de données** affiche directement la base liée : les tables dans une colonne repliable, puis les mêmes onglets que la page [Base de données](/devforge/data/database/#explorer) (**Base** et **SQL**, et pour une table **Parcourir**, **Structure**, **Relations**, **Infos**). La connexion ne s'ouvre qu'à l'affichage de l'onglet.

- Plusieurs bases liées : la première est affichée, **Afficher** sur une autre ligne en change.
- **Ouvrir en grand** ouvre la page Base de données ; son bouton **← Retour à** *nom du projet* ramène sur cet onglet.

### Synchroniser le .env avec le serveur

Depuis l'onglet **Déploiement**, **Synchroniser le .env** compare le fichier sur ce PC et celui du serveur. Seul l'état de chaque clé s'affiche (*identique*, *différente*, *seulement ici*, *seulement sur le serveur*) : **les valeurs ne sont jamais montrées**.

- **Envoyer vers le serveur** : les clés d'ici remplacent celles du serveur. Une copie du fichier du serveur est gardée à côté (`.devforge-….bak`).
- **Récupérer ici** : l'inverse. Une copie chiffrée des `.env` du projet est faite avant (restaurable depuis [Variables .env](/devforge/system/env-files/)).

## Les ateliers par framework

Les projets **Symfony**, **Next.js** et **Laravel** ont un onglet *Atelier* qui fait le travail courant sans écrire de commande. Il est organisé en parties :

| Partie | Ce qu'elle fait |
|---|---|
| Base de données | la base utilisée (`DATABASE_URL` ou `DB_*`), son état, **Démarrer la base (Docker)**, **Créer la base**, ou utiliser une connexion de la page Base de données (écrite dans `.env.local`, qui ne se commite pas) |
| Entités / Modèles | un schéma visuel et un formulaire : un nom, des champs (texte court ou long, nombre entier ou à virgule, décimal, oui / non, date, date et heure, liste JSON), des liens (*appartient à*, *a plusieurs*, *est lié à plusieurs*, *a un seul*). DevForge écrit les fichiers ; rien ne touche la base avant la migration |
| Migrations | préparer une migration, voir son SQL, **Appliquer** ou **Revenir en arrière** ; alerte si elle supprime des données ; **Expliquer avec Forgy** |
| API | ce que chaque entité expose (lister, voir, créer, modifier, supprimer), avec **Tester** dans l'API Tester |
| Utilisateurs et connexion | Symfony : entité User et page de connexion ; Next.js : Auth.js avec GitHub, Google ou e-mail et mot de passe |
| Fausses données | générer des données réalistes (Faker) pour essayer l'appli ; efface les données actuelles |
| Routes | toutes les adresses de l'appli, filtrables, à ouvrir dans le navigateur ou l'API Tester |
| Serveur | démarrer le serveur local, ouvrir le site, vider le cache, installer les dépendances |

Spécificités :

- **Symfony** : API Platform (routes générées, documentation sur `/api/docs`) ou contrôleurs JSON écrits par DevForge ; pages CRUD avec MakerBundle ; serveur de Symfony CLI.
- **Next.js** : Prisma (`prisma/schema.prisma`), client partagé `lib/prisma.ts`, Prisma Studio ; Prisma n'ayant pas de retour arrière, DevForge prépare une migration inverse à relire ; clés OAuth enregistrées dans `.env.local` et jamais réaffichées.
- **Laravel** : modèles Eloquent et leurs migrations, SQL affiché par `migrate --pretend`, API Sanctum, `php artisan serve` sur le port 8000, ou Laravel Sail piloté par `docker compose`.

Un fichier que tu as modifié à la main n'est jamais réécrit par l'atelier.
