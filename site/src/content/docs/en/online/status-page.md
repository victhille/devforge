---
title: Status page
description: A public page that shows whether your services work, watched 24/7 from your VPS, with incidents and alerts.
---

The **Status page** installs on your server a public page that shows whether your services work. Watching runs **on the server, 24/7, even with your PC off**.

## Install

A small service (Node, no dependency) checks your sites every minute, keeps **90 days** of history, opens incidents and alerts you. Docker and Docker Compose are needed on the server. Everything goes to `~/devforge/status`; nothing else is touched.

**Going online**: DevForge looks at what already runs and recommends a mode.

| Mode | When |
|---|---|
| Its own Caddy (HTTPS) | ports 80 and 443 are free: a certificate is taken on its own |
| With n8n's Caddy (HTTPS) | [n8n](/devforge/en/online/n8n/) installed by DevForge holds 80 and 443: the page joins its Caddy |
| Port 3901 (HTTP) | another tool holds 80 and 443: the page answers on `http://203.0.113.10:3901` |

If the server firewall (ufw) closes 80 and 443, DevForge offers **Open 80 and 443**.

**Address of the page**: an address ready without DNS setup (`sslip.io`), or **My sub-domain** (for example `status.example.com`, with **Check DNS**). The e-mail for the certificate is optional.

## What is watched

Add services:

| Type | Address |
|---|---|
| Site (HTTP) | `https://example.com` |
| Port (TCP) | `host:port`, for example `127.0.0.1:5432` |

Each service has a **public name**. What is ticked **Public** shows on the page; the rest is only seen in DevForge. Each service shows its availability over the last 90 days.

**Test an outage** adds a failing test service: the incident and the alert come at the next check. **Remove the test** closes it.

## Alerts

When a service goes down and comes back, the server warns you itself:

- **Notification on the phone (ntfy)**: install the [ntfy](https://ntfy.sh) app and subscribe to the topic. Keep it secret: whoever knows it gets the alerts.
- **Webhook**: a JSON POST on each outage and recovery, for instance to an n8n or Discord webhook.

**Send a test alert** checks the setup.

## The page

- **Title** of the page.
- **Check** every N seconds.
- **Failures before "down"**: several failures in a row avoid false alerts on a one-second drop.

Changed settings go to the server with **Save**.

## Incidents

Incidents are opened and closed on their own by the watch (*automatic*). You can also **write** one (maintenance, explanation): a title, an optional message, **Publish**; it shows on the public page. **Mark resolved** or **Delete this incident**.

## Uninstall

**Uninstall** stops the service and deletes `~/devforge/status` on the server, history included.
