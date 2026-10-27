---
title: Connections
description: Plug in GitHub, your Git identity, Forgy's key, Vercel, Docker, SSH servers and databases in Settings › Connections.
---

**Settings › Connections** gathers the services DevForge uses for you. Nothing is set up in advance: each one is plugged in here, **tested** and **removed**. A page that needs a missing service (GitHub, Vercel, a server, Forgy's key) says so and offers a button to plug it in.

:::note[Where secrets go]
Everything stays on this PC, in DevForge's folder. Keys, tokens and passwords are encrypted by Windows and are never shown again. Removing a service erases it; it will have to be set up again to be used.
:::

## Accounts and keys

### GitHub

Repositories, Actions and releases. Two ways to sign in:

- **GitHub CLI**: run `gh auth login` once in a terminal. DevForge uses that sign-in when it exists and shows `GitHub CLI: your-account`.
- **Personal token**: paste a GitHub token. Useful permissions: *Actions* and *Contents* read, *Actions* write to re-run failed jobs. It is checked, then encrypted.

Without either, the projects' GitHub tab and creating a GitHub repository from [New Project](/devforge/en/dev/new-project/) are not available.

### Git identity

The **name** and **e-mail** of your commits, written to `git config --global`. A name on one line (100 characters at most) and a valid e-mail.

### Forgy (Anthropic)

The **Anthropic API key** that makes [Forgy](/devforge/en/forgy/assistant/) talk. The **Test** button lists the available models: it costs nothing. Without a saved key, DevForge uses the `ANTHROPIC_API_KEY` environment variable if it exists.

### Vercel

Deployments, domains and variables of the projects linked to Vercel. Create a token on *vercel.com › Account Settings › Tokens* and paste it here. See [Deploy](/devforge/en/online/deploy/#vercel).

### Docker

This PC's Docker engine (Docker Desktop): containers, Compose, the projects' databases. Nothing to type: the row tells whether Docker answers. If it is not installed, **Install Docker Desktop** opens the download page.

## Servers (VPS)

SSH connections are used by the terminal, monitoring, n8n, the status page, backups and deployments. **Add a server** opens the form:

| Field | Example |
|---|---|
| Label | `my-server` |
| Host / IP | `203.0.113.10` or `vps.example.com` |
| Port | `22` |
| Username | `deploy` |
| Authentication | **Password** (stored encrypted) or **Private key** (path of the file, for example `C:\Users\you\.ssh\id_ed25519`) |
| Color | to spot the server in lists |

The **server key** is remembered on the first connection; if it changes, DevForge refuses to connect. **Forget key** resets it (after reinstalling the server, for example).

:::tip
Prefer an SSH key: the [Health](/devforge/en/servers/health/) page only offers to turn off SSH passwords if DevForge already connects with a key.
:::

Without a server, the pages that need one (Health, Services, Backups, n8n, VPN, Status page) simply stay aside: the menu hides them and says how many pages come with a server.

## Databases

The connections of the [Database](/devforge/en/data/database/) page: PostgreSQL, MySQL / MariaDB and SQLite, direct or through an SSH server. **Add a database** opens the same form as on that page.

## Test and remove

Each row has a **Test** button ("It answers: …" or "Failed: …" with the cause: token refused, Docker not answering, not found…) and a **Remove** button, which asks for confirmation.

## On another PC

**Settings › Data › Export** saves your setup to a file, **without any secret**. On the other PC, **Import…** takes it back; you then enter passwords, tokens and keys here again. See [Data](/devforge/en/settings/data/).
