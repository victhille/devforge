---
title: Env variables
description: Compare, complete, edit and back up (encrypted) your projects' .env files.
---

The **Env variables** page gathers the `.env` files of all your projects.

## Reading

![A project's variables, values hidden](../../../../assets/screens/env-files-en.png)

On the left, all your projects: those with `.env`, `.env.local`, `.env.example`… files first, with the number of keys their `.env` misses or their number of files. On the right, a tab per file, with its number of keys, and a table: the **key**, its **value**, whether the example file has it (*yes* / *no*) and the actions.

Secrets are hidden by default: only known setting keys (`NODE_ENV`, `APP_URL`, `…_HOST`, `…_PORT`, `NEXT_PUBLIC_…`, `VITE_…`) show in clear, never an address that holds a password. A row's eye shows its value; the copy icon copies it.

## Fill from the template

If keys of the template (`.env.example`) are missing in `.env`, a banner says so ("STRIPE_KEY is in .env.example but not in .env."). **Add it** or **Add them** copies them into `.env`.

## Editing

A row's pencil (or a double click on its value) edits it; the bin deletes it. **Add a key** opens a row at the top of the table: the key and its value go into the file of the open tab. Everything is written straight to the file.

The **Regenerate** icon (two arrows) shows next to the secrets the app draws itself, known by their exact name: `APP_KEY`, `APP_SECRET`, `SECRET_KEY`, `SESSION_SECRET`, `JWT_SECRET`, `AUTH_SECRET`, `NEXTAUTH_SECRET`, `BETTER_AUTH_SECRET`, `COOKIE_SECRET`, `CSRF_SECRET`. Once you confirm, DevForge makes an **encrypted backup** of the `.env` files, then writes a new random secret: 32 bytes in hexadecimal, or `base64:` then 32 bytes for Laravel's `APP_KEY`. Open sessions and what was encrypted with the old value are no longer readable; **Restore** brings the backup back. Secrets given by a service (`STRIPE_KEY`, `GITHUB_CLIENT_SECRET`, an API token) and encryption keys are never offered.

## Backing up

- **Encrypted backup** (in the **⋯** menu) saves the project's `.env` files in DevForge, encrypted by Windows. The date of the last backup shows right of the tabs.
- **Restore** (in the **⋯** menu, once a backup exists) overwrites the `.env` files with the last backup, after confirmation.

A backup is also made before each [pull of a server's .env](/devforge/en/dev/projects/#sync-the-env-with-the-server).

:::note[Forgy and .env files]
Forgy never reads `.env` files (except example files). It can only propose to **add a new key**, value masked on the card, never to change an existing key.
:::
