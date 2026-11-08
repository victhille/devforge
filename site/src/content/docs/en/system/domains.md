---
title: Local domains
description: shop.test instead of localhost:3000, with a local proxy and the hosts file.
---

The **Local domains** page names your dev servers: `shop.test` instead of `localhost:3000`.

## Adding a domain

Type a **domain** ending in `.test` or `.localhost` (for example `shop.test`) and the local **port**, then **Add**. **Detected in your projects** suggests domain / port pairs taken from your projects.

The domains show in a table, with the number of active ones on top ("Active: 2 of 3"). For each: the switch that enables or disables it, the address, the target port, the **project** holding that port and its **state**: *answers* when a server listens on the port, *nothing on the port* otherwise, *disabled* when it is off.

## The proxy

DevForge runs a small local proxy that sends each domain to its port. It **starts automatically** as soon as a domain is enabled; the header says *Proxy running on port 80*.

If port 80 is already taken, the proxy uses port 8088 and addresses need it (`http://shop.test:8088`).

When the dev server does not answer, the proxy shows a page that says so ("Nothing answers on port 3000").

## The hosts file

- `.localhost` domains work **without touching the hosts file**: browsers already send them to `127.0.0.1`.
- `.test` domains must be in the Windows hosts file. When it is outdated, **Update (admin)** writes it, after Windows asks for permission.

The **Ports & domains** tab of a [project page](/devforge/en/dev/projects/) links a domain to the project's ports.
