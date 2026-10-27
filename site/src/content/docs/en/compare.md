---
template: splash
title: Without or with DevForge
description: What DevForge brings into one window, what it does not replace, and its limits, so you can decide knowingly.
---

What DevForge brings together, what it does not replace, and its limits. So you can decide knowingly.

## What it brings together

| Task | Without DevForge | With DevForge |
|---|---|---|
| Start a project and its services | one terminal per project, commands from memory | [Stack launcher](/devforge/en/dev/stacks/) |
| See the Git state of all your projects | a `git status` in each folder | [Git](/devforge/en/dev/git/) |
| Update dependencies | `npm outdated`, `npm audit`, `composer outdated`… folder by folder | [Packages](/devforge/en/dev/packages/) |
| Read and query a database | an SQL client | [Database](/devforge/en/data/database/) |
| Test an API | an HTTP client | [API Tester](/devforge/en/data/api-tester/) |
| Receive a webhook locally | an online service that catches them | [Webhooks](/devforge/en/data/webhooks/) |
| Manage containers and Compose projects | Docker's interface, or the command line | [Docker](/devforge/en/dev/docker/) |
| Go to the server | an SSH client, a notepad of commands | [SSH and dashboard](/devforge/en/servers/ssh/) |
| Know whether the server is fine | log in and run `df`, `apt`, `systemctl`… | [Server health](/devforge/en/servers/health/) |
| Deploy | log in, `git pull`, build, restart | [Deploy](/devforge/en/online/deploy/) |
| Find what holds port 3000 | `netstat`, then Task Manager | [Ports](/devforge/en/system/ports/) |
| Find a key in the `.env` files | open the files one by one | [Env variables](/devforge/en/system/env-files/) |
| Free some space | hunt for forgotten `node_modules` | [Disk cleaner](/devforge/en/system/cleaner/) |

And [Forgy](/devforge/en/forgy/assistant/) on top: an assistant that knows the open project, reads the code, the logs and the database structure, and suggests actions you approve.

## What it does not replace

- **Your code editor.** DevForge opens the project in your IDE (VS Code, PhpStorm or WebStorm); it does not edit code itself.
- **Git, Node, Docker, PHP…** DevForge uses the ones installed on your PC. The [Environment](/devforge/en/system/environment/) page tells what is missing.
- **Your host.** DevForge deploys to your server or to Vercel; it hosts nothing.
- **A real terminal, when you need one.** There is one on each project page and on each server.

## Its limits

- **Windows 10 and 11 only**, for now.
- **Databases**: PostgreSQL, MySQL / MariaDB and SQLite.
- **Servers**: Linux, over SSH.
- **Forgy** needs an Anthropic API key, paid per use; a monthly budget stops it once reached. The rest of DevForge works without it.

## To try it

DevForge is free and open source. [Download it](/devforge/en/download/), then follow the [getting started](/devforge/en/getting-started/installation/) pages or a [guide](/devforge/en/guides/forgy-commit/).
