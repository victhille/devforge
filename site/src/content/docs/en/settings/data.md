---
title: Data, export and reset
description: Where DevForge keeps your data, its automatic backups, the log, exporting and importing your setup, and Erase everything.
---

**Settings › Data**. Everything stays on this computer.

## Data folder

The folder's path (`%APPDATA%\DevForge`), its size and the data format version. **Open folder** shows it in Explorer.

Keys, tokens and passwords in it are encrypted by Windows (DPAPI): copied to another PC or another Windows account, they cannot be read.

## Backups

DevForge backs up its data **before each data format change** (during an update) and keeps **the last 5**. **Back up now** makes one by hand.

**Restore** puts back the data of a given date. The current data is backed up first, then DevForge restarts.

## Local log

Errors and events, secrets masked, handy for a bug report. **Open log** shows it. The diagnostic report (in **About**) includes its last lines.

## Export or import my setup

- **Export** writes your projects, servers, databases, settings… to a file, to take them to another PC. **No secret is in it**: passwords, tokens and keys are to be entered again in [Connections](/devforge/en/getting-started/connections/).
- **Import…** replaces your current setup with the file's. A backup is made first, then DevForge restarts.

## Clear monitoring history

Clears the 7 days of [server monitoring](/devforge/en/servers/monitoring/#servers) history: charts start over, settings stay.

## Erase everything

**Erase everything** resets DevForge: connections, keys, projects, history, log, backups and settings. DevForge restarts on the [welcome screen](/devforge/en/getting-started/first-launch/).

- Your **project folders are not touched**.
- There is **no way back**: type the word `erase` to confirm.

To keep a copy of your setup first, use **Export**.
