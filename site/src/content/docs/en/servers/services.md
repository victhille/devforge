---
title: Server web services
description: Open the web interfaces of your VPS's containers (Portainer, Adminer, phpMyAdmin…) through an SSH tunnel.
---

The **Services** page lists the **web interfaces of your server's containers**: Portainer, Adminer, phpMyAdmin, or any app that publishes an HTTP port.

## Opening a service

**Open** goes through a **tunnel in the SSH session**: the interface opens in your browser at a local address (`Tunnel: http://127.0.0.1:…`), even if the port is not open to the internet.

## Exposure

Each service tells how it is published:

- **Local to the server**: published on the server's `127.0.0.1`, reachable only through a tunnel. This is the safe setting.
- **Open to the internet**: published on every address, anyone can reach it. If that is not intended, publish it on `127.0.0.1` in your `compose.yaml` (for example `127.0.0.1:8080:80`).

A service whose container is stopped is marked *stopped*.

Services can also be opened from the command palette (<kbd>Ctrl</kbd> <kbd>K</kbd>, "Open …") and from the **VPS services** widget on Home.
