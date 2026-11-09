---
title: Log viewer
description: Follow a log file live, colored by level and filterable.
---

The **Log viewer** follows a log file **live**, like `tail -f`.

## Opening a file

- **Open a log file** picks any file.
- **Log files found in your projects** suggests your projects' ones: `storage/logs` (Laravel), `var/log` (Symfony), `logs`…

Known formats: Laravel, Symfony, nginx, pm2, and JSON logs (pino, winston). Lines are **colored by level** (error, warning, info, debug).

## Reading

Each line shows its time, its level (**ERROR**, **WARNING**, **INFO**, **DEBUG**) and its message.

- At the top, the file followed: the menu goes from one open file to another, or opens another one.
- **Pause** / **Follow**: freezes the view or resumes following.
- **Filter lines…**: shows only the lines that contain the text.
- **All**, **Errors**, **Warnings**, **Info**: one level at a time; errors and warnings give their number.
- On the right, the project, the number of lines and whether it is followed.
- The **⋯** menu: **Wrap lines** or not, **Clear the view**, **Close this file**.

## Forgy explains the line

A click on an error or a warning opens the **Forgy explains the line** card beside it: **Explain this line** sends Forgy the line and the ones around it, to learn where the problem comes from and how to fix it. **Open the file** opens it in your editor.

## Elsewhere

- The **Logs** tab of each [project page](/devforge/en/dev/projects/) follows that project's logs.
- Container logs are on the [Docker](/devforge/en/dev/docker/#logs) page.
- On this page, Forgy receives the last 150 lines shown to explain an error.
