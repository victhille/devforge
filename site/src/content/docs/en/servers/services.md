---
title: Server web services
description: Open the web interfaces of your VPS's containers (Portainer, Adminer, phpMyAdmin…) through an SSH tunnel.
---

The **Services** page lists the **web interfaces of your server's containers**: Portainer, Adminer, phpMyAdmin, or any app that publishes an HTTP port. Each card shows the service, its port, what it is for (or its Docker image for an unknown service) and the state of its tunnel: **tunnel open**, **closed** or **stopped**. **Refresh** reads the containers again.

## Opening a service

**Open** goes through a **tunnel in the SSH session**: the interface opens in your browser at a local address, even if the port is not open to the internet. Once the tunnel is open, the card shows the local port (`:9000 → localhost:…`).

The **wg-easy** service (the VPN) also has **Manage in DevForge**, which opens the [VPN](/devforge/en/online/vpn/) page.

## Exposure

A service published on the server's `127.0.0.1` is reachable only through a tunnel: this is the safe setting, and the card shows nothing more.

A service published on every address carries the **Open to the internet** badge: anyone can reach it. If that is not intended, publish it on `127.0.0.1` in your `compose.yaml` (for example `127.0.0.1:8080:80`).

A service whose container is stopped is marked *stopped* and does not open.

Services can also be opened from the command palette (<kbd>Ctrl</kbd> <kbd>K</kbd>, "Open …") and from the **VPS services** widget on Home.
