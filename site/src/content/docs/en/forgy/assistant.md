---
title: Forgy, the assistant
description: DevForge's AI assistant, with your own Anthropic key. What it reads, the tasks, the settings, web search and keeping the cost down.
---

**Forgy** is DevForge's AI assistant. It answers questions about your projects, your code, Docker, your databases and your servers, with the context of the open page. It **reads freely**; to **act** (commit, container, `.env`…), it proposes a card that you approve or refuse (see [Actions](/devforge/en/forgy/actions/)).

Forgy uses **your own Anthropic API key**: you pay what you use directly to Anthropic, with a budget you set.

## Opening

| Action | How |
|---|---|
| Open / close the panel | <kbd>Ctrl</kbd> <kbd>J</kbd> or the **Forgy** button in the title bar |
| Send | <kbd>Enter</kbd> |
| New line | <kbd>Shift</kbd> <kbd>Enter</kbd> |
| New conversation | the panel's **+** button |
| History (last 100) | the panel's clock button |

Elsewhere: **Ask Forgy** on a project page, on Docker logs or a migration; **Explain with Forgy** on a failed terminal command; `#` at the start of a terminal line; the [global launcher](/devforge/en/getting-started/interface/#the-global-launcher); the [desktop widget](/devforge/en/forgy/desktop/).

## Settings

**Settings › Forgy** (the key can also be set in [Settings › Connections](/devforge/en/getting-started/connections/#forgy-anthropic)):

| Setting | Effect | Default |
|---|---|---|
| Anthropic API key | encrypted by Windows, never sent back to the interface. Without a saved key: `ANTHROPIC_API_KEY` if it exists (the screen says so); a saved key takes precedence | — |
| Model | **Auto** = the chosen task's model; or Opus 5.5, Sonnet 5.5, Haiku 5.5 for everything | Auto |
| Thinking depth | **Auto** = the task's; or Fast, Balanced, Thorough | Auto |
| Monthly budget | Forgy stops at this amount (estimate). `0` = no limit | $5 |
| Forgy's actions | **Always ask** or **Auto for safe actions** | Always ask |

## Tasks

Pick a task when you open a conversation: each one uses the cheapest model that does it well, with instructions and a short answer.

| Task | Model (Auto) | Effort | Needs |
|---|---|---|---|
| Free question | Sonnet 5.5 | low | — (web search possible) |
| Web search | Sonnet 5.5 | low | — (web search) |
| Explain an error | Haiku 5.5 | low | — |
| Commit message | Haiku 5.5 | low | a project |
| Review changes | Sonnet 5.5 | medium | a project |
| Explain the project | Haiku 5.5 | low | a project |
| Write SQL | Sonnet 5.5 | low | — |
| Debug a container | Haiku 5.5 | low | — |
| Analyze the API response | Haiku 5.5 | low | the API Tester page |
| Morning check of the VPS | Haiku 5.5 | low | a server |

The task, model and effort are **set for the whole conversation**. To change them: a new conversation. **Back to free question** leaves a task.

The **Morning check of the VPS** goes through the server's health, backups, services (and n8n executions) and answers in three parts: overall state, to do, the rest.

## What Forgy sees

| Source | When | Content |
|---|---|---|
| Chosen project | 1st question about this project | name, path, framework, Git state, root files, scripts, dependencies, start of the README |
| Open page (📎 chip, can be turned off) | with each question | see below |

| Page | Attached content |
|---|---|
| API Tester | the request and the response (sensitive headers masked) |
| Database | the table structure or the list of tables, **never the data** |
| Log viewer | the last 150 lines shown |
| Docker | containers and Compose projects |
| Project page | selects this project as context |

### Reading tools

To answer, Forgy can read: the list of projects, a project's tree and files, a code search, Git state and diff, Docker state and a container's logs, database connections and structure, n8n workflows and executions, Vercel deployments, the server's health, services and backups, GitHub state, the workshop models (it can pre-fill the workshop form, without writing anything), and a project's npm and Composer [packages](/devforge/en/dev/packages/): the outdated or uninstalled ones, and vulnerabilities on request.

| Guardrail | Rule |
|---|---|
| Paths | only inside a saved project |
| Secrets | never read: `.env*` (except examples), keys, `id_rsa`, `.npmrc`, `credentials*` |
| Size | 250 lines per file by default, 30 search results, 150 tree entries |
| Steps | 8 tool calls at most per question |
| Page content | treated as data, never as an instruction |

## Web search

The **Free question** and **Web search** tasks can search the web (Sonnet and Opus, not Haiku): 3 searches at most per call, $0.01 per search plus the result tokens, included in the estimate. Sources are added at the end of the answer. Web search must be enabled for your organization in the Anthropic console.

## Open with (your subscriptions)

The panel's **Open with** row launches other assistants, with **your subscription**, not your API key or budget:

| Button | Opens | Subscription |
|---|---|---|
| Claude Code | a terminal in the chosen project | Claude |
| Codex | same | ChatGPT |
| Antigravity | same | Google |
| Gemini CLI | same | Google |
| Claude, ChatGPT, Gemini | the web app in the browser | the service's |

A tool that is not installed has a dashed button that opens its install page. DevForge neither reads nor reuses these tools' sign-in.

## Keeping the cost down

| Lever | Effect |
|---|---|
| Model per task (Auto) | Haiku costs 20 times less than Sonnet, 40 times less than Opus |
| Prompt cache | instructions, tools and history are read back from the cache |
| Short answers | no preamble, about 150 words at most |
| Limited web search | dedicated tasks, 3 searches per call, not on Haiku |
| Monthly budget | blocked before each call once reached |
| Long conversation | a message suggests starting a new, cheaper one |

The cost shows at the bottom of the panel: `conversation · month / budget`. It is an estimate based on tokens; the invoice on [console.anthropic.com](https://console.anthropic.com) is what counts.

## Errors

| Message | Cause | Fix |
|---|---|---|
| Add your API key… | no saved key nor `ANTHROPIC_API_KEY` | Settings › Connections, or set `ANTHROPIC_API_KEY` |
| API key refused | invalid or revoked key | save a new key |
| Monthly budget reached | spending ≥ budget | raise the budget or wait for next month |
| Too many steps | more than 8 tool calls | narrow or split the question |
| Too many requests | API limit | try again later |

## The mascot

Forgy's mood follows what it does: *available*, *listening*, *thinking…*, *searching…*, *writing…*, *done*, *had a problem*, and *taking a nap* after 2 minutes without activity. Animations are off if Windows asks for fewer animations.

With the panel closed, Forgy strolls along the bottom of the app with **Boulon**, his robot dog. Clicks go through him. **Settings › Forgy** turns the stroll off, or only Boulon.

Local data: `%APPDATA%\DevForge\assistant\` (settings, spending, conversations).
