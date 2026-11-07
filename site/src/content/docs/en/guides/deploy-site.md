---
title: Put a site online on your server
description: Step-by-step guide, from adding the server to the first one-click deployment, with the .env and watching the site.
---

Your site runs on your PC; you want it on your server, redeployed in one click after each change.

**You need**: a Linux server reachable over SSH, and the project on GitHub (or another Git host the server can clone from). About 15 minutes the first time.

## 1. Add your server

**Settings › Connections**, **Add a server**: the address (for example `203.0.113.10`), the user and an SSH key or a password. **Test** checks the connection before saving. See [Connections](/devforge/en/getting-started/connections/#servers-vps).

## 2. Prepare the folder on the server

The first time, clone the project on the server from the terminal of the [SSH](/devforge/en/servers/ssh/) page:

```bash
cd /var/www
git clone https://github.com/you/online-shop.git shop
```

## 3. Create the target

**Deploy** page, two ways:

- **Find on a server** finds, read-only, the server's Git checkouts and PM2 apps, and links them to your projects. **Create target** turns one into a ready target.
- **New target** to fill everything in: the server, the folder (`/var/www/shop`), the local project and the script.

The script runs in the folder, one command per line, and stops at the first error:

```bash
git pull --ff-only
npm ci
npm run build
pm2 restart shop
```

Tick **git push before deploying**: DevForge pushes your work before running the script.

## 4. Deploy

**Deploy** runs the script; its output shows live. A Windows notification says whether it worked. Each deployment stays in the target's history, with its log: handy when the build breaks.

## 5. Keep the .env up to date

The `.env` is not in Git. On the project's page, **Deploy** tab, **Sync the .env** compares the file on your PC and the one on the server, key by key, never showing the values. See [Projects](/devforge/en/dev/projects/#sync-the-env-with-the-server).

## 6. Know when the site goes down

**Monitoring** page, **Add URL** with the site's address: a notification comes when it stops answering, then when it is back. See [Monitoring](/devforge/en/servers/monitoring/#urls).

## Going further

- [Deploy](/devforge/en/online/deploy/): every option, and Vercel.
- [Server health](/devforge/en/servers/health/): disk, updates, security.
- [Backups](/devforge/en/servers/backups/): database and files, every night.
