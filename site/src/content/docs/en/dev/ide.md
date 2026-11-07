---
title: IDE
description: The IDEs DevForge finds on your PC, the ones you add by hand, and one IDE per project.
---

Wherever a project opens (cards, project page, command palette, launcher, Git dashboard), the button bears the **name of the IDE** that will open it.

## The IDEs found

DevForge looks for these IDEs in their usual install folders, then in the `PATH`:

| Family | IDEs |
|---|---|
| Editors | VS Code, Cursor, Windsurf, Antigravity, Zed, Sublime Text, Notepad++ |
| JetBrains | PhpStorm, WebStorm, IntelliJ IDEA, PyCharm, Rider, GoLand, RustRover (installed by hand or by the Toolbox) |
| Microsoft | Visual Studio |

In [Settings › General](/devforge/en/settings/general/), **Default IDE** only offers the ones found on this PC; the others show greyed under "Not found on this PC". **None** removes the IDE buttons.

## Adding an IDE by hand

An IDE missing from the list (a portable build, a rare editor): **IDEs added by hand › Add an IDE**.

| Field | Content |
|---|---|
| Name | the name shown on the buttons |
| Program | the `.exe`, `.cmd` or `.bat` file (**Browse** opens the file picker) |
| Arguments | `{dir}` is replaced by the project's folder; `{dir}` alone by default, for instance `--new-window "{dir}"` |

**Try** opens your projects folder with this IDE before you save it. Once saved, it joins the default IDE's choices and each project's; the pencil edits it, the bin removes it. An IDE whose program is gone is marked "not found".

The program starts directly, without a shell; a `.cmd` or `.bat` needs one, so its path and arguments may not hold characters `cmd.exe` would interpret.

## One IDE per project

On a project's page, **Project** tile, **IDE of this project**: *Default* follows Settings; another IDE stays this project's, even when the default one changes.

In a [group](/devforge/en/dev/projects/#nested-projects-groups), each project has its own too, picked in its panel on the group's page: PhpStorm for the back, Cursor for the front, say. With no choice, a project takes the group's IDE.
