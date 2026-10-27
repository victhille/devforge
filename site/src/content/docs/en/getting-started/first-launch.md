---
title: First launch
description: The five steps of DevForge's welcome screen.
---

On the very first launch, DevForge opens a **five-step** welcome. Nothing is plugged in advance: DevForge only knows what you give it, and everything is optional. **Skip**, top right, closes the welcome at any step; everything can be found later in [Settings](/devforge/en/settings/general/).

## 1. Welcome

Pick the language: **Français** or **English**. It applies right away to the interface, the release notes and Forgy's answers. By default it is Windows' language (French if Windows is in French, English otherwise).

The screen recalls what DevForge does: your projects in one place, Docker and Compose locally and on your server, databases, logs and the API Tester, watched SSH servers, n8n and Vercel. **Read the getting started guide on the site** opens this page.

## 2. Where are your projects?

DevForge suggests a projects folder (by default `Development` in your home folder). **Browse** picks another one; **Search** scans it **two levels deep** and spots the projects (a known framework or a package manifest).

All projects found are checked; uncheck those you don't want and click **Add N project(s)**. The folder becomes the **default projects directory**: new projects are created there and the [Projects](/devforge/en/dev/projects/) page scans it.

## 3. Your accounts

- **Git identity**: the name and e-mail of your commits (`git config --global`). If they already exist on this PC, they are filled in.
- **GitHub**: if [GitHub CLI](https://cli.github.com) is already signed in (`gh auth login`), DevForge uses it and shows it. Otherwise you can paste a GitHub personal token (optional).

A server, Vercel, databases? Plug them in whenever you like in [Settings › Connections](/devforge/en/getting-started/connections/).

## 4. Meet Forgy

[Forgy](/devforge/en/forgy/assistant/) is DevForge's assistant. It knows your projects and the page you are on; it reads, explains and can act for you, every action waiting for your approval.

To make it talk, paste an **Anthropic API key** (`sk-ant-…`) and click **Save key**. It is optional: without a key, all of DevForge works except Forgy. The key is encrypted by Windows and only goes to the Anthropic API. **Later** moves on.

## 5. All set

Three things to remember:

| To | Shortcut |
|---|---|
| Go anywhere, run an action | <kbd>Ctrl</kbd> <kbd>K</kbd> |
| Open Forgy | <kbd>Ctrl</kbd> <kbd>J</kbd> |
| Set everything | **Settings**, at the bottom of the menu |

**Let's go** opens the [home screen](/devforge/en/getting-started/interface/). The welcome screen does not come back, except after **Settings › Data › Erase everything**.
