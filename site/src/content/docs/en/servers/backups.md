---
title: Server backups
description: Nightly backups made by the server itself, a copy on your PC and one-click restore.
---

The **Backups** page sets up **nightly backups made by the server itself**, even with the PC off, with a copy on this PC.

## Turn on

DevForge looks for what to back up:

- **Databases**: the containers' PostgreSQL and MariaDB databases. They are exported with their containers' credentials: **no password leaves the server**.
- **Volumes and folders**: Docker volumes and data folders, with the containers that use them. A database volume already covered by its export is flagged.

Then set:

| Setting | Effect |
|---|---|
| Time | the backup time, in server time |
| Days kept | number of daily backups kept |
| Weeks kept | number of weekly backups kept |
| Copy on this PC | a local folder where DevForge copies the newest backup while it runs (optional) |

**Turn on backups** installs the nightly task (cron) on the server.

## Follow up

- **Last backup**: done (date and size) or failed. After more than 36 h without a backup, DevForge warns you: check that the server runs and cron is active.
- If the nightly task has disappeared from the server, **Save** puts it back.
- **Back up now** runs a backup right away.
- **Copy to this PC** brings the newest backup home; **Open the folder** shows it.
- **Files on the server** lists the backups (*day* or *week*).
- **Log** shows the details of each operation.

## Restore

**Restore** brings a database or a volume back to its state of a given day. First, a copy of the current state is made in `pre-restore/`; the containers that use this data are stopped during the restore, then started again.

## Turn off

**Turn off** stops the nightly backups. The files already made stay on the server.

Backups can also be started from the palette (<kbd>Ctrl</kbd> <kbd>K</kbd>) and Forgy can propose one (an action to approve).
