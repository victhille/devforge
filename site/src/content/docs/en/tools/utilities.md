---
title: Tools
description: Toolbox (JSON, Base64, JWT, regex, hash, UUID, cron, timestamp, URL), snippets, text diff, secret generator and cheat sheets.
---

The **Tools** group gathers the small everyday utilities. Everything runs on your PC, nothing is sent.

## Toolbox

One page, a card per tool (its name and what it does), and **Find a tool…** to go fast (<kbd>Enter</kbd> opens the first one found, the arrows move from one tool to the next):

| Tool | What it does |
|---|---|
| JSON | **Format**, **Minify** or **Sort keys** (every object in alphabetical order, lists keep theirs), with a clear error if the JSON is invalid |
| Base64 | **Encode** / **Decode** |
| JWT | decodes a token's header and payload, without checking the signature |
| Regex | a pattern and its flags, tested on a text: matches are highlighted |
| Hash | SHA-1, SHA-256, SHA-384 or SHA-512 of a text |
| UUID | generates several v4 UUIDs at once |
| Cron | explains a cron expression (minute, hour, day, month, weekday) and gives the **next runs** |
| Timestamp | converts a Unix timestamp (seconds or milliseconds) to local time and relative time; **Now** |
| URL | encodes (`encodeURIComponent` or `encodeURI`), decodes, and splits a URL: protocol, host, path, parameters, hash |

Each tool has an **Input** card, where you type or paste, and a **Result** card, on a dark background, with its copy button.

## Help and examples

At the top of each tool (the toolbox's tabs, Snippets, Diff, the Generator and [Webhooks](/devforge/en/data/webhooks/)), a banner says **what it is for** and **how to use it**, with **examples** to load in one click:

- **Regex**: greyed examples in the fields, and models that fill the pattern and the test text: *Email*, *Date dd/mm/yyyy*, *http(s) link*, *French phone*;
- **JSON**, **Base64**, **JWT**, **Hash**, **URL**, **Timestamp**, **Diff**: an example fills the fields;
- **Snippets**: while you have none, an example snippet shows, greyed; it is saved only if you click **Start from this example**;
- **Webhooks**: *A Stripe payment* shows a typical received request (headers, body); its replay address ends in `.invalid`, which does not exist, and **Send** is off.

An example only fills fields: nothing is saved or sent. **Hide the help** folds the banner for that tool (remembered), **Help** opens it again.

## Snippets

Your reusable pieces of code: a **title**, a **language**, the **code** and **tags** (`react, hook, typescript`). On the left, a search, the languages as filters (**All**, TypeScript, PHP…) and the list, each snippet with its language and first tag. On the right, the chosen snippet: its tags, its code in colours, **Copy** and **New snippet**; the **⋯** menu lets you **Edit** it (the form, then **Save**) or **Delete** it, after confirmation. A block of the [built-in terminal](/devforge/en/getting-started/interface/#the-built-in-terminal) can be saved as a snippet too.

## Text Diff

Paste an **Original** and a **Modified** text: the number of lines removed and added shows, then the two versions **side by side**, with their line numbers, removed lines in red on the left and added lines in green on the right. **Unified** shows them as one list, with `+` and `-` (the choice is remembered). **Ignore whitespace** counts as equal the lines that only differ by indentation or extra spaces. **Swap** exchanges the two texts, **Clear** empties them.

## Generator

A tab per kind of value, with its **Settings** on the left and the **Result** on the right:

| Tab | Settings |
|---|---|
| Password | length, uppercase, lowercase, digits, symbols |
| App secret / token | format (Base64, Hex, alphanumeric) and number of bytes. In Base64: **base64: prefix (Laravel APP_KEY)** gives a key ready for Laravel's `.env`, **URL-safe** replaces `+` and `/` with `-` and `_` |
| UUID | how many to draw at once (1 to 20), **Copy all** |

A value is drawn as soon as it opens, and again when a setting changes; **Regenerate** draws another, **Copy** copies it. The result gives its strength in bits. Settings are remembered.

## Docs

Command cheat sheets for **Docker**, **React**, **Vue**, **Symfony**, **Node.js**, **Git**, **Shell** and **Python**: on the left, each reference with its number of commands; on the right, its sections as cards, a row per command (the command, what it does, the copy). The search filters the open reference.

### Your own commands

**Add a command**: the command, a description, and a **category**, one of the references (Git, Docker…) or a **New category…** that joins the list on the left. Your commands come first in their reference, under **My commands**, and the search finds them; hover one to **Edit** or **Delete** it.

- **As you type**, suggestions complete the command: your `PATH`'s programs for the first word, the commands already in the docs, and the known sub-commands of `git`, `npm`, `pnpm`, `yarn`, `composer`, `php artisan`, `php bin/console`, `symfony`, `docker`, `docker compose` and `gh`. <kbd>↓</kbd> <kbd>↑</kbd> to choose, <kbd>Enter</kbd> or <kbd>Tab</kbd> to take one.
- **Check**: the program (the first word) is looked for on this PC. Found, its path shows; otherwise a warning says it is not here, and you can save anyway (a remote server's command, say).

Your commands are kept in `doc-commands.json`, with DevForge's [backups and export](/devforge/en/settings/data/). The [built-in terminal](/devforge/en/getting-started/interface/#the-built-in-terminal) uses them for its suggestions too.
