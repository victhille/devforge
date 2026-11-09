---
title: Connections
description: Plug in GitHub, your Git identity, Forgy's key, Vercel, Docker, SSH servers and databases in Settings › Connections.
---

**Settings › Connections** gathers the services DevForge uses for you. Nothing is set up in advance: each one is plugged in here, **tested** and **removed**. A page that needs a missing service (GitHub, Vercel, a server, Forgy's key) says so and offers a button to plug it in.

Each service fits on one row: its state (a green tag when it is plugged in), then small actions, **Test**, **Edit**, **Remove**. What is typed (a key, a token, your name) opens under the row, only when you ask: **Add a key**, **Add a token** or **Edit**. The top of the **Accounts** card counts the services plugged in.

:::note[Where secrets go]
Everything stays on this PC, in DevForge's folder. Keys, tokens and passwords are encrypted by Windows and are never shown again. Removing a service erases it; it will have to be set up again to be used.
:::

## Accounts

### GitHub

Repositories, Actions and releases. Two ways to sign in:

- **GitHub CLI**: run `gh auth login` once in a terminal. DevForge uses that sign-in when it exists and shows `GitHub CLI: your-account`.
- **Personal token**: without GitHub CLI, **Add a token**, then paste a GitHub token. Useful permissions: *Actions* and *Contents* read, *Actions* write to re-run failed jobs. It is checked, then encrypted.

Without either, the projects' GitHub tab and creating a GitHub repository from [New Project](/devforge/en/dev/new-project/) are not available.

### Git identity

The **name** and **e-mail** of your commits, written to `git config --global`; the row shows them, **Edit** opens the two fields. A name on one line (100 characters at most) and a valid e-mail.

### Forgy (Anthropic)

The **API key** that makes [Forgy](/devforge/en/forgy/assistant/) talk: Anthropic's by default, or the one of the [provider chosen](/devforge/en/forgy/assistant/#providers) in Settings › Forgy (the row bears its name). The row says whether a key is saved; it is typed, tested (the test lists the models: it costs nothing), replaced and removed in [Settings › Forgy](/devforge/en/forgy/assistant/#settings), where **Forgy's settings** leads. Without a saved key, DevForge uses the `ANTHROPIC_API_KEY` environment variable if it exists, and the row says so: "key read from ANTHROPIC_API_KEY". A saved key takes precedence over the variable.

### Vercel

Deployments, domains and variables of the projects linked to Vercel. Create a token on *vercel.com › Account Settings › Tokens*, then **Add a token** and paste it; the row then shows "token saved" (the account on hover). See [Deploy](/devforge/en/online/deploy/#vercel).

### Docker

This PC's Docker engine (Docker Desktop): containers, Compose, the projects' databases. Nothing to type: the row says "answers" (the version on hover). While it does not answer, **Test** checks again and **Install Docker Desktop** opens the download page.

## Servers (VPS)

SSH connections are used by the terminal, monitoring, n8n, the status page, backups and deployments. **Add a server**, at the top of the card, opens the form:

| Field | Example |
|---|---|
| Label | `my-server` |
| Host / IP | `203.0.113.10` or `vps.example.com` |
| Port | `22` |
| Username | `deploy` |
| Authentication | **Password** (stored encrypted) or **Private key** (path of the file, for example `C:\Users\you\.ssh\id_ed25519`) |
| Color | to spot the server in lists |

Each server shows `user@host:port` and its method (SSH key or password); **Edit** opens the form again with its values, the bin removes it.

The **server key** is remembered on the first connection; if it changes, DevForge refuses to connect. **Forget key** resets it (after reinstalling the server, for example).

:::tip
Prefer an SSH key: the [Health](/devforge/en/servers/health/) page only offers to turn off SSH passwords if DevForge already connects with a key.
:::

Without a server, the pages that need one (Health, Services, Backups, n8n, VPN, Status page) simply stay aside: the menu hides them and says how many pages come with a server.

## Databases

The connections of the [Database](/devforge/en/data/database/) page: PostgreSQL, MySQL / MariaDB and SQLite, direct or through an SSH server. **Add a database**, at the top of the card, opens the same form as on that page. Each database shows its kind and where it is; **Open** shows it on the Database page, the bin removes it.

## n8n and alerts

Both services run on your servers: DevForge keeps n8n's key and reads the status page's settings over SSH.

- **n8n · my-server**: one row per n8n installed from the [n8n](/devforge/en/online/n8n/) page, for its **n8n API key** (the row says whether it is saved; **Add a key**, then in n8n: *Settings › API › Create a key*). **Test** counts the workflows, **Open** goes to the n8n page. Without n8n, the row points to that page to install it.
- **Status page · my-server**: one row per installed [status page](/devforge/en/online/status-page/). **Read the alerts** checks on the server whether ntfy alerts are on, and whether there is a webhook too. Without an ntfy alert, a form sets the **ntfy server** (`https://ntfy.sh` by default) and the **topic**: keep it secret, whoever knows it gets the alerts. **Test** sends a real test alert; **Remove** turns the ntfy alert off without touching the rest of the status page.

## Test and remove

Accounts, servers, n8n and status pages have a **Test** button: the result shows as a tag, "It answers: …" in green or "Failed: …" in red with the cause (token refused, Docker not answering, not found…). A server not tested yet says so. **Remove**, in red (the bin for a server or a database), asks for confirmation.

## On another PC

**Settings › Data › Export** saves your setup to a file, **without any secret**. On the other PC, **Import…** takes it back; you then enter passwords, tokens and keys here again. See [Data](/devforge/en/settings/data/).
