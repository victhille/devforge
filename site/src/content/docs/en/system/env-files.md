---
title: Env variables
description: Compare, complete, edit and back up (encrypted) your projects' .env files.
---

The **Env variables** page gathers the `.env` files of all your projects.

## Reading

![A project's variables, values hidden](../../../../assets/screens/env-files-en.png)

On the left, the projects that have `.env`, `.env.local`, `.env.example`… files. On the right, a grid: one row per **key**, one column per file. A key can be *missing* or *empty* in a file; the example file is marked *template*.

Values are hidden by default: **Show values** / **Hide values**.

## Fill from the template

If keys of the template (`.env.example`) are missing in `.env`, a banner lists them. **Add them from the template** copies them into `.env`.

## Editing

**Edit** a value or **Add** a key writes straight to the file.

**Regenerate** shows on hover for the secrets the app draws itself, known by their exact name: `APP_KEY`, `APP_SECRET`, `SECRET_KEY`, `SESSION_SECRET`, `JWT_SECRET`, `AUTH_SECRET`, `NEXTAUTH_SECRET`, `BETTER_AUTH_SECRET`, `COOKIE_SECRET`, `CSRF_SECRET`. Once you confirm, DevForge makes an **encrypted backup** of the `.env` files, then writes a new random secret: 32 bytes in hexadecimal, or `base64:` then 32 bytes for Laravel's `APP_KEY`. Open sessions and what was encrypted with the old value are no longer readable; **Restore** brings the backup back. Secrets given by a service (`STRIPE_KEY`, `GITHUB_CLIENT_SECRET`, an API token) and encryption keys are never offered.

## Backing up

- **Encrypted backup** saves the project's `.env` files in DevForge, encrypted by Windows. The date of the last backup shows.
- **Restore** overwrites the `.env` files with the last backup, after confirmation.

A backup is also made before each [pull of a server's .env](/devforge/en/dev/projects/#sync-the-env-with-the-server).

:::note[Forgy and .env files]
Forgy never reads `.env` files (except example files). It can only propose to **add a new key**, value masked on the card, never to change an existing key.
:::
