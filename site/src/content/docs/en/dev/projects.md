---
title: Projects
description: The list of your projects and each project's page, with Git, GitHub, Docker, variables, packages, database, logs, ports, deploy, Vercel, terminal and framework workshops.
---

## The project list

The **Projects** page shows:

- **Your Projects**: the ones DevForge tracks. Each card shows the framework, the Git state ("uncommitted") and buttons **Open**, the name of the project's [IDE](/devforge/en/dev/ide/) (no button when the chosen IDE is "None"), **Terminal**, **Scripts** (the `package.json` scripts), **Favorite** and **Remove**.
- **Detected in…**: projects found in your projects folders but not tracked yet. **Import** adds them.

Filter by name, and by framework: only your projects' frameworks get a filter, and none shows when there is only one. **Rescan** reads the folders again. At the end of the filters row, **Add a folder** leads to the projects folders in [Settings](/devforge/en/settings/general/), for projects kept elsewhere.

**Remove** takes a project out of DevForge; the folder is never deleted.

## Several projects folders

Your projects may live in several folders ("Personal", "School"…). In [Settings › General](/devforge/en/settings/general/), **Projects folders** keeps their list:

- **Add a folder**, **Remove this folder** (nothing is deleted on disk), **Move up** / **Move down** to reorder them;
- the **first** one is the *default*: the built-in terminal opens there and new projects go there unless you pick another.

With several folders, the Projects page scans them all: each card bears its folder's name, discreetly, and a row of folder filters appears (**All folders**, then one per folder). A folder that no longer exists is reported ("Folder not found") instead of failing.

In [New project](/devforge/en/dev/new-project/), the destination offers your folders in one click.

## Nested projects (groups)

A folder that is not a project but holds several, for instance `FreelanceManager/` with `backend/` (Symfony) and `frontend/` (React), becomes a **group**:

- DevForge looks one level down, two at most, when the folder has no project file (`package.json`, `composer.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`…) but its sub-folders do. `node_modules`, `vendor`, build folders and hidden folders are skipped.
- The **group's card** reads "group · *n* projects" with its projects' stacks. Unfolded, it shows each project with its stack, Git state, IDE, terminal and scripts; **Fold the group** shrinks it to one line (remembered). At the bottom: the whole group in the IDE, its terminal, **Open its page**. Unfolded, it spans two columns and the next cards move up into the free room.
- What is not a project is part of the group too: under its projects, the card lists "Also in the folder:" `docs/`, `infra/`, `README.md`, `Dockerfile`… (folded: "+ *n* more"). Hidden and dependency folders are left out.
- The **Groups** filter keeps only them; a framework filter also keeps a group one of whose projects uses it.
- A project you already tracked that sits in a tracked group no longer shows twice: it is in its group.

A **group's page** starts with its projects side by side. Each has its IDE, its terminal and its tabs: **Scripts**, its **workshop** (Symfony, Next.js, Laravel), **Variables**, **Files**. **Run them all** starts each one's `dev` (or `start`) script. The rest of the page (Git, Docker, database, logs…) is about the group's folder.

Databases are looked for in the `.env` and `compose.yaml` of **each** project of the group: the back's database shows on the [Database](/devforge/en/data/database/) page as *group/back*, and on the group's page.

## A project's page

