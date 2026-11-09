---
title: Data, export and reset
description: Where DevForge keeps your data, its automatic backups, the log, exporting and importing your setup, and Erase everything.
---

**Settings › Data**. Everything stays on this computer. The page holds four cards: **Storage** (folder, log, monitoring history), **Backups**, **Export or import my setup** and **Danger zone**.

## Data folder

The folder's path (`%APPDATA%\DevForge`), its size and the data format version. **Open folder** shows it in Explorer.

Keys, tokens and passwords in it are encrypted by Windows (DPAPI): copied to another PC or another Windows account, they cannot be read.

## Backups

DevForge backs up its data **before each data format change** (during an update) and keeps **the last 5**. **Back up now**, at the top of the card, makes one by hand.

Each backup shows its date, its reason (*manual*, *before format v12*, *before a restore*) and its size. **Restore** puts back the data of that date. The current data is backed up first, then DevForge restarts.

## Local log

Errors and events, secrets masked, handy for a bug report. **Open log** shows it. **Copy report** copies the [diagnostic report](/devforge/en/settings/general/#about), which includes its last lines.

## Export or import my setup

On the **To another PC** row:

- **Export** writes your projects, servers, databases, settings… to a file, to take them to another PC. **No secret is in it**: passwords, tokens and keys are to be entered again in [Connections](/devforge/en/getting-started/connections/).
- **Import…** replaces your current setup with the file's. A backup is made first, then DevForge restarts.

## Clear monitoring history

**Clear…** clears, once confirmed, the 7 days of [server monitoring](/devforge/en/servers/monitoring/#servers) history: charts start over, settings stay.

## Erase everything

In the **Danger zone** card, **Erase everything…** resets DevForge: connections, keys, projects, history, log, backups and settings. DevForge restarts on the [welcome screen](/devforge/en/getting-started/first-launch/).

- Your **project folders are not touched**.
- There is **no way back**: the button opens a field where you type the word `erase`, then **Erase everything** confirms (**Cancel** closes the field).

To keep a copy of your setup first, use **Export**.
