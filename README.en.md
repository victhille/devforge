# DevForge

English · [Français](README.md)

**Website and documentation: [victhille.github.io/devforge/en](https://victhille.github.io/devforge/en/)**

A Windows desktop app (Electron + React) that brings everyday dev tools together in one place: projects, Git, Docker / Compose, SSH and servers, databases, deployments, monitoring, `.env`, local domains, a toolbox, and Forgy, an AI assistant.

DevForge ships with nothing personal: on first launch you pick your language and projects folder, then connect your own accounts (GitHub, servers, Vercel, databases, Anthropic key). Everything stays on your PC, with secrets encrypted by Windows.

## What it does

- **Projects**: guided creation (Laravel, Symfony, Next.js, Node…), open in your editor, built-in terminal, scripts, per-framework workshops.
- **Git and GitHub**: status, branches, commits, pull requests.
- **Docker**: containers, Compose, a Docker database per project, a server's Docker over SSH.
- **Servers**: SSH connections, health, services, backups, VPN, n8n, status page.
- **Databases**: connections, queries, backups.
- **Deployments**: Vercel and servers.
- **Forgy** (Ctrl+J): an assistant using your own Anthropic key, read-only tools, controlled cost. See [docs/guide/forgy.md](docs/guide/forgy.md).

## Install

Download the `DevForge-Setup-vx.y.z.exe` installer from the [Download page](https://victhille.github.io/devforge/en/download/) or the [releases](https://github.com/victhille/devforge/releases). DevForge then updates itself. [Getting started](https://victhille.github.io/devforge/en/getting-started/installation/) covers the install and every page of the app.

The installer is not signed: Windows SmartScreen may say "Windows protected your PC". Click "More info", then "Run anyway".

## Set up

Everything is in **Settings › Connections**: GitHub (GitHub CLI or token), Git identity, Forgy key, Vercel, Docker, SSH servers, databases. Each service is tested and removed from the same place. **Settings › Data** exports your setup (without secrets), imports it on another PC, or erases everything.

## Develop

You need Node.js 22 and Windows.

```bash
npm install
npm run dev        # app with hot reload
npm run check      # types + lint + tests + build (same as CI)
npm test           # tests only (Vitest); npm run test:watch to keep running
npm run test:e2e   # end-to-end tests (Playwright, on the built app)
npm run dist       # Windows installer in dist/
```

For a fork: change `repository` and `build.publish` in `package.json`; updates and the "About" links follow.

SemVer versions, conventional commits, `npm run release` to publish: see [docs/dev/versions.md](docs/dev/versions.md). To contribute: [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE).
