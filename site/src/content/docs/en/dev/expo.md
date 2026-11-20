---
title: Expo
description: Run a React Native app with Expo, open it on the phone with the QR code, send Metro's commands and align the packages on the SDK.
---

The **Expo** page (**Development** menu) runs your React Native apps with [Expo](https://expo.dev) and opens them on your phone, with no terminal.

## Expo projects

On the left, each folder of your [projects](/devforge/en/dev/projects/) that depends on the `expo` package: the project itself, or an app of its monorepo (`apps/…`, `packages/…`). The row shows the folder and the SDK version (*SDK 54*). A green dot says which one runs.

## Starting the server

Choose how to open the app, then **Start**:

| Setting | Choices |
|---|---|
| Open in | **Expo Go** (Expo's app on the phone) or **Dev build** (a development build already installed, which needs `expo-dev-client`) |
| Connection | **Local Wi-Fi** (the phone and the PC on the same network), **Tunnel** (any network, through Expo's online service) or **This PC only** (an Android emulator, the browser) |
| Port | 8081 by default, from 1024 to 65535 |
| Clear the cache on start | starts Metro without its cache |

DevForge runs `npx expo start` in the app's folder, with these settings. One Expo server runs at a time: starting another one stops the first. The settings change while the server is stopped.

The **tunnel** needs the `@expo/ngrok` package. When Expo offers to install it, DevForge shows **Install @expo/ngrok**, which answers yes for you.

## The QR code

As soon as Metro answers, the QR code of the address (`exp://…`) shows, with the address to copy:

- with **Expo Go**, scan it with Expo Go (Android) or the camera (iPhone);
- with a **dev build**, scan it with the camera: the installed build opens on this server.

The QR code is drawn in DevForge: the address is sent nowhere.

## Metro's commands

The buttons send Expo's keys, as in a terminal:

| Button | Key |
|---|---|
| Open on Android | `a` |
| Open in the browser | `w` |
| Reload the app | `r` |
| Dev menu | `m` |
| Dev tools | `j` |
| Switch Go / build | `s` |

Below, the **Metro log**. When an error shows in it, **Ask Forgy to explain the error** sends it the end of the log, recognized secrets masked.

## Package versions

**Check** runs `npx expo install --check`: the list of the packages that do not follow the SDK, with the installed version and the expected one. **Align the versions** runs `npx expo install --fix` after a confirmation: `package.json` and the lockfile change.

## What leaves the PC

- With **Local Wi-Fi** and **This PC only**, nothing leaves the local network.
- The **tunnel** goes through Expo's online service (ngrok).
- **Ask Forgy** sends the end of the log to your AI provider, only when you click (see [what Forgy sends](/devforge/en/privacy/#what-forgy-sends)).
