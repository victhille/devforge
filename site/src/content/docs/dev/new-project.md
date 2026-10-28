---
title: Nouveau projet
description: Créer un projet React, Next.js, Vue, Node.js, Symfony, Laravel ou vide, avec base de données, options, Git et GitHub.
---

**Nouveau projet** crée un projet prêt à démarrer, pas à pas. Tout s'affiche en direct dans une console ; rien n'est publié sur GitHub sans ton accord.

## 1. La technologie

| Catégorie | Choix |
|---|---|
| Frontend | React, Vue |
| Full-Stack | Next.js |
| Backend | Node.js, Symfony, Laravel |
| Autre | Projet vide |

## 2. Le projet

- **Nom du projet** : lettres, chiffres, tirets et underscores.
- **Destination** : par défaut ton premier dossier de projets ; avec plusieurs dossiers, chacun se choisit d'un clic sous le champ.
- **Gestionnaire de paquets** : npm, pnpm ou yarn (projets JavaScript).
- **Options** selon la technologie : TypeScript, ESLint, installer les dépendances.

## 3. Les librairies

Pour les projets JavaScript, choisis des paquets à installer d'emblée, rangés par catégorie : style, état, données, routing, formulaires, validation, UI, animation, utilitaires, i18n, tests, base de données, auth, API. **Passer** saute l'étape.

## 4. Base de données et options

Pour **Symfony**, **Next.js** et **Laravel**, tout peut être prêt dès la création :

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
- **Créer le dépôt sur GitHub**, privé ou public, avec le nom de ton choix (`nom` ou `compte/nom`). Il faut [GitHub CLI](https://cli.github.com) connecté (`gh auth login`).
- **Page d'accueil DevForge** (cochée par défaut) : remplace la page du framework par une page aux couleurs de DevForge qui montre ce qui est installé (adresse, base, branche) ; avec l'authentification, **Se connecter** et **Créer un compte** en haut à droite. Pour la remplacer, modifie le fichier qu'elle indique (`app/page.tsx`, `src/App.tsx`, `resources/views/welcome.blade.php`…).
- **Connexion et inscription** (React et Vue en TypeScript) : les pages et le client de l'[API d'authentification](/devforge/dev/authentication/), avec l'**adresse du serveur** à qui Vite renvoie `/api`.
- **Ouvrir dans VS Code à la fin**.

Le **récapitulatif** liste exactement ce qui va être lancé. **Créer le projet** démarre ; la console montre chaque commande, avec **Annuler**. La console se règle en hauteur (tire son bord supérieur, double-clic pour le plein écran), montre l'étape en cours et regroupe les avertissements répétés. À la fin, la fiche du projet s'ouvre ; **Ouvrir le dossier** et **Ouvrir dans VS Code** restent dans la console.

À chaque création, DevForge installe les dépendances qui manquent, écrit le `.gitignore` avant le premier commit (jamais de `node_modules` ni de `vendor` dans Git) et nomme la branche `main`.
