---
title: Forgy, the assistant
description: DevForge's AI assistant, with your own key (Anthropic, OpenAI, Gemini, Mistral…) or a local model. What it reads, the tasks, the settings, web search and keeping the cost down.
---

**Forgy** is DevForge's AI assistant. It answers questions about your projects, your code, Docker, your databases and your servers, with the context of the open page. It **reads freely**; to **act** (commit, container, `.env`…), it proposes a card that you approve or refuse (see [Actions](/devforge/en/forgy/actions/)).

Forgy uses **your own API key**: Anthropic (Claude) by default, or [another provider](#providers) (OpenAI, Gemini, Mistral, xAI's Grok, OpenRouter, Groq, DeepSeek, a local model with Ollama). You pay what you use directly to the provider, with a budget you set.

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

**Settings › Forgy** (the key can also be set in [Settings › Connections](/devforge/en/getting-started/connections/#forgy-anthropic)). At the top, a card sums up who answers, with which model, whether Forgy asks before acting, and what it cost this month against the budget. The settings follow in four cards, **Provider**, **Answers**, **Forgy's actions** and **Presence** (walk, dictation, desktop widget):

| Setting | Effect | Default |
|---|---|---|
| Provider | who answers: see [Providers](#providers) | Anthropic |
| API key | the chosen provider's, encrypted by Windows, never sent back to the interface. Without a saved key: its environment variable (`ANTHROPIC_API_KEY`…) if it exists (the screen says so); a saved key takes precedence. **Test** lists the models (free), **Replace** types another one, **Remove** erases it | — |
| Model | Claude: **Auto** = the chosen task's model, or Opus 5.5, Sonnet 5.5, Haiku 5.5 for everything. Another provider: its model's name | Auto |
| Thinking depth | **Auto** = the task's; or Fast, Balanced, Thorough | Auto |
| Monthly budget | Forgy stops at this amount (estimate). `0` = no limit | $5 |
| Forgy's actions | **Always ask** or **Auto for safe actions** | Always ask |

## Providers

Anthropic (Claude) is the default provider. The others go through OpenAI's chat API, their own or a compatible one:

| Provider | Key | Read with no saved key |
|---|---|---|
| Anthropic (Claude) | yes | `ANTHROPIC_API_KEY` |
| OpenAI | yes | `OPENAI_API_KEY` |
| Google Gemini | yes | `GEMINI_API_KEY` or `GOOGLE_API_KEY` |
| Mistral AI | yes | `MISTRAL_API_KEY` |
| xAI (Grok) | yes | `XAI_API_KEY` |
| OpenRouter | yes | `OPENROUTER_API_KEY` |
| Groq | yes | `GROQ_API_KEY` |
| DeepSeek | yes | `DEEPSEEK_API_KEY` |
| Ollama (local) | no: it runs on your PC, at `http://localhost:11434/v1` (can be changed) | — |
| OpenAI-compatible | optional | —: the server's address, up to `/v1` |

- One key per provider, encrypted by Windows; switching providers keeps the other keys, and the model chosen for each.
- **Model**: its name at this provider; **Load the list** reads those your key allows, with nothing billed.
- Read tools and actions work the same way (the model must be able to call tools). Claude's only: **web search**, **thinking depth** and the **cost**: the other providers' prices are not known, so they do not count in the budget (their tokens are still counted).
- A conversation keeps the provider and the model it started with.
- **Grok** and **Groq** are two different services: Grok is xAI's model (the xAI line); Groq runs open models (Llama, Qwen…) very fast.

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

To answer, Forgy can read: the list of projects, a project's tree and files, a code search, Git state and diff, Docker state and a container's logs, database connections and structure, n8n workflows and executions, Vercel deployments, the server's health, services and backups, GitHub state, the workshop models (it can pre-fill the workshop form, without writing anything), a project's npm and Composer [packages](/devforge/en/dev/packages/) (the outdated or uninstalled ones, vulnerabilities on request), its tasks and notes, and the [Modeling page's models](/devforge/en/data/modeling/): an MCD with its MLD and the rules applied, an MPD with its SQL, a diagram with its parts, links and use case scenarios.

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
| Add the API key… | no saved key for the chosen provider, nor its environment variable | Settings › Forgy or › Connections, or set its variable (`ANTHROPIC_API_KEY`…) |
| API key refused | invalid or revoked key | save a new key |
| Monthly budget reached | spending ≥ budget | raise the budget or wait for next month |
| Too many steps | more than 8 tool calls | narrow or split the question |
| Too many requests | API limit | try again later |

## The mascot

Forgy's mood follows what it does: *available*, *listening*, *thinking…*, *searching…*, *writing…*, *done*, *had a problem*, and *taking a nap* after 2 minutes without activity. Animations are off if Windows asks for fewer animations.

With the panel closed, Forgy strolls along the bottom of the app with **Boulon**, his robot dog. Clicks go through him. **Settings › Forgy** turns the stroll off, or only Boulon.

Local data: `%APPDATA%\DevForge\assistant\` (settings, spending, conversations).
