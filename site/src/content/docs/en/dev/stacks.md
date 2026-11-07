---
title: Stack launcher
description: Start your whole dev setup in one click, front, API, Docker, VS Code and browser.
---

The **Launcher** (*Stack launcher* page) starts your whole dev setup in one click. A **stack** groups what you start every day: the front, the API, Docker, VS Code, the browser…

## Creating a stack

**New stack** opens the editor:

- **Name** (for example `My SaaS (front + API)`) and **Color**.
- **Steps**, in order:
  - **Command**: a label, the command and its **folder**;
  - **VS Code** on a folder;
  - **URL** to open in the browser, with a **delay before opening** (in milliseconds) to let the server start.
- **+ From a project…** adds the project's `dev` script and VS Code in one go.

## Start and stop

- **Start** runs every step. Each command shows its state: *running*, *finished*, *stopped*, *failed*.
- **Stop all** stops the stack's processes.
- **Edit** reopens the editor; deleting a stack stops its processes.

Stacks can also be started from the command palette (<kbd>Ctrl</kbd> <kbd>K</kbd>).
