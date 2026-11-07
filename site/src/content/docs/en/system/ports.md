---
title: Ports
description: The ports listening on your PC, the process behind each one, and Free to stop the one in the way.
---

The **Ports** page lists the ports listening on this PC: the **port**, the **process** and its **PID**.

- **Dev** only shows ports above 1024 held by a dev tool (Node, Bun, Deno, Python, PHP, Java, Go, .NET, databases, nginx, Caddy, Docker…); **All** shows them all.
- **Free** stops the process holding the port, after confirmation: "Stop "node" (PID 12345) to free port 3000?".
- **Refresh** reads the list again.

DevForge refuses to stop a Windows system process.

## Elsewhere

- The **Ports** widget on Home shows the dev ports listening.
- The **Ports & domains** tab of each [project page](/devforge/en/dev/projects/) shows the project's ports, free or taken.
- Forgy can propose to free a port, to approve; it never touches a Windows service or DevForge.
