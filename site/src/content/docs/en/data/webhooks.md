---
title: Webhooks
description: Capture and inspect incoming webhooks on your PC, and replay them.
---

The **Webhook tester** runs a small local server that captures every request it receives, to see exactly what Stripe, GitHub or your own service sends.

## Start

Pick a port (9999 by default) and **Start**. The server listens on `http://127.0.0.1:9999`: it is only reachable from this PC.

To receive webhooks from the internet, expose it with a tunnel. DevForge gives you the command to copy:

```bash
cloudflared tunnel --url http://127.0.0.1:9999
```

## Inspect

Each request shows up live: method, path, time, **Headers** and **Body** (truncated at 1 MB). **Clear** empties the list.

## Respond

**Response** sets what the server sends back to callers (status, `Content-Type`, body), for example to simulate an error.

## Replay

**Replay** sends the same method, headers and body again, to your app for instance. Without a path, the captured path is reused.
