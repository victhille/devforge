---
title: Server health
description: Updates, disk space, memory, open ports, SSH security and containers of your VPS, with one-click fixes.
---

The **Health** page goes around your server: updates, space, ports, SSH and containers. It needs a server set up (see [Connections](/devforge/en/getting-started/connections/#servers-vps)).

At the top, a summary: **All good**, **To watch** or **To fix**, and the time of the check. **Refresh** reads again.

## The checks

| Check | What is looked at |
|---|---|
| Updates | pending packages, security ones included |
| Restart | does an update need a restart? |
| Disk | percentage used and free space |
| Files | inodes used (many small files) |
| Memory | available memory |
| Open ports | only SSH and the expected ports (web, WireGuard) should be open to the internet |
| Root login | can root log in with a password? |
| SSH passwords | key login only, or passwords accepted |
| fail2ban | does it block addresses that keep trying? |
| Login attempts | refused attempts over 24 h |
| Containers | stopped on an error, looping or restarting often |
| Docker space | space to reclaim (unused images, cache) |

Information that cannot be read on this server shows as *Unknown*.

## Fixes

Some checks offer a fix:

| Button | Effect |
|---|---|
| Install the updates | may take several minutes; services restarted by the packages are briefly down |
| Restart the server | server unreachable for a minute or two (VPN, n8n and sites down) |
| Clean up | frees Docker space |
| Install fail2ban | blocks repeated attempts |
| Keys only | refuses SSH password logins |

Each fix shows the exact command before running it, with **Run**, **Copy the command** or **Cancel**, then a **Log**.

:::caution
- **Keys only** is only offered if DevForge already connects with an SSH key: otherwise it would lock itself out.
- If `sudo` asks for a password on this server, DevForge runs nothing: copy the command and run it yourself in an SSH terminal.
:::

## Elsewhere

- The **VPS health** widget on Home and the Health card of the [dashboard](/devforge/en/servers/ssh/#the-server-dashboard) sum up this page.
- Forgy can read the server's health ("Morning check of the VPS"), see [Forgy](/devforge/en/forgy/assistant/#tasks).
