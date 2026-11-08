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

At the top, three counts: the **watched** URLs, their **uptime** over the last checks and the **incidents of the last 30 days**, with how long they lasted in all. An incident starts when a URL stops answering and ends when it answers again.

DevForge checks each URL in the background and sends a **Windows notification** when one goes down or comes back. The table shows for each URL:

| Column | Content |
|---|---|
| Target | the name, and the expected text or the host |
| State | *online*, *down*, *paused* or *waiting*, and since when |
| Response | the response time of the last check, or its error |
| Last 24 h | one bar an hour: green when every check answered, amber when one failed, red when none answered |
| 30 days | the uptime over 30 days, from how long the incidents lasted |

At the end of the row: **Check now**, **Pause** / **Resume**, **Edit**, **Delete** and **Details**, which unfolds the availability per half hour and the response time of the last 24 hours.

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
