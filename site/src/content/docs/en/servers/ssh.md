---
title: SSH and dashboard
description: SSH connections, the tabbed terminal and a server's dashboard.
---

The **SSH / VPS** page gathers your servers: a tabbed SSH terminal and, for each server, a dashboard.

## Connections

The left column lists the saved servers (the same list as [Settings › Connections](/devforge/en/getting-started/connections/#servers-vps)). **+** (or **Add server**) opens the form: label, host or IP, port, username, password or private key, color.

Each server shows its name, `user@host` and a dot: green when its terminal is open, amber while it connects, grey without a session. On hover (or with the keyboard), its buttons:

| Button | Effect |
|---|---|
| click on the name | opens an SSH terminal |
| Dashboard | opens the server's dashboard (also at the top of the open session's terminal) |
| Databases on this server | opens the [Database](/devforge/en/data/database/#find-databases) page and looks for this server's databases |
| Edit Connection | changes its settings; leaving the password empty keeps it, unless the host, the port or the username changes: it must then be typed again, like n8n's key, the VPN login and the passwords of the databases reached through this server |
| Delete the connection | removes the server |

**Hide servers** folds the column to give all the room to the terminal. At the bottom of the column, a reminder: keys stay in `~\.ssh` and passwords are encrypted by Windows.

:::note[Server key]
DevForge remembers the fingerprint of the server's key on the first connection, like OpenSSH. If it changes, the connection is refused. After reinstalling the server, **Forget key** in the form resets it, once confirmed in the Windows dialog that opens.
:::

## The terminal

With no open session, the page asks you to pick a connection on the left. Once connected, the header shows the server, its state (*connected*, *Connecting...*, *Disconnected*), `user@host:port` and two buttons:

- **Files (SFTP)** browses the server's folders (from your home folder, or a path you type) and **downloads** a file wherever you pick on this PC. You see what the SSH user can read, as in the terminal; nothing is changed on the server.
- **Dashboard** opens the server's dashboard.

The terminal sits in a dark card. Tabs show as soon as you open a second server; each closes with its cross. With a single session, **Close the session** is in the header.

## The server dashboard

Once connected, the dashboard updates continuously. At the top, the server's name with **online** and how long it has been up, its address and system, then the buttons:

- **Terminal** opens the SSH page with this server's session;
- **Update (n)**, when updates are waiting, opens this server's [Health](/devforge/en/servers/health/) page.

Below:

- four cards: **CPU** (with the load and the latest readings as bars), **Memory** (used out of total, and swap), **Disk** (the `/` partition and its free space), **Uptime** and kernel version;
- **Containers**: name, image and how long they have been running, with how many are online;
- the server's **Health** alert, with what needs your attention and a link to the [Health](/devforge/en/servers/health/) page;
- **Shortcuts** to this server's Services, Backups, Deploy and VPN;
- **Disks**: how full each partition is;
- **Processes (top CPU)**.

## Server pages

Once a server is added, these pages show in the menu. When you have several, each has a **Server** picker in its header:

- [Health](/devforge/en/servers/health/): updates, disk, ports, SSH, containers;
- [Services](/devforge/en/servers/services/): the containers' web interfaces;
- [Backups](/devforge/en/servers/backups/): nightly backups and restore;
- [n8n](/devforge/en/online/n8n/), [VPN](/devforge/en/online/vpn/), [Status page](/devforge/en/online/status-page/).

Background watching (disk, container, unreachable server alerts) is set in [Monitoring](/devforge/en/servers/monitoring/#servers).
