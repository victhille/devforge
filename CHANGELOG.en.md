# Release notes

Every DevForge version. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), [SemVer](https://semver.org/) versions.

## [Unreleased]

## [0.6.0](https://github.com/victhille/devforge/compare/v0.5.0...v0.6.0) — 2026-11-20

> Sign in to GitHub without a token, and an Expo that starts and opens on the phone.

### New features

- **Connections**: in **Settings › Connections**, **Sign in** plugs in GitHub with no token to copy. DevForge shows a code, **Open GitHub** opens the page where you type it, and the row turns green once you allow it. Pasting a token is still possible

### Fixes

- **Expo**: when Windows reserves Metro's port (WSL and Hyper-V often do for 8081), DevForge takes the next free one and says so in the log, instead of staying stuck on "Starting…"
- **Expo**: the QR code no longer carries Metro's "›" stuck to the address. Scanned with Expo Go, it opens the app instead of showing "Failed to download remote update"
- **Connections**: a cancelled sign-in frees the local port at once, and the next try no longer says "Another sign-in is under way"

## [0.5.0](https://github.com/victhille/devforge/compare/v0.4.0...v0.5.0) — 2026-11-20

> Official MCP servers plug into Forgy in one click, and updates install silently.

### New features

- **MCP servers for Forgy**: in **Settings › Connections**, the official servers of Vercel, Supabase, Sentry, Linear, Notion, Context7 and Playwright plug in with one click. Those that need an account open the browser on the service's page: no token to copy. Their tools become Forgy's
- **MCP servers for Forgy**: **Add an MCP server** plugs in a server that is not in the list, by its address or by the command that starts it on this PC. A switch says whether Forgy may use it

### Improvements

- **Updates**: from the update that follows 0.5.0, installing is silent, with no PowerShell and no installer page, and a small DevForge window follows it until the app reopens. Going from 0.4.0 to 0.5.0 still shows the old page
- **Expo**: the QR code gives the phone the PC's Wi-Fi address, instead of one it cannot reach; the app opens in Expo Go
- **Tests**: three tests that failed at random on the CI are made reliable

### Security

- **MCP servers**: Forgy asks for your approval with a card before any tool that changes something, and before every tool of a server added by hand. What a server returns is given to it as data, never as instructions
- **MCP servers**: the connections are encrypted by Windows; an address with a password or a key is refused, and a command is shown before it is added

## [0.4.0](https://github.com/victhille/devforge/compare/v0.3.0...v0.4.0) — 2026-11-20

> Vercel and Expo each get their own page, and projects whose folder is gone leave the list on their own.

### New features

- **Vercel**: a **Going live › Vercel** page for the whole account or a team: projects, deployments and domains. It cancels a build, promotes a preview to production and links a Vercel project to a DevForge folder
- **Expo**: a **Development › Expo** page to run a React Native app, monorepos included, with Expo Go or a dev build, over Wi-Fi, a tunnel or this PC. The QR code shows in the page, Metro's commands (reload, dev menu, Android, browser…) are buttons, and the packages align on the SDK
- **Forgy**: it explains a failed Vercel deployment or a Metro error from the end of the log

### Improvements

- **Projects**: a project whose folder is gone leaves the list on its own, at startup and on each **Rescan**, with **Undo**. An unplugged disk or a network drive keeps its projects
- **Forgy**: the project choice becomes a list with a search, icons, the favorites then the recent projects, usable from the keyboard
- **Accessibility**: a loading button tells screen readers

### Security

- **Vercel**: the recognized secrets are masked in build logs, on screen and for Forgy
- **Expo**: the Metro server stops with DevForge, instead of staying in the background

## [0.3.0](https://github.com/victhille/devforge/compare/v0.2.1...v0.3.0) — 2026-11-20

> Updates are now visible: a download card, a restart screen, and an app that is more accessible and more private.

### New features

- **Updates**: a card at the bottom right follows the download (bar, MB received, time left); it shrinks into a pill in the title bar, and offers **Restart and update** or **Later** once the version is ready
- **Updates**: on restart, a cover says the install is starting, the installer is titled "Updating DevForge", and a small "Update installed" window shows while DevForge opens again
- **Privacy**: automatic updates can be turned off, and **Settings** explains what leaves the PC
- **Licenses**: the DevForge license and those of its components ship with the installer and can be read from **Settings › About**

### Improvements

- **Accessibility**: Windows high contrast is followed, input fields are easier to read, the chosen language is announced to screen readers, and small buttons are at least 24 px
- **Lighter on resources**: screens that poll the network (Docker, Vercel, VPS, GitHub…) pause while the window is minimized
- **Installer**: it is lighter, and uninstalling cleans up

### Security

- **Forgy**: in auto-safe mode, only development servers start on their own; other scripts ask for a click
- **Forgy**: it no longer reads some sensitive files
- **Log**: it masks more secrets and user folders
- **Webhooks**: replaying a captured request always sends it to the chosen address, even when the incoming call gave a full address
- **Database**: an opened database can no longer run a regular expression outside the search
- **Publishing**: the installer is built without write access to the repository, and GitHub attests its provenance

### Dependencies and build

- **Electron** 44.11.5 and minor updates of the other components

## [0.2.1](https://github.com/victhille/devforge/compare/v0.2.0...v0.2.1) — 2026-11-10

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
