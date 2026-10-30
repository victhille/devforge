---
title: Nouveau projet
description: Créer un projet React, Next.js, Vue, Node.js, Symfony, Laravel ou vide, avec base de données, options, Git et GitHub.
---

**Nouveau projet** crée un projet prêt à démarrer, pas à pas. Tout s'affiche en direct dans une console ; rien n'est publié sur GitHub sans ton accord.

Après le choix de la technologie, chaque écran a le même cadre : en haut, **les étapes** — celles faites en vert avec leur valeur (*1 · Framework : Symfony*, *2 · Nom : boutique*), un clic y revient ; celle en cours en surbrillance ; celles à venir en contour. En bas, toujours au même endroit : **Retour** à gauche, une aide au milieu, **Continuer** (ou **Créer le projet**) à droite.

## 1. La technologie

| Catégorie | Choix |
|---|---|
| Frontend | React, Vue |
| Full-Stack | Next.js |
| Backend | Node.js, Symfony, Laravel |
| Autre | Projet vide |

## 2. Le projet

Deux cartes côte à côte : **Nom et dossier**, puis **Outils**.

- **Nom du projet** : lettres, chiffres, tirets et underscores.
- **Destination** : par défaut ton premier dossier de projets ; avec plusieurs dossiers, chacun se choisit d'un clic sous le champ.
- **Gestionnaire de paquets** : npm, pnpm ou yarn (projets JavaScript).
- **Options** selon la technologie : TypeScript, ESLint, installer les dépendances.

## 3. Les librairies

Pour les projets JavaScript, choisis des paquets à installer d'emblée, rangés par catégorie : style, état, données, routing, formulaires, validation, UI, animation, utilitaires, i18n, tests, base de données, auth, API. **Passer** saute l'étape.

## 4. Base de données et options

Pour **Symfony**, **Next.js** et **Laravel**, tout peut être prêt dès la création, sur un seul écran : les moteurs en cartes, puis les options en cartes à cocher, un titre et une phrase chacune.

| Base | Détail |
|---|---|
| PostgreSQL 16 | dans Docker, recommandé |
| MySQL 8 | dans Docker |
| SQLite | un fichier, sans serveur |
| Aucune | ajoutable plus tard |

Pour une base Docker, choisis son nom et son port sur ce PC (le premier port libre est proposé). DevForge va écrire `compose.yaml` avec la base et un volume, remplir `DATABASE_URL`, installer Prisma (Next.js), démarrer la base et l'ajouter à la page [Base de données](/devforge/data/database/).

Options :

| Option | Symfony | Next.js | Laravel |
|---|---|---|---|
| API | route `/api/health`, mode choisi dans l'atelier | route `/api/health` | `routes/api.php` et Sanctum |
| Utilisateurs et connexion | pages et API du contrat, jeton signé | pages et API du contrat, Prisma | Fortify, pages et API du contrat, Sanctum |
| Docker pour l'app | FrankenPHP dans `compose.yaml` | Dockerfile Node et service `app` | Laravel Sail |
| Tests | PHPUnit et un premier test | Vitest et un premier test | PHPUnit, deux tests |
| CI GitHub Actions | vérifications et tests à chaque push | lint, tests et build | installation et tests |

**Utilisateurs et connexion** donne des pages de connexion, d'inscription et un tableau de bord, plus une API d'authentification commune aux trois : voir [Authentification](/devforge/dev/authentication/). Sans base choisie, l'option prend **SQLite** (pas de Docker).

Si PHP n'a pas les extensions nécessaires, DevForge les liste et propose **Activer dans php.ini** (une copie `php.ini.devforge-bak` est gardée).

## 5. Git, GitHub et récapitulatif

