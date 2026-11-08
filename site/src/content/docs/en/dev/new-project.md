---
title: New Project
description: Create a React, Next.js, Vue, Node.js, Symfony, Laravel or empty project, with database, options, Git and GitHub.
---

**New Project** creates a ready-to-run project, step by step. Everything shows live in a console; nothing goes to GitHub without your consent.

Every screen has the same frame: on the left, **the steps** (Technology, Options, Database, Libraries, Git and GitHub, Creation), those done ticked in green, a click goes back to one, the current one in orange. On the right, a card says what will be created or sums up your choices, with **Back** and the next action (**Continue**, then **Create Project**). In a narrow window, this card moves under the steps.

## 1. Technology

| Category | Choices |
|---|---|
| Frontend | React, Vue |
| Full-Stack | Next.js |
| Backend | Node.js, Symfony, Laravel |
| Other | Empty Project |

A click picks the technology: the **What will be created** card shows the starting file tree and the tool used (`create-next-app`, `symfony/skeleton`…). **Continue** moves on (a double click on the tile too). If you have [templates](#my-templates), **Technologies** and **My templates** are picked at the top right.

## 2. Options and database

One screen, with the **summary** on the right (project, database, port, files written) following your choices.

- **Project name**: letters, numbers, hyphens and underscores.
- **Destination**: your first projects folder by default; with several folders, each is one click away under the field.
- **Package manager**: npm, pnpm or yarn (JavaScript projects).
- Depending on the technology, switches: TypeScript, ESLint, install dependencies.

For **Symfony**, **Next.js** and **Laravel**, everything can be ready at creation, on the same screen: the database as tiles, then the options, a title and a sentence each.

| Database | Detail |
|---|---|
| None | can be added later |
| SQLite | a file, no server |
| PostgreSQL 16 | in Docker, recommended |
| MySQL 8 | in Docker |

For a Docker database, pick its name and its port on this PC (the first free port is suggested). DevForge will write `compose.yaml` with the database and a volume, fill `DATABASE_URL`, install Prisma (Next.js), start the database and add it to the [Database](/devforge/en/data/database/) page.

Options:

| Option | Symfony | Next.js | Laravel |
|---|---|---|---|
| API | `/api/health` route, mode picked in the workshop | `/api/health` route | `routes/api.php` and Sanctum |
| Users and login | contract pages and API, signed token | contract pages and API, Prisma | Fortify, contract pages and API, Sanctum |
| Docker for the app | FrankenPHP in `compose.yaml` | Node Dockerfile and `app` service | Laravel Sail |
| Tests | PHPUnit and a first test | Vitest and a first test | PHPUnit, two tests |
| GitHub Actions CI | checks and tests on every push | lint, tests and build | install and tests |

**Users and login** gives sign-in, sign-up and dashboard pages, plus one authentication API shared by the three: see [Authentication](/devforge/en/dev/authentication/). With no database chosen, the option takes **SQLite** (no Docker).

If PHP lacks the needed extensions, DevForge lists them and offers **Enable in php.ini** (a `php.ini.devforge-bak` copy is kept).

## 3. Libraries (optional)

For JavaScript projects, pick packages to install right away, sorted by category: styling, state, data fetching, routing, forms, validation, UI, animation, utils, i18n, testing, database, auth, API. The card on the right lists the ones chosen. **Skip** passes the step: you can add some later from the project's **Packages** tab.

## 4. Git, GitHub and creation

- **Git repository and first commit**: branch `main`, first commit "chore: initial commit (DevForge)".
- **Create the repository on GitHub**, **Private** or **Public**. The name offered is `account/name`, the account being your `gh` sign-in; you can change it. [GitHub CLI](https://cli.github.com) must be signed in (`gh auth login`).
- **DevForge welcome page** (checked by default): replaces the framework's page with one in DevForge's colors showing what is set up (address, database, branch); with authentication, **Sign in** and **Create an account** at the top right. To replace it, edit the file it names (`app/page.tsx`, `src/App.tsx`, `resources/views/welcome.blade.php`…).
- **Sign-in and sign-up** (React and Vue in TypeScript): the pages and the client of the [authentication API](/devforge/en/dev/authentication/), with the **server address** Vite sends `/api` to.
- **Open in VS Code at the end**.
- **Open the project at the end and make it the active one**: unchecked, you stay on the page with an **Open the project** button.

The card on the right sums up the project (name, starter, database, libraries) with the estimated time. Below, **Summary · what will run** shows, like a console, exactly what will run (`$ composer create-project…`).

### While it is created

**Create Project** stays on the page: a card tells how far it is (*Creating · 5 of 8 steps*), the time elapsed and a bar, then the steps one under the other, each done (with how long it took), running, failed or to come. The console starts minimized; **Show the log** opens it with each command and **Cancel**. It resizes (drag its top edge, double-click for full screen) and groups repeated warnings.

The creation goes on if you change pages: a **ring** next to the help button, top right, shows its progress; a click brings back the card and the log. On a failure, the card says so and **Back** returns to the steps.

On every creation, DevForge installs missing dependencies, writes `.gitignore` before the first commit (never `node_modules` or `vendor` in Git) and names the branch `main`.

## My templates

A project you often start from (your usual Node API, your Symfony with its bundles) can become a **template**.

**Save**: on the [project's page](/devforge/en/dev/projects/), the **⋯** menu (Other actions, top right) › **Save as template**. Give it a name and a description, then check what is **left out**: one folder or file name per line, `*` allowed (`*.log`), or a path (`var/cache`). Proposed: `node_modules`, `vendor`, `.git`, `dist`, `build`, caches and virtual environments. DevForge shows what will be copied (number of files, size) before saving.

Never secrets: a `.env` or `.env.*` file is never copied, even if it is not in the list; `.env.example` is.

**Create from a template**: in **New Project**, pick **My templates** at the top right, then a template and **Continue**. Name the project, then the **Git, GitHub and creation** step (no database or libraries: the template already has its own). On creation:

- the template is copied as it is;
- the **project's name is replaced** where it named the old one: `package.json` (and `package-lock.json`), `composer.json`, `pyproject.toml`, `Cargo.toml` and the `README`'s title;
- dependencies are installed (`npm install` or your manager's, `composer install`), unless you unchecked **Install dependencies**;
- a **new Git history** starts (the template does not carry the original `.git`), then GitHub and the editor if you checked them.

**Settings › Templates** lists your templates: **Update** copies the original project again (with the same list of what is left out), the pencil renames, the bin deletes. Projects already created do not change.

Templates are kept in DevForge's data (one archive per template, in the `templates` folder), backed up with it before a migration. They are not part of the profile export.
