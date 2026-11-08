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

- The table shows each device: its address, its last connection (*connected* when it just connected, else since when), its transfers, its expiry date if any, and the **On** switch.
- A click on a device shows its **QR code** beside the table, to scan with the WireGuard app on the phone. It holds the device's private key: it closes by itself after 2 minutes, do not share it.
- Under the code: **Download the .conf file** for a computer, and **Delete** (the device can no longer connect).
- **New client** (at the top): a name (for example `My phone`) and an optional expiry (empty = permanent access). Its QR code shows at once.

The **⋯** menu: **Open wg-easy** (the full interface, through a tunnel in the SSH session), **Refresh** and **Forget the login**.

The **VPN** widget on Home tells how many devices are connected. The command palette creates a client; so does Forgy, after your approval, and the page opens on its QR code.
