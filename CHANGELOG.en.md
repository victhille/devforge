# Release notes

Every DevForge version. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), [SemVer](https://semver.org/) versions.

## [Unreleased]

## [0.2.1](https://github.com/victhille/devforge/compare/v0.2.0...v0.2.1) — 2026-11-09

> Security fixes for running scripts, and an interface that follows the text size everywhere.

### Improvements

- **Text size**: the terminal (blocks and SSH), the file tree, the Packages tab and the project page's tests now follow the chosen text size and density
- **Keyboard**: the selectors in Settings, such as the text size, are walked with the arrow keys, with a single Tab stop
- **Servers and projects**: the Ctrl+K palette, a server's dashboard, the terminal and Forgy's widget follow at once a server or project that is added, renamed or removed
- **Screen readers**: a table that is loading says so, like the other skeletons

### Fixes

- **Database**: the full-screen schema no longer covers the bottom of the title bar

### Security

- **Scripts**: with pnpm or yarn, a script named like a package manager command (`publish`, `install`…) runs the script itself; a click can no longer publish a package by mistake
- **Scripts**: a script name with characters a shell reads, or an unknown package manager from an imported export, no longer reaches the terminal, Forgy or project creation
- **Network folders**: the scripts of a network share are only read for a saved project, so the Windows login is not sent to an unknown host

## [0.2.0](https://github.com/victhille/devforge/compare/v0.1.0...v0.2.0) — 2026-11-09

> The whole app moves to the "Forge" interface, with a colour of your choice, text that grows and pages that show at once.

### New features

- **Interface**: "Forge" redesign of every page, from the menu to Settings: new colours and fonts, cards, tables and counters, code colours in the file preview
- **Appearance**: six main colours (Forge orange, Blue, Violet, Pink, Teal, Green) that tint the whole interface, in the dark theme as in the light one, and a text size from Small to Larger
- **Home**: status chips, "Pick up again" to get back to your last projects, a Forgy card, and widgets all built the same way
- **Projects**: cards show the Git state (branch, changed files, commits to push), groups fold into chips, and a new project lands on its home page
- **Project page**: Files and Git in a single tab, with the branch, Fetch, Pull and Push above the tree; tabs that do not fit go into "More"
- **Notes**: several titled notes per project, stored in `.devforge/notes` (they follow Git), with checklists that Forgy can read, tick and add to
- **New project**: the wizard shows its steps on the left and "What will be created" on the right, with a summary
- **Database**: a "Search" tab finds text, words, an exact phrase or a regular expression in every table, with the matches highlighted
- **Servers and going online**: bars for the last 24 h, Deploy follows the steps of its script, one Docker tab per server, n8n counters for the day and a QR code for each VPN device
- **System and tools**: Environment groups tools by family, Ports points out forgotten dev servers, `.env` variables hides secrets and can regenerate them, Diff side by side or unified
- **Settings**: sections arranged in cards, Connections as compact rows (Test, Edit, Remove), Forgy's cost for the month, and a "Danger zone" to erase everything

### Improvements

- **Loading**: settings, SSH servers, project templates and IDEs stay in memory: a page you come back to shows at once, a change made elsewhere shows everywhere, and skeletons shaped like the content replace the loading spinners
- **Cleanup**: folder sizes are read about 20 times faster

### Fixes

- **Closing**: processes started by DevForge (dev servers, commands, tests, Docker logs) stop with the app instead of running on
- **Language**: sizes and durations follow the interface language (MB, Mo…)
- **Windows**: the DevForge icon is back in the taskbar

### Security

- **SSH**: a server that changes host, port or user forgets its password, its server key and the secrets kept for it (n8n, VPN)
- **`.env` variables**: a key or value that would add lines to the file is refused
- **Database**: the search refuses dangerous regular expressions and goes through prepared statements

## [0.1.0](https://github.com/victhille/devforge/releases/tag/v0.1.0) — 2026-11-07

> First preview release: your whole Windows dev workshop in one app, free, open source and with no account.

### New features

- **Projects**: guided creation (Laravel, Symfony, Next.js, Node…), open in your editor, built-in terminal, scripts and framework workshops
- **Git and GitHub**: status, branches, commits and pull requests
- **Docker**: containers, Compose, a Docker database per project, a server's Docker over SSH
- **Servers**: SSH connections, health, services, backups, VPN, n8n and status page
- **Databases**: connections, queries, backups, modeling (conceptual and physical models, diagrams) and API tester
- **Deployments**: Vercel and servers
- **Forgy** (Ctrl+J): AI assistant with your own key (Anthropic, OpenAI, Gemini, Mistral, Grok, OpenRouter, Groq, DeepSeek or a local model with Ollama), read-only tools, controlled cost
- **Settings**: everything in Settings › Connections; secrets encrypted by Windows, settings export and import without the secrets
- **Updates**: automatic, differential, Stable and Beta channels
- **Interface**: French and English, dark and light themes, compact mode
