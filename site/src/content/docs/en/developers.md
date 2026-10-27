---
title: Developers
description: Build DevForge, understand its architecture, ship a release and contribute.
---

DevForge is open source, under the [MIT license](https://github.com/victhille/devforge/blob/main/LICENSE). It is built with Electron, React 18, TypeScript and Tailwind CSS.

## Build

You need Node.js 22 and Windows.

```bash
git clone https://github.com/victhille/devforge.git
cd devforge
npm install
npm run dev        # the app with hot reload
npm run check      # types, lint, tests and build (like the CI)
npm run test:e2e   # end-to-end tests (Playwright, on the built app)
npm run dist       # Windows installer in dist/
```

For a fork, change `repository` and `build.publish` in `package.json`: automatic updates and the "About" links follow.

## Going further

The developer documents are in French:

| Document | Content |
|---|---|
| [Architecture](https://github.com/victhille/devforge/blob/main/docs/dev/architecture.md) | code layout, IPC, data, secrets, tests |
| [Versions](https://github.com/victhille/devforge/blob/main/docs/dev/versions.md) | version numbers, commit messages, shipping a release, automatic updates |
| [Contributing](https://github.com/victhille/devforge/blob/main/CONTRIBUTING.md) | reporting a problem, proposing a change, conventions |
| [Changelog](https://github.com/victhille/devforge/blob/main/CHANGELOG.en.md) | what changed in each version (in English) |

Issues and pull requests are welcome in English or French.

## Report a problem

Open an [issue](https://github.com/victhille/devforge/issues) with what you were doing, what happened, what you expected, and the diagnostic report (**Settings › About › Copy report**). A security flaw is reported privately: **Report a vulnerability** in the repository's *Security* tab.

## This site

This site lives in the repository's [`site/`](https://github.com/victhille/devforge/tree/main/site) folder, built with [Astro Starlight](https://starlight.astro.build) and published by GitHub Pages. The "Edit page" link at the bottom of each page opens its source on GitHub.