![A Next.js project's page](../../../../assets/screens/project-en.png)

Click a project to open its page. At the top: the name, the path (click to open the folder), and the buttons **Favorite**, **Open in the IDE**, **Open a terminal**, **Remove from DevForge** and **Ask Forgy** (Forgy opens with this project in context). Opening a project's page makes it **active**.

The overview's **Project** tile has an **IDE of this project** choice: *Default* follows Settings, or another IDE found on this PC that this project keeps (see [IDE](/devforge/en/dev/ide/)).

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
| Packages | when the project has a `package.json`, a `composer.json` or another language's dependencies (Python, Rust, Go…): versions, vulnerabilities, updates; see [Packages](/devforge/en/dev/packages/) |
| Tests | when the project has a test tool (Vitest, Jest, Playwright, PHPUnit, pytest, Go, Cargo): run them, see each test and its failures; see [Tests](/devforge/en/dev/tests/) |
| Database | the linked database, explored in place (see below); **Link a connection…** |
| Logs | the log files found (`storage/logs`, `var/log`, `logs`…), followed live; you can add one by its path |
| Ports & domains | the ports found in the config (`.env`, scripts, Compose), listening or free, **Free**; the linked local domains |
| Deploy | the project's deploy targets and **Sync the .env** with the server |
| Vercel | if the folder is linked to Vercel: deployments, variables, domains |
| Files | the project tree, with what Git saw change, a preview of the file clicked and the search (the scripts are on the overview) |

What DevForge **found** by itself (a database, a domain, a port) is marked *found*; what you linked by hand, *added*. **Remove from the project** hides an item; **Show again** brings it back.

### File previews

In the **Files** tab, clicking a file opens it next to the tree:

| File | Preview |
|---|---|
| Markdown (`.md`) | formatted: headings, lists, tables, code; **Show source** shows the raw text |
| Images (`.png`, `.jpg`, `.svg`, `.webp`…) | the image, on a checkerboard for transparency |
| PDF | the pages drawn (the first 20, then **Show the next pages**) |
| Text and code (`Dockerfile`, `.env`, `.ts`, `.vue`, `.py`, `.yaml`…) | in colours as in an IDE (the language told by the extension), with **Copy the content** |

**Open in** *your IDE* (next to **Copy**) opens the file in the project's [IDE](/devforge/en/dev/ide/). With VS Code, Cursor, Windsurf, Antigravity and Zed, it opens in that project's window (opened if needed), even when the IDE was on another project.

A binary file (archive, program, Office document) or one too big (over 1 MB of text, 10 MB of image, 30 MB of PDF) says so instead. Nothing runs: the file is only read.

### Changes since the last commit

In a Git repository, the **Files** tab's tree shows what changed since the last commit, as VS Code does:

| Mark | Meaning |
|---|---|
| **M**, orange | modified |
| **A**, green | new (added, or not tracked by Git yet) |
| **D**, red and struck through | deleted: the file stays in the tree to see what it held |
| an orange dot on a folder | it holds at least one change |

**Modified only · n**, at the top of the tree, reduces it to the changed files, every folder open; a click opens a file on its changes.

In a changed file's preview, **File** and **Changes** switch: **Changes** shows the diff since the last commit (staged changes included), with the old and new line numbers, additions in green, removals in red. A new file shows whole, as added; a deleted file opens straight on its changes.

For a project kept in a sub-folder of a repository (a group's project), only its own files count. Outside a Git repository, the tree stays as it is.

### Searching the project

At the top of the **Files** tab, **Search the project** looks for a text in every file of the project, 300 ms after the last key:

- three buttons in the field: **Match case**, **Whole word**, **Regular expression**;
- under the field, a file filter: `*.ts` (the name), `src/**` (the path), `!*.test.ts` (leave out), comma-separated;
- the results replace the tree, grouped by file, the text found highlighted; a click opens the file in the preview **at its line**, highlighted, and **Open in** *your IDE* opens it at that line (VS Code and its family, Zed, the JetBrains IDEs, Sublime Text, Notepad++);
- <kbd>Esc</kbd> clears the search and brings the tree back.

Left out: `node_modules`, `vendor`, builds (`dist`, `build`, `target`…), virtual environments, hidden folders (but `.github`, `.vscode`…), binary files and files over 1 MB. The search stops at 1,000 results.

### The project's database

The **Database** tab shows the linked database right there: the tables in a collapsible column, then the same tabs as the [Database](/devforge/en/data/database/#explore) page (**Database** and **SQL**, and for a table **Browse**, **Structure**, **Relations**, **Info**). The connection only opens when the tab shows.

- Several linked databases: the first one shows, **Show** on another row switches.
- **Open full size** opens the Database page; its **← Back to** *project name* button brings you back to this tab.

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
