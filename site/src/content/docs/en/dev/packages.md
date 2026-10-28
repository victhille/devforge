---
title: Packages
description: "The Packages tab of a project's page: outdated versions, vulnerabilities and updates rolled back if they fail, for npm, Composer, Python, Rust, Go, Ruby and Dart; the versions of .NET and Java."
---

The **Packages** tab of a [project's page](/devforge/en/dev/projects/) shows the project's dependencies, what is outdated or vulnerable, and updates them when you decide to. Nothing updates on its own.

It shows when the project has a `package.json` (npm, pnpm, yarn), a `composer.json` (Symfony, Laravel, PHP), or the dependency file of [another language](#other-languages).

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

## Other languages

These languages' dependencies get a card too, with the same columns and filters:

| Language | Files read | Installed version read from | Latest version |
|---|---|---|---|
| Python | `requirements*.txt`, `pyproject.toml` (PEP 621, Poetry), `Pipfile` | `poetry.lock`, `uv.lock`, `Pipfile.lock`, or the virtual environment (`.venv`, `venv`, `env`) | PyPI |
| Rust | `Cargo.toml` | `Cargo.lock` | crates.io |
| Go | `go.mod` (direct modules) | `go.mod` | proxy.golang.org |
| Ruby | `Gemfile` | `Gemfile.lock` | RubyGems |
| Dart, Flutter | `pubspec.yaml` | `pubspec.lock` | pub.dev |
| .NET | `*.csproj`, `*.fsproj`, `*.vbproj` | the file itself | NuGet |
| Java, Kotlin | `pom.xml`, `build.gradle(.kts)` | the file itself | Maven Central |

They have the same buttons as npm: **Update**, **Move to** *version*, the selection, **Update the compatible ones** and **Check for vulnerabilities**. "Within range" reads each language's syntax: `>=4.2,<5` and `~=1.4` in Python, `1.2` (meaning `^1.2`) in Rust, `~> 7.1` in Ruby.

| Manager | Within range | Beyond | Vulnerabilities |
|---|---|---|---|
| pip | `python -m pip install -U` in the virtual environment | the file's line rewritten (`>=` *version*), then the same command | `pip-audit -r` |
| Poetry | `poetry update` | `poetry add name@^version` | `pip-audit` on the environment |
| uv | `uv lock --upgrade-package`, then `uv sync` | `uv add "name>=version"` | `pip-audit` on the environment |
| Pipenv | `pipenv update` | `pipenv install "name>=version"` | `pip-audit` on the environment |
| Cargo | `cargo update -p` | `cargo add name@version` | `cargo audit` |
| Go | `go get module@latest` (within its major version), then `go mod tidy` | — | `govulncheck` |
| Bundler | `bundle update` | the `Gemfile` rewritten (`~> major.minor`), then `bundle update` | `bundle-audit` |
| pub | `dart pub upgrade` (`flutter` for a Flutter project) | `dart pub add name:^version` | — |

- **As for npm**, the files are saved first (the dependency file and its lockfile); if a command fails, they are put back as they were and the log stays on screen.
- **Python** always goes through the project's virtual environment (`.venv`, `venv` or `env`), never the system's Python. Without one, the card says so and gives the command that creates it (`python -m venv .venv`). With pip, a failure puts the file back, but the environment keeps what was installed: the log gives the command that brings the old versions back.
- **A missing tool** (`poetry`, `uv`, `cargo`…) is reported with the command that installs it, and the update stays blocked. **A missing audit tool** (`pip-audit`, `cargo-audit`, `govulncheck`, `bundle-audit`) too: nothing is checked while it is missing.
- **.NET and Java** only compare: a line at the top of the card gives the command to run in the project's terminal (`dotnet list package --outdated`, `mvn versions:display-dependency-updates`, `./gradlew dependencyUpdates`), with **Copy the command**.

A `requirements-dev.txt` (or `-test`, `-lint`) and a `pyproject.toml`'s optional groups count as *dev* dependencies. A `pyproject.toml` declaring no dependency (tool settings only) gets no card.

## Composer

- **Laravel Sail**: the commands run in the container (`docker compose exec -u sail laravel.test composer …`); Sail must be running.
- **Composer missing** from the PC (and no Sail): a banner says so, with the link to [getcomposer.org](https://getcomposer.org/). The list can be read, but updates are turned off.

## With Forgy

Forgy reads the project's packages: "What is outdated in this project?", "Are there vulnerabilities?". It can suggest an update through a **card** you approve: never automatic, even in **Auto for safe actions** mode, and undoable from the action journal. See [Forgy's actions](/devforge/en/forgy/actions/).
