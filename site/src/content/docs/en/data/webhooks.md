---
title: Webhooks
description: Capture and inspect incoming webhooks on your PC, and replay them.
---

The **Webhooks** page runs a small local server that captures every request it receives, to see exactly what Stripe, GitHub or your own service sends.

## Start

Pick a port (9999 by default) and **Start**, top right (**Stop** afterwards). The server listens on `http://127.0.0.1:9999`: it is only reachable from this PC.

The card under the help shows the **local address** (to copy), the address calls are **replayed to** and the **answer** sent back. To receive webhooks from the internet, expose the server with a tunnel; DevForge gives you the command to copy:

```bash
cloudflared tunnel --url http://127.0.0.1:9999
```

## Inspect

A badge next to the title says whether the server is **Listening** or **Stopped**. Each call shows up live in **Received**: the method, its name (Stripe's event type, GitHub's event and repository, else the path) and the time. The top of the list counts today's calls; **Clear** empties it.

A click on a call opens it on the right, with who sent it and its size: **Body** (truncated at 1 MB), **Headers** and **The app's answer**. **curl** copies the call as a command.

## Respond

The status next to **answer** sets what the server sends back to callers (status, `Content-Type`, body), for example to simulate an error.

## Replay

**Replay** sends the same method, headers and body again to the replay address (your app, for instance). Without a path, the received path is reused. What your app answers shows in **The app's answer**.
