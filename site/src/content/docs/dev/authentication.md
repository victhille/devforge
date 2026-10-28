---
title: Authentification
description: Connexion, inscription et une API d'authentification commune à Next.js, Laravel et Symfony, et des fronts React ou Vue qui s'y branchent.
---

L'option **Utilisateurs et connexion** de [Nouveau projet](/devforge/dev/new-project/) donne un projet où l'on peut déjà s'inscrire, se connecter et appeler une API protégée. Les trois serveurs (Next.js, Laravel, Symfony) exposent **la même API**, si bien qu'un front React ou Vue créé par DevForge marche avec n'importe lequel.

## Les pages

| Page | Rôle |
|---|---|
| `/register` | crée le compte, puis connecte |
| `/login` | connexion par e-mail et mot de passe |
| `/dashboard` | réservée aux comptes connectés (sinon, retour à `/login`) ; montre le compte, l'API et **Se déconnecter** |

Elles ont les couleurs de DevForge, comme la page d'accueil ; à toi de les adapter ensuite.

## L'API commune

| Méthode | Route | Corps | Réponse |
|---|---|---|---|
| POST | `/api/auth/register` | `{ name, email, password }` | `201 { user }` |
| POST | `/api/auth/login` | `{ email, password }` | `200 { user, token }` |
| POST | `/api/auth/logout` | — | `204` |
| GET | `/api/auth/me` | en-tête `Authorization: Bearer <jeton>` | `200 { user }` ou `401` |

- `user` vaut `{ id, name, email }` : jamais le mot de passe ni son empreinte.
- Erreurs de saisie : `422 { errors: { champ: [messages] } }` ; identifiants refusés : `401 { message }`.
- Mot de passe : 8 caractères au moins, haché par le framework (bcrypt).

Pour l'essayer à la main :

```bash
curl -X POST http://localhost:8000/api/auth/login -H "Content-Type: application/json" -H "Accept: application/json" -d "{\"email\":\"toi@exemple.fr\",\"password\":\"motdepasse\"}"
```

puis `GET /api/auth/me` avec `Authorization: Bearer <le jeton reçu>`.

## Ce que DevForge met en place

| | Next.js | Laravel | Symfony |
|---|---|---|---|
| Comptes | modèle `User` dans Prisma, migré à la création | table `users`, migrée | entité `User` (avec un nom), migrée |
| Pages | `app/login`, `app/register`, `app/dashboard` | vues Blade branchées dans Fortify | vues Twig, `form_login` avec CSRF |
| Jeton de l'API | JWT signé avec `AUTH_SECRET` (aussi en cookie pour les pages) | jeton Sanctum, révoqué à la déconnexion | jeton signé avec `APP_SECRET` |
| Où regarder | `lib/auth.ts`, `app/api/auth/*` | `Api/AuthController.php`, `routes/api.php` | `Controller/Api/AuthController.php`, `config/packages/security.yaml` |

Sans base de données choisie, l'option prend **SQLite** : les comptes ont besoin d'un endroit où vivre.

## Un front React ou Vue

Pour un projet **React** ou **Vue** en TypeScript, la dernière étape propose **Connexion et inscription** et l'**adresse du serveur** (Laravel et Symfony : `http://localhost:8000` ; Next.js : `http://localhost:3000`).

- Les pages sont `#/login`, `#/register` et `#/dashboard` ; le reste de l'app ne change pas.
- En développement, le front appelle `/api` sur sa propre adresse et Vite le renvoie au serveur (`vite.config.ts`) : **aucun CORS à régler**.
- Pour un build de production, mets l'adresse du serveur dans `VITE_API_URL` (voir `.env.example`) et autorise l'origine du front côté serveur.
- Le jeton est gardé dans le navigateur et envoyé en `Authorization: Bearer` ; **Se déconnecter** l'oublie.

Lance d'abord le serveur, puis le front (`npm run dev`), et ouvre `#/register`.
