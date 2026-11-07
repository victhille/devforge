---
title: Activity
description: The commits of all your projects over 12 weeks, the most active, those asleep and the branches to push.
---

The **Activity** page (Development menu) shows what you did across all your projects. Everything is read from Git, on this PC: no online service, nothing is sent.

## Commits per week

A bar chart of the **last 12 weeks** (a week starts on Monday). The most active projects each get their colour, the rest are grouped as "others". Hover a bar to see that week project by project.

Merge commits are not counted.

## Filters

- **Folders**: with several [project folders](/devforge/en/dev/projects/), one chip per folder keeps only its projects.
- **Me / Everyone**: by default only your commits count, recognised by the address in `git config --global user.email`. **Everyone** counts the others' too.

## The three cards

- **Most active this month**: the projects with the most commits in the last 30 days, with the lines added and removed.
- **Asleep**: no commit for 3 months, with the date of the last one. A folder that is not a Git repository does not show there.
- **Branches to follow**: commits not pushed yet (↑) or to pull (↓), project by project. A click opens the project's Git tab.

A click on a project opens its [page](/devforge/en/dev/projects/).

## Refresh

The activity is read when the page opens, eight projects at a time, then kept 3 minutes. **Refresh** reads it again right away (after a `git fetch`, for example).

## On Home

The **Commits** widget on [Home](/devforge/en/getting-started/interface/) shows your commits of the week, the last 12 weeks in small and the branches to push. Add it with **Customize**.
