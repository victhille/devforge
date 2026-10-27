---
title: Projects
description: The list of your projects and each project's page, with Git, GitHub, Docker, variables, database, logs, ports, deploy, Vercel, terminal and framework workshops.
---

## The project list

The **Projects** page shows:

- **Your Projects**: the ones DevForge tracks. Each card shows the framework, the Git state ("uncommitted") and buttons **Open** (in the chosen IDE), **VS Code**, **Terminal**, **Scripts** (the `package.json` scripts), **Favorite** and **Remove**.
- **Detected in…**: projects found in your projects folder but not tracked yet. **Import** adds them.

Filter by framework (**All**, React, Symfony…) or by name; **Rescan** reads the folder again. The folder scanned is the **default projects directory** from [Settings](/devforge/en/settings/general/).

**Remove** takes a project out of DevForge; the folder is never deleted.

## A project's page

![A Next.js project's page](../../../../assets/screens/project-en.png)

Click a project to open its page. At the top: the name, the path (click to open the folder), and the buttons **Favorite**, **Open in the IDE**, **Open a terminal**, **Remove from DevForge** and **Ask Forgy** (Forgy opens with this project in context). Opening a project's page makes it **active**.

Tabs only show when they make sense for the project:

| Tab | Content |
|---|---|
| Overview | one tile per topic (Git, Docker, variables, database, ports…) with its summary and **See** |
| Git | branch, changed files, commits to push or pull, last commit, **Commit…**, **Pull**, **Push**, **Fetch** |
| GitHub | if the repository is on GitHub: GitHub Actions (with **Re-run failed jobs**), open pull requests, releases |
| Symfony / Next.js / Laravel workshop | depending on the framework, see below |
| Terminal | a built-in terminal opened in the project folder |
| Docker | the Compose project of the folder (or its parent): services, state, start / stop |
| Variables | the `.env` files and their keys, see [Env variables](/devforge/en/system/env-files/) |
| Database | the connections linked to the project; **Link a connection…** |
| Logs | the log files found (`storage/logs`, `var/log`, `logs`…), followed live; you can add one by its path |
| Ports & domains | the ports found in the config (`.env`, scripts, Compose), listening or free, **Free**; the linked local domains |
| Deploy | the project's deploy targets and **Sync the .env** with the server |
| Vercel | if the folder is linked to Vercel: deployments, variables, domains |
| Files | the project tree and the list of its scripts, with **Run** |

What DevForge **found** by itself (a database, a domain, a port) is marked *found*; what you linked by hand, *added*. **Remove from the project** hides an item; **Show again** brings it back.

### Sync the .env with the server

From the **Deploy** tab, **Sync the .env** compares the file on this PC and the one on the server. Only the state of each key shows (*same*, *different*, *only here*, *only on the server*): **values are never displayed**.

- **Send to the server**: the keys from here replace the server's. A copy of the server's file is kept next to it (`.devforge-….bak`).
- **Bring here**: the other way round. An encrypted copy of the project's `.env` files is made first (restorable from [Env variables](/devforge/en/system/env-files/)).

## Framework workshops

**Symfony**, **Next.js** and **Laravel** projects have a *workshop* tab that does the everyday work without typing commands. It is split into parts:

| Part | What it does |
|---|---|
| Database | the database in use (`DATABASE_URL` or `DB_*`), its state, **Start the database (Docker)**, **Create the database**, or use a connection from the Database page (written to `.env.local`, which is not committed) |
| Entities / Models | a visual schema and a form: a name, fields (short or long text, integer or decimal number, price decimal, yes / no, date, date and time, JSON list), links (*belongs to*, *has many*, *is linked to many*, *has one*). DevForge writes the files; nothing touches the database before the migration |
| Migrations | prepare a migration, see its SQL, **Apply** or **Roll back**; warning if it deletes data; **Explain with Forgy** |
| API | what each entity exposes (list, show, create, update, delete), with **Test** in the API Tester |
| Users and sign-in | Symfony: User entity and login page; Next.js: Auth.js with GitHub, Google or e-mail and password |
| Fake data | generate realistic data (Faker) to try the app; erases the current data |
| Routes | every address of the app, filterable, to open in the browser or the API Tester |
| Server | start the local server, open the site, clear the cache, install dependencies |

Specifics:

- **Symfony**: API Platform (generated routes, documentation at `/api/docs`) or JSON controllers written by DevForge; CRUD pages with MakerBundle; Symfony CLI's server.
- **Next.js**: Prisma (`prisma/schema.prisma`), shared client `lib/prisma.ts`, Prisma Studio; since Prisma has no rollback, DevForge prepares a reverse migration to review; OAuth keys saved in `.env.local` and never shown again.
- **Laravel**: Eloquent models and their migrations, SQL shown by `migrate --pretend`, Sanctum API, `php artisan serve` on port 8000, or Laravel Sail driven through `docker compose`.

A file you edited by hand is never rewritten by the workshop.
