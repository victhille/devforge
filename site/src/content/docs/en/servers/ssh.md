---
title: SSH and dashboard
description: SSH connections, the tabbed terminal and a server's dashboard.
---

The **SSH / VPS** page gathers your servers: a tabbed SSH terminal and, for each server, a dashboard.

## Connections

The left column lists the saved servers (the same list as [Settings › Connections](/devforge/en/getting-started/connections/#servers-vps)). **+** (or **Add server**) opens the form: label, host or IP, port, username, password or private key, color.

On each server:

| Button | Effect |
|---|---|
| click on the name | opens an SSH terminal in a new tab |
| Dashboard | opens the server's dashboard |
| Databases on this server | opens the [Database](/devforge/en/data/database/#find-databases) page and looks for this server's databases |
| Edit Connection | changes its settings; leaving the password empty keeps it |
| Delete | removes the server |

**Hide servers** folds the column to give all the room to the terminal.

:::note[Server key]
DevForge remembers the fingerprint of the server's key on the first connection, like OpenSSH. If it changes, the connection is refused. After reinstalling the server, **Forget key** in the form resets it.
:::

## The terminal

Each open connection is a tab; you can open several and close them one by one. The state shows (*Connecting...*, *Disconnected*).

## The server dashboard

Once connected, the dashboard updates continuously:

- **CPU** (with the load and a chart), **Memory** (used, total, available), **Swap** if any, **Uptime** and kernel version;
- the server's **Health** card (see [Health](/devforge/en/servers/health/));
- **Disks**: how full each partition is;
- **Processes (top CPU)**;
- **Docker**: the server's containers.

## Server pages

Once a server is added, these pages show in the menu. Each has a **Server** picker when you have several:

- [Health](/devforge/en/servers/health/): updates, disk, ports, SSH, containers;
- [Services](/devforge/en/servers/services/): the containers' web interfaces;
- [Backups](/devforge/en/servers/backups/): nightly backups and restore;
- [n8n](/devforge/en/online/n8n/), [VPN](/devforge/en/online/vpn/), [Status page](/devforge/en/online/status-page/).

Background watching (disk, container, unreachable server alerts) is set in [Monitoring](/devforge/en/servers/monitoring/#servers).
