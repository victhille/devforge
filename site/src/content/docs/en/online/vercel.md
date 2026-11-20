---
title: Vercel
description: Every Vercel project of the account or of a team, their deployments and the domains, with canceling a build, promoting to production and linking to a local project.
---

The **Vercel** page (**Going live** menu) shows the whole Vercel account, without opening the browser. The **Vercel** tab of a project page only shows the project linked to its folder (see [Deploy](/devforge/en/online/deploy/#vercel)).

It needs a Vercel token, added in [Settings › Connections](/devforge/en/getting-started/connections/#vercel) or pasted on the page itself. At the top right, the **Vercel account or team** menu switches from the personal account to one of its teams, and **Refresh** reads everything again.

## Projects

One card per Vercel project:

- its production address, which opens on click;
- its latest deployment: the state (ready, building, error…), the branch, when, and the commit message;
- at the bottom, the DevForge project whose folder is linked to it (a click opens its page), or **Link to a local project**.

**Link to a local project** offers the DevForge projects not linked yet, the one with the same name first. DevForge then writes `.vercel/project.json` in the folder, as `vercel link` does, and adds `.vercel` to the `.gitignore` if there is one. A folder already linked to another Vercel project is left alone.

On the right, the **latest deployments, all projects**.

## Deployments

The last 40 deployments of the account or team, filtered by **All**, **Production**, **Previews** or **Failed**. For each one:

- **Build logs**;
- **Cancel the build** while it is queued or running (after a confirmation);
- **Promote to production** for a ready preview (after a confirmation);
- **Ask Forgy** when it failed: Forgy gets the end of the log, secrets masked, and looks for why;
- the ↗ icon opens the deployment.

A build in progress is followed every 5 seconds, while the window is visible.

## Domains

The domains of the account or team: verified or not, DNS to fix, bought through Vercel or managed elsewhere, and their expiry date.

## What leaves the PC

The page only talks to `api.vercel.com`, with your token. It reads no environment variable value. The secrets it recognizes (keys, tokens, passwords in a URL) are masked in the build logs.

**Ask Forgy** sends the end of the build log to your AI provider, only when you click (see [what Forgy sends](/devforge/en/privacy/#what-forgy-sends)).
