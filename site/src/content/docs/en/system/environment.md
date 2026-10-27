---
title: Environment
description: The dev tools installed on your PC, their versions, and how they match what your projects need.
---

The **Environment** page detects the dev tools installed on this PC and their version.

| Category | Tools |
|---|---|
| JavaScript | Node.js, npm, pnpm, Yarn |
| Version Control | Git |
| PHP | PHP, Composer, Symfony CLI |
| Infrastructure | Docker, Python |

A missing tool is marked *Not detected*, with **Install…**: a link to its install page and, when there is one, the command to run (for example `npm install -g pnpm`).

Detection is kept in memory (installed tools rarely change); **Refresh** runs it again.

## Project requirements

Below, DevForge compares the installed versions with what your projects ask for: for Node.js, `.nvmrc`, `.node-version`, `volta` or `engines` in `package.json`; for PHP, `require.php` in `composer.json`. Each requirement is **Compatible**, **Wrong version**, **Not installed** or **Unknown range**; the title sums up "all compatible" or the number of problems.

The [Symfony and Laravel workshops](/devforge/en/dev/projects/#framework-workshops) point here when PHP or Symfony CLI are missing.
