---
title: Authentication
description: Sign-in, sign-up and one authentication API shared by Next.js, Laravel and Symfony, with React or Vue fronts that plug into it.
---

The **Users and login** option of [New Project](/devforge/en/dev/new-project/) gives a project where you can already sign up, sign in and call a protected API. The three servers (Next.js, Laravel, Symfony) expose **the same API**, so a React or Vue front made by DevForge works with any of them.

## The pages

| Page | Role |
|---|---|
| `/register` | creates the account, then signs in |
| `/login` | sign-in with email and password |
| `/dashboard` | for signed-in accounts only (otherwise back to `/login`); shows the account, the API and **Sign out** |

They wear DevForge's colors, like the welcome page; adapt them afterwards.

## The shared API

| Method | Route | Body | Response |
|---|---|---|---|
| POST | `/api/auth/register` | `{ name, email, password }` | `201 { user }` |
| POST | `/api/auth/login` | `{ email, password }` | `200 { user, token }` |
| POST | `/api/auth/logout` | — | `204` |
| GET | `/api/auth/me` | header `Authorization: Bearer <token>` | `200 { user }` or `401` |

- `user` is `{ id, name, email }`: never the password nor its hash.
- Input errors: `422 { errors: { field: [messages] } }`; refused identifiers: `401 { message }`.
- Password: at least 8 characters, hashed by the framework (bcrypt).

To try it by hand:

```bash
curl -X POST http://localhost:8000/api/auth/login -H "Content-Type: application/json" -H "Accept: application/json" -d "{\"email\":\"you@example.com\",\"password\":\"password\"}"
```

then `GET /api/auth/me` with `Authorization: Bearer <the token you got>`.

## What DevForge sets up

| | Next.js | Laravel | Symfony |
|---|---|---|---|
| Accounts | `User` model in Prisma, migrated at creation | `users` table, migrated | `User` entity (with a name), migrated |
| Pages | `app/login`, `app/register`, `app/dashboard` | Blade views wired into Fortify | Twig views, `form_login` with CSRF |
| API token | JWT signed with `AUTH_SECRET` (also a cookie for the pages) | Sanctum token, revoked on sign-out | token signed with `APP_SECRET` |
| Where to look | `lib/auth.ts`, `app/api/auth/*` | `Api/AuthController.php`, `routes/api.php` | `Controller/Api/AuthController.php`, `config/packages/security.yaml` |

With no database chosen, the option takes **SQLite**: accounts need somewhere to live.

## A React or Vue front

For a **React** or **Vue** project in TypeScript, the last step offers **Sign-in and sign-up** and the **server address** (Laravel and Symfony: `http://localhost:8000`; Next.js: `http://localhost:3000`).

- The pages are `#/login`, `#/register` and `#/dashboard`; the rest of the app stays as it is.
- In development, the front calls `/api` on its own address and Vite sends it to the server (`vite.config.ts`): **no CORS to set up**.
- For a production build, put the server's address in `VITE_API_URL` (see `.env.example`) and allow the front's origin on the server.
- The token is kept in the browser and sent as `Authorization: Bearer`; **Sign out** forgets it.

Start the server first, then the front (`npm run dev`), and open `#/register`.
