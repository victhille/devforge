---
title: Installation
description: Install DevForge on Windows, get past the SmartScreen warning and receive updates.
---

DevForge is a desktop application for **Windows 10 and 11 (64-bit)**. It is free, open source (MIT license) and needs no account.

## Download

Get the installer from the [Download](/devforge/en/download/) page or straight from the [GitHub releases](https://github.com/victhille/devforge/releases/latest). It is called `DevForge-Setup-vX.Y.Z.exe`, where `X.Y.Z` is the version number.

## The SmartScreen warning

The installer is not signed. On first run, Windows SmartScreen may show:

> Windows protected your PC

1. Click **More info**.
2. Check that the app is indeed `DevForge-Setup-vX.Y.Z.exe`.
3. Click **Run anyway**.

:::tip[Why this warning?]
SmartScreen distrusts programs without a (paid) code-signing certificate or with few downloads yet. The source code and the way the installer is built are public on [GitHub](https://github.com/victhille/devforge): every release is produced by GitHub Actions from the repository.
:::

## The installer

The installer lets you pick the install folder. DevForge is added to the Start menu and the Desktop. At the end, it opens on the [welcome screen](/devforge/en/getting-started/first-launch/).

## Where your data lives

Everything stays on your PC, in DevForge's data folder (`%APPDATA%\DevForge`): settings, saved projects, connections, history, log. Keys, tokens and passwords are **encrypted by Windows** there and are never shown again. **Settings › Data** shows this folder and its size, see [Data, export and reset](/devforge/en/settings/data/).

## Automatic updates

- DevForge reads the GitHub releases **15 seconds after it starts**, then **every 6 hours**.
- A new version downloads in the background. It installs **on the next restart**, or right away with **Restart and update**.
- The menu also shows an **Update (vX.Y.Z)** button once a version is ready.
- After the update, a **What's new** window sums up the version (can be turned off).

It is all in **Settings › Updates**: **Stable** channel (final versions) or **Beta** (pre-releases too, earlier but sometimes with bugs), a **Check** button, release notes in the app's language. See [Settings](/devforge/en/settings/general/#updates).

## Uninstall

Go through **Windows Settings › Apps › Installed apps › DevForge › Uninstall**. To also erase your data first, use **Settings › Data › Erase everything** in DevForge.
