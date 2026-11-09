---
title: n8n
description: Install n8n on your VPS, keep it up to date, and follow your workflows and their executions from DevForge.
---

The **n8n** page installs and manages [n8n](https://n8n.io), the automation tool, on your server.

## Install

DevForge first checks the server: Docker and Docker Compose v2 are needed. Everything is written to `~/devforge/n8n` on the server: a Compose with n8n and PostgreSQL, and a `.env` made there. Nothing else is touched.

Pick the **access**:

| Access | How it works |
|---|---|
| HTTPS on a sub-domain | Caddy gets the certificate. The sub-domain (for example `n8n.example.com`) must already point to the server; DevForge checks the DNS. An e-mail for the certificate is needed too |
| Only on the server | n8n listens on `127.0.0.1:5678`; **Open n8n** goes through a tunnel in DevForge's SSH session |

No domain? DevForge offers a free `sslip.io` address that points to the server's IP. If ports 80 and 443 are already taken (another web server), pick "Only on the server" or free them.

An install already in `~/devforge/n8n` can be run again: its data is kept.

## Manage

- At the top, n8n's state and version (*online · 1.82*), **Restart n8n** and **Open n8n** (**Start** when it is stopped).
- The **⋯** menu: **Update**, **Logs**, **Stop** and **Forget this server**.
- **Update**: backs up n8n's database, then moves to the latest image.
- **Editor in French**: turns on the community French translation of n8n. The database is backed up then n8n restarts; texts added by a new n8n version stay in English until translated.
- **Forget this server**: removes n8n from DevForge without deleting anything on the server.

## Workflows and executions

With an **n8n API key** (in n8n: *Settings › API › Create a key*), encrypted by Windows, entered here or in [Settings › Connections](/devforge/en/getting-started/connections/#n8n-and-alerts) (it is forgotten if the server changes host, port or username, or is removed):

- four counts: **Active workflows**, **Runs · 24 h**, **Failures · 24 h** and **Public webhook** (or **Access** through an SSH tunnel);
- the table of workflows: their **trigger** (webhook, scheduled, by hand…), their **last run** (success, failed…), how many runs in 24 h and the **Active** switch. On hovering a row, **Export to a project** (a JSON file in one of your projects);
- below, when there are several, the **failures of the last 24 hours**.

Forgy can turn a workflow on or off and retry a failed execution (actions to approve). The command palette opens and restarts n8n.
