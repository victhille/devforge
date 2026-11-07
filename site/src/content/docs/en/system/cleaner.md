---
title: Disk cleaner
description: Free space by removing folders your tools can regenerate (node_modules, vendor, builds, caches).
---

The **Disk cleaner** page frees space by removing folders your tools can regenerate.

## Scan

Pick a folder (**Browse**) and **Scan**. DevForge lists, with their size:

| Category | Folders |
|---|---|
| Dependencies | `node_modules`, `vendor` (next to a `composer.json`), `target` (next to a `Cargo.toml`), `.venv`, `venv` |
| Build output | `dist` and `build` (next to a `package.json`), `.next`, `.nuxt`, `.output`, `.svelte-kit` |
| Caches | `.turbo`, `.parcel-cache`, `.cache`, `coverage`, `__pycache__` |

The reclaimable total shows at the top. Projects with no activity for more than 30 days are marked *inactive*.

## Choose

- Tick folders one by one, or **Select all**.
- **Projects untouched for 30+ days** only ticks the inactive projects' folders.
- **Clear** unticks everything. The **All**, **Dependencies**, **Build output**, **Caches** filters narrow the list.

## Delete

**Delete selection** asks for confirmation: folders are **permanently deleted** (no Recycle Bin). They can be regenerated with `npm install`, `composer install`, `cargo build`… At the end, DevForge shows the space freed.
