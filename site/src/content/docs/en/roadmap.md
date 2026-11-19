---
template: splash
title: Roadmap
description: What is ready, the steps to 1.0 and the ideas being considered for DevForge.
---

What is coming to DevForge, from the nearest to the furthest. No date is promised: a version ships when it is ready. What has already shipped is in [What's new](/devforge/en/news/).

An idea, a need? Suggest it in the [discussions](https://github.com/victhille/devforge/discussions) or as an [issue](https://github.com/victhille/devforge/issues/new/choose).

## Ready for the next version

Done and in review, before the first 1.0 beta:

- **Accessibility**: Windows high contrast is followed, input fields are easier to see, and screen readers are told the chosen language.
- **Licenses**: DevForge's license and those of its components ship in the installer, and can be read from **Settings › About**.
- **Privacy**: automatic updates can be turned off, the log hides more secrets, and Forgy no longer reads some sensitive files.
- **Light on resources**: the screens that poll the network (Docker, Vercel, VPS, GitHub…) stop while the window is minimized.
- **Publishing**: the installer is built without write access to the repository, and GitHub attests where it comes from.

## Towards 1.0

1. A **1.0.0-beta.1 pre-release**, on the **Beta** channel (**Settings › Updates**).
2. Tests on a fresh Windows: install, update from 0.2.1, uninstall.
3. If all goes well, **1.0.0**, once the beta has run for a week with no blocking bug, with an up-to-date video and screenshots.
4. Then an attempt to **sign the installer**, so that Windows SmartScreen no longer distrusts it.

## Under consideration

Nothing started yet, and the order may change:

- a full **Vercel** page: the projects, deployments and domains of the connected account;
- an **Expo** page: start a React Native project, show the QR code to scan with Expo Go, and follow the development server.
