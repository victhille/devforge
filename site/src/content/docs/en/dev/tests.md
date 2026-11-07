---
title: Tests
description: "The Tests tab of a project's page: run Vitest, Jest, Playwright, PHPUnit, pytest, Go or Cargo, see each test, read a failure, run it again, hand it to Forgy."
---

The **Tests** tab of a [project's page](/devforge/en/dev/projects/) runs the project's tests and shows each one, passed or failed. It shows when DevForge finds a test tool in the project.

## The tools recognised

| Tool | Recognised by | Run with |
|---|---|---|
| Vitest | `vitest` in the `package.json` dependencies | `npx vitest run` |
| Jest | `jest` in the dependencies | `npx jest` |
| Playwright | `@playwright/test` in the dependencies | `npx playwright test` |
| PHPUnit | `vendor/bin/phpunit` (or Symfony's `bin/phpunit`) | `php vendor/bin/phpunit` |
| pytest | `pytest` in `requirements*.txt` or `pyproject.toml`, a `pytest.ini` or a `conftest.py` | `python -m pytest`, with the Python of the project's virtual environment |
| Go | a `go.mod` and `*_test.go` files | `go test ./...` |
| Cargo | a `Cargo.toml` | `cargo test --no-fail-fast` |

With several tools (Vitest and Playwright, say), a menu picks which one runs. A missing tool (dependencies not installed, no virtual environment, `go` or `cargo` absent) is reported with the command that installs it.

## Running the tests

**Run the tests** starts the tool in the project's folder; its output scrolls below while it runs, and **Stop** cuts it. Then:

- four figures: **passed**, **failed**, **skipped**, and the **duration**;
- the tests **by file**, each with ✓, ✗ or *skipped* and its time; a file with a failure is open, the others folded;
- **Command output**, folded, keeps what the tool wrote.

The tool writes its report in DevForge's data, never in the project. The last whole run is kept: back on the tab, it shows with its time (*Last run 5 min ago*).

## Failures

A failed test unfolds under its line:

- its **message**;
- **Expected** and **Received**, when the tool gives them (Jest, Vitest, PHPUnit, pytest, and `left` / `right` in Rust);
- **At** *file:line*: a click opens the file in the **Files** tab, at the line, highlighted;
- **Full message** for the whole trace.

Then:

- **Run this file again** (under the failure, or the icon on the file's row);
- **Run the failures again**: only the files that failed;
- **Failures only** hides everything that passes;
- **Explain with Forgy** sends the test's name, place and message to [Forgy](/devforge/en/forgy/assistant/), which explains the failure and suggests a fix.
