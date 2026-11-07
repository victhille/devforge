---
title: Monitoring
description: Get notified when a site or an API goes down, and watch your servers in the background.
---

The **Monitoring** page watches your sites and APIs, and the state of your servers.

## URLs

**Add URL**:

| Field | Effect |
|---|---|
| URL | the address to check |
| Name | optional, defaults to the host |
| Check every | 30 s, 1 min, 5 min, 15 min or 1 h |
| Expected text | optional: the page must contain it to count as up |

DevForge checks each URL in the background and sends a **Windows notification** when one goes down or comes back. Each URL shows its state and since when, its last 24 hours and its response time. **Check now**, **Pause** / **Resume**, **Edit**, **Delete**.

**Found in your projects** suggests URLs spotted in your projects.

:::note
Checks keep running while DevForge is open or minimized to the tray. For 24/7 watching, even with the PC off, install the [status page](/devforge/en/online/status-page/) on your server.
:::

## Servers

DevForge reads the state of each watched server **every minute** (in a dedicated SSH session) and keeps **7 days** of history: CPU, memory, disk, containers online, 24 h uptime.

**Watch this server** turns it on. Alerts are set in **Settings › Servers**:

- **Disk alert at** 75, 80, 85, 90 or 95 %;
- **Warn me when**: a disk fills up, a container stops, a server stops answering, a site goes down.

Alerts arrive as Windows notifications; Forgy also sulks in the desktop widget. **Settings › Data › Clear monitoring history** starts the charts over.
