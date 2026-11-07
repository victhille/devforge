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

- **Filter lines…**: shows only the lines that contain the text.
- **Pause** / **Follow**: freezes the view or resumes following.
- **Wrap lines** or not.
- **Clear the view**.

## Elsewhere

- The **Logs** tab of each [project page](/devforge/en/dev/projects/) follows that project's logs.
- Container logs are on the [Docker](/devforge/en/dev/docker/#logs) page.
- On this page, Forgy receives the last 150 lines shown to explain an error.
