---
title: Forgy's actions
description: What Forgy can do for you, always after your approval, with the guardrails and the action journal.
---

Forgy can also **act**. Each action shows as a **card** in the panel: what will happen, then **Approve** or **Refuse**. **Nothing runs before your click.** The card also says whether the action can be undone.

## The actions

| Action | What it does | Can be undone | Auto possible |
|---|---|---|---|
| Commit | commits the changed files (or a list) | yes (`reset --soft`), as long as it is not pushed | yes |
| Pull | `pull --ff-only` | no | no |
| Push | push to the upstream, never forced | no | no |
| Compose | `up`, `stop` or `restart` of a Compose project | yes (`up` ↔ `stop`) | `up` / `stop` |
| Container | `start`, `stop` or `restart` of a container | yes (`start` ↔ `stop`) | no |
| SQL | one query: read (50 rows) or write | no | read only |
| Free a port | stops the process listening on a port | no | no |
| Script | runs a `package.json` script in the background | yes (stop) | yes |
| .env variable | adds a **new** key to a `.env` (value masked on the card) | yes (removal) | yes |
| n8n workflow | turns a workflow on or off | yes (the reverse) | yes |
| n8n execution | retries a failed execution | no | no |
| Redeploy (Vercel) | starts a build again, by default the production one | no | no |
| Promote (Vercel) | puts a deployment in production (preview, or rollback) | yes (previous production) | no |
| VPN client | creates a WireGuard client; the VPN page opens on its QR code | no | no |
| Backup | runs the server's nightly backup right now | no | no |
| GitHub Actions | re-runs the failed jobs of a run | no | no |
| Task | adds a task to a [project's notes](/devforge/en/dev/projects/#notes-and-tasks), checks or unchecks it | yes (removed, or previous state) | yes |
| Packages | updates npm, pnpm, yarn, Composer, Python (pip in the virtual environment, Poetry, uv, Pipenv), Cargo, Go, Bundler or pub [packages](/devforge/en/dev/packages/), within their range or to the latest version (a major is flagged on the card) | yes: manifest and lockfile put back, then reinstall | no |

## Always ask, or Auto

**Settings › Forgy › Forgy's actions**:

- **Always ask** (default): every action waits for your click.
- **Auto for safe actions**: only the actions of the "Auto possible" column (undoable or read-only) go without a click. Push, pull, SQL writes, ports and package updates always ask for your approval.

## Guardrails

| Area | Rule |
|---|---|
| SQL | a single query; `DROP`, `TRUNCATE`, `ALTER … DROP`, `GRANT` and file access refused; `DELETE` and `UPDATE` without `WHERE` refused |
| Git | never a force push; a first push (no upstream) is done from the Git page |
| `.env` | never changes an existing key |
| Ports | never a Windows service nor DevForge |
| Packages | only packages declared in the manifest; a missing tool (Composer, virtual environment, poetry, cargo…), .NET, Java or an ambiguous manifest: refused before any card |
| Refusal | Forgy is told and does not run the action again |
| Stop | stopping the answer refuses the pending actions |

An action proposed from the [desktop widget](/devforge/en/forgy/desktop/) opens DevForge on the card.

## The journal

The panel's ☑ button opens the **Action journal**: each proposed action (done, refused, failed, undone), with **Undo this action** when possible. The last 200 are kept. Each action done or failed also shows in the **Activity** widget on Home.