- **Dépôt Git et premier commit**.
- **Créer le dépôt sur GitHub**, **Privé** ou **Public**. Le nom proposé est `compte/nom`, le compte étant celui de ta connexion `gh` ; tu peux le changer. Il faut [GitHub CLI](https://cli.github.com) connecté (`gh auth login`).
- **Page d'accueil DevForge** (cochée par défaut) : remplace la page du framework par une page aux couleurs de DevForge qui montre ce qui est installé (adresse, base, branche) ; avec l'authentification, **Se connecter** et **Créer un compte** en haut à droite. Pour la remplacer, modifie le fichier qu'elle indique (`app/page.tsx`, `src/App.tsx`, `resources/views/welcome.blade.php`…).
- **Connexion et inscription** (React et Vue en TypeScript) : les pages et le client de l'[API d'authentification](/devforge/dev/authentication/), avec l'**adresse du serveur** à qui Vite renvoie `/api`.
- **Ouvrir dans VS Code à la fin**.
- **Ouvrir le projet à la fin et en faire le projet actif** : décoché, tu restes sur la page avec un bouton **Ouvrir le projet**.

Le **récapitulatif** montre, comme dans une console, exactement ce qui va être lancé (`$ composer create-project…`), avec la durée estimée.

### Pendant la création

**Créer le projet** reste sur la page : une carte montre où on en est (*Création en cours · 5 étapes sur 8*), le temps écoulé, une barre, et chaque étape faite, en cours ou à venir. La console démarre réduite ; **Voir le journal** l'ouvre avec chaque commande et **Annuler**. Elle se règle en hauteur (tire son bord supérieur, double-clic pour le plein écran) et regroupe les avertissements répétés.

La création continue si tu changes de page : un **anneau** à côté du bouton d'aide, en haut à droite, montre sa progression ; un clic ramène à la carte et au journal. En cas d'échec, la carte le dit et **Retour** revient aux étapes.

À chaque création, DevForge installe les dépendances qui manquent, écrit le `.gitignore` avant le premier commit (jamais de `node_modules` ni de `vendor` dans Git) et nomme la branche `main`.

## Mes modèles

Un projet que tu reprends souvent (ton API Node habituelle, ton Symfony avec ses bundles) peut devenir un **modèle**.

**Enregistrer** : sur la [fiche du projet](/devforge/dev/projects/), le bouton **Enregistrer comme modèle** (en haut à droite). Donne-lui un nom et une description, puis vérifie ce qui est **laissé de côté** : un nom de dossier ou de fichier par ligne, `*` accepté (`*.log`), ou un chemin (`var/cache`). Sont proposés : `node_modules`, `vendor`, `.git`, `dist`, `build`, les caches et les environnements virtuels. DevForge montre ce qui sera copié (nombre de fichiers, taille) avant d'enregistrer.

Jamais de secrets : un fichier `.env` ou `.env.*` n'est jamais copié, même s'il n'est pas dans la liste ; `.env.example` l'est.

**Créer depuis un modèle** : dans **Nouveau projet**, la catégorie **Mes modèles** vient en premier. Choisis un modèle, donne un nom au projet, puis l'étape **Git, GitHub et récapitulatif**. À la création :

- le modèle est copié tel quel ;
- le **nom du projet est remplacé** là où il nommait l'ancien : `package.json` (et `package-lock.json`), `composer.json`, `pyproject.toml`, `Cargo.toml` et le titre du `README` ;
- les dépendances s'installent (`npm install` ou celui de ton gestionnaire, `composer install`), sauf si tu as décoché **Installer les dépendances** ;
- un **nouvel historique Git** commence (le modèle n'emporte pas le `.git` d'origine), puis GitHub et l'éditeur si tu les as cochés.

**Paramètres › Modèles** liste tes modèles : **Mettre à jour** copie de nouveau le projet d'origine (avec la même liste de ce qui est laissé de côté), le crayon renomme, la corbeille supprime. Les projets déjà créés ne changent pas.

Les modèles sont rangés dans les données de DevForge (une archive par modèle, dans le dossier `templates`), sauvegardés avec elles avant une migration. Ils ne font pas partie de l'export du profil.
