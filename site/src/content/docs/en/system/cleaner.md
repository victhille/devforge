---
title: Disk cleaner
description: Free space by removing folders your tools can regenerate (node_modules, vendor, builds, caches).
---

The **Disk cleaner** page frees space by removing folders your tools can regenerate.

## Scan

Pick a folder (the field top right, or the folder icon to browse) and **Scan**. DevForge lists, with their size:

| Category | Folders |
|---|---|
| Dependencies | `node_modules`, `vendor` (next to a `composer.json`), `target` (next to a `Cargo.toml`), `.venv`, `venv` |
| Build output | `dist` and `build` (next to a `package.json`), `.next`, `.nuxt`, `.output`, `.svelte-kit` |
| Caches | `.turbo`, `.parcel-cache`, `.cache`, `coverage`, `__pycache__` |

A card gives the **reclaimable** total, a bar that splits it between dependencies, caches and builds, and the **Delete the selection** button with its size. The table gives for each folder its category (its color), the project, the project's **last activity** and the size. Projects with no activity for more than 30 days are marked *inactive*.

Folders are found in a fraction of a second (DevForge never looks inside a `node_modules`), then their sizes come one by one, sixteen at a time. On Windows they are read from the system's own listing (`robocopy` in list mode: nothing is copied, links and junctions are not followed): a few seconds for hundreds of thousands of files, instead of a minute reading each file.

## Choose

- Tick folders one by one, or **Select all**.
- **Projects untouched for 30+ days** only ticks the inactive projects' folders.
- **Clear** unticks everything. The **All**, **Dependencies**, **Build output**, **Caches** filters narrow the list.

## Delete

**Delete selection** asks for confirmation: folders are **permanently deleted** (no Recycle Bin). They can be regenerated with `npm install`, `composer install`, `cargo build`… At the end, DevForge shows the space freed.
