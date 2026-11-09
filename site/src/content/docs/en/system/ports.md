---
title: Ports
description: The ports listening on your PC, the process behind each one, and Free to stop the one in the way.
---

The **Ports** page lists the ports listening on this PC: the **port**, the **process**, its **PID**, the **project** it comes from and the **address** it listens on.

- **Project**: the project whose folder shows in the process's command line (an `npm run dev` started in `online-shop`, for example), as a chip; a click opens its page. Otherwise, *no project*.
- **Address**: `127.0.0.1` or `::1`, the port can only be reached from this PC. `0.0.0.0`, `::` or a network card's address (`192.168.1.20`) gets the **network** badge: other devices on the network can reach it.
- **Port or process…** filters the list by port, process, PID or project.
- The open icon shows `http://localhost:port` in the browser (not for databases).
- **Dev** only shows ports above 1024 held by a dev tool (Node, Bun, Deno, Python, PHP, Java, Go, .NET, databases, nginx, Caddy, Docker…); **All** shows them all.
- **Free** stops the process holding the port, after confirmation: "Stop "node" (PID 12345) to free port 3000?". When a dev server (Node, PHP, Python…) holds a port without belonging to any project, its button is red and a note under the table says so: it is often a server left running from an earlier session.
- **Refresh** reads the list again.

DevForge refuses to stop a Windows system process.

## Elsewhere

- The **Ports** widget on Home shows the dev ports listening.
- The **Ports & domains** tab of each [project page](/devforge/en/dev/projects/) shows the project's ports, free or taken.
- Forgy can propose to free a port, to approve; it never touches a Windows service or DevForge.
