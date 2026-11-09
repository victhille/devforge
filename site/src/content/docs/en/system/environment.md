---
title: Environment
description: The dev tools installed on your PC, their versions, and how they match what your projects need.
---

The **Environment** page detects the dev tools installed on this PC and their version.

| Card | Tools |
|---|---|
| JavaScript | Node.js, npm, pnpm, Yarn |
| PHP | PHP, Composer, Symfony CLI |
| Tools | Git, Docker |
| Other languages | Python |

A tool found has a check and its version. A missing tool is greyed out, with **Install**: a link to its install page and, next to it, the command to run when there is one (for example `npm install -g pnpm`). When one of your projects needs it, the button turns to the accent color and says which one ("used by online-shop").

Each card says how many of its tools are detected ("3 / 4").

Detection is kept in memory (installed tools rarely change); **Refresh** runs it again.

## Project requirements

Below, DevForge compares the installed versions with what your projects ask for: for Node.js, `.nvmrc`, `.node-version`, `volta` or `engines` in `package.json`; for PHP, `require.php` in `composer.json`. Each requirement is **Compatible**, **Wrong version**, **Not installed** or **Unknown range**; the title sums up "all compatible" or the number of problems.

The [Symfony and Laravel workshops](/devforge/en/dev/projects/#framework-workshops) point here when PHP or Symfony CLI are missing.
