---
title: VPN
description: Manage your VPS's WireGuard clients with wg-easy, QR codes included.
---

The **VPN** page manages your server's WireGuard through [wg-easy](https://github.com/wg-easy/wg-easy).

## Requirements

A **wg-easy version 15 or newer** container must run on the server, with its web interface published on a port of the server. DevForge looks for it and shows its version and port; otherwise it says what is missing.

## Sign in

Enter the **wg-easy interface** login (not the server one). It is checked, then encrypted by Windows; it only leaves DevForge towards wg-easy, through the SSH session. **Forget the login** removes it without changing anything on the server.

## Clients

- The list shows each device: *never connected* or *seen …*, expiry date or *Permanent*, and a switch to enable or disable it.
- **New**: a name (for example `My phone`) and an optional expiry (empty = permanent access).
- **QR code**: to scan with the WireGuard app on the phone. It holds the device's private key: do not share it.
- **Download the configuration**: the `.conf` file for a computer.
- **Delete**: the device can no longer connect.

**Open wg-easy** opens the full interface through a tunnel in the SSH session.

The **VPN** widget on Home tells how many devices are connected. The command palette creates a client; so does Forgy, after your approval, and the page opens on its QR code.
