---
title: Packages
description: "The Packages tab of a project's page, for npm and Composer: outdated versions, vulnerabilities, chosen updates rolled back if they fail."
---

The **Packages** tab of a [project's page](/devforge/en/dev/projects/) shows the project's dependencies, what is outdated or vulnerable, and updates them when you decide to. Nothing updates on its own.

It shows when the project has a `package.json` (npm, pnpm, yarn) or a `composer.json` (Symfony, Laravel, PHP).

## One card per manifest

Each `package.json` and each `composer.json` has its card, subfolders included down to 3 levels (`node_modules` and `vendor` left out): a Laravel project has two, a repository with several packages has one per package. The card's header gives the manifest, the declared name, the manager and the number of packages.

The manager is recognised by the lockfile, next to the manifest or higher up in the project: `pnpm-lock.yaml` for pnpm, `yarn.lock` for yarn, `package-lock.json` for npm; otherwise by the `packageManager` field of the `package.json`, and npm by default.

## The list

| Column | Content |
|---|---|
| Package | its name; a click opens its page on npmjs.com or packagist.org |
| Wanted | the declared range (`^1.2.0`, `^7.0\|^8.0`…) |
| Installed | the version in `node_modules` or `vendor`, or *not installed* |
| Latest | the latest published version: npm registry (or the one in `.npmrc`), Packagist's stable versions |
| State | *up to date*, *patch*, *minor*, **major** or *unknown*, and the vulnerability if there is one |

The **Outdated** (default), **Major** and **All** filters change what shows. Composer's `php`, `ext-*` and `lib-*` entries are left out.

## Vulnerabilities

**Check for vulnerabilities** runs the manager's audit: `npm audit`, `pnpm audit`, `yarn audit` (yarn 1) or `composer audit`. Each package concerned carries its severity: low, moderate, high, critical, or *unrated* when the advisory gives none.

*Audit unavailable* shows without a lockfile, when the dependencies are not installed, or with yarn 2 and later.

## Updating

- **Update** on a row: the newest version **within the declared range**.
- **Move to** *version*: leaves the range for the latest published version, and rewrites the `package.json` or `composer.json`.
- Tick several rows, then **Update the selection**.
- **Update the compatible ones** does every patch and minor at once, without leaving the ranges.

A **major version** asks for confirmation: it can break the project, read the package's release notes first.

The command's log shows live; **Log of the last update** keeps it afterwards.

| Manager | Command run |
|---|---|
| npm | `npm update`, or `npm install package@latest` outside the range |
| pnpm | `pnpm update`, or `pnpm add package@latest` |
| yarn 1 | `yarn upgrade`, or `yarn add package@latest` |
| yarn 2 and later | `yarn up -R`, or `yarn up package@latest` |
| Composer | `composer update package --with-dependencies`, or `composer require package:^version` |

A development dependency stays one.

:::note[Automatic rollback]
Before each update, the manifest and the lockfile are saved in DevForge's folder (`backups/packages/`). If a command fails, they are put back as they were. Run an install if `node_modules` or `vendor` changed in the meantime.
:::

## Composer

- **Laravel Sail**: the commands run in the container (`docker compose exec -u sail laravel.test composer …`); Sail must be running.
- **Composer missing** from the PC (and no Sail): a banner says so, with the link to [getcomposer.org](https://getcomposer.org/). The list can be read, but updates are turned off.

## With Forgy

Forgy reads the project's packages: "What is outdated in this project?", "Are there vulnerabilities?". It can suggest an update through a **card** you approve: never automatic, even in **Auto for safe actions** mode, and undoable from the action journal. See [Forgy's actions](/devforge/en/forgy/actions/).
