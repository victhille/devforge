---
title: Deploy
description: Ship to your servers over SSH in one click, and follow your Vercel projects.
---

## To a server, over SSH

The **Deploy** page ships to your servers in one click. A **target** = a server, a folder and a script.

:::note
You need an SSH server first (see [Connections](/devforge/en/getting-started/connections/#servers-vps)).
:::

### Creating a target

**New target**:

| Field | Effect |
|---|---|
| Name | the target's name |
| Server (SSH) | a saved connection |
| Folder on the server | the script runs from this folder, in a login shell (nvm, pm2… available) |
| Script | one command per line; stops at the first error |
| Local project | optional: links the target to a DevForge project |
| git push before deploying | pushes the local project before running the script |

Example script:

```bash
git pull --ff-only
npm ci
npm run build
pm2 restart my-app
```

### Find on a server

**Find on a server** scans, read-only, `/var/www`, `/srv`, `/opt` and the home folder: Git checkouts and PM2 apps. They are linked to your local projects through their Git remote. **Create target** turns one into a target.

### Deploying

**Deploy** runs the script; its output shows live. Each deployment is kept in the target's history, with its log. A notification says whether it succeeded or failed.

A project's deployment is also in the **Deploy** tab of its [page](/devforge/en/dev/projects/), with the [.env sync](/devforge/en/dev/projects/#sync-the-env-with-the-server).

## Vercel

With a Vercel token ([Connections](/devforge/en/getting-started/connections/#vercel)), a project whose folder is linked to Vercel (`vercel link`) has a **Vercel** tab on its page:

- production and preview **Deployments**, their state (ready, building, error, queued…) and which one is *in production*;
- **Redeploy** starts a new build from a deployment;
- **Promote to production** points production to a deployment; **Roll back to this one** to go back;
- **Build logs**;
- **Variables**: compares the **names** of the keys of the local `.env` and of Vercel (*in the file, not on Vercel* and the other way round), without reading any value;
- **Domains**: verified or not, DNS to fix, certificate, redirects;
- **Open site**, **Open on Vercel**.

Forgy can propose to redeploy or promote to production (actions to approve).
