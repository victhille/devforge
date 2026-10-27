---
title: Git
description: The Git dashboard of all your projects, the guided commit and GitHub.
---

The **Git** page is the dashboard of every repository in your projects, at a glance.

## The dashboard

![The Git dashboard](../../../../assets/screens/git-en.png)

At the top, four counters: **Repositories**, **With changes**, **To push**, **To pull**. The **Needs attention** filter keeps only the repositories that need something; **All** shows them all. When there is nothing to do: "Everything is clean".

For each repository: the branch, the number of changed files, the commits ahead or behind, and special cases (*no upstream*, *no remote*). Buttons **Fetch**, **Pull**, **Push** and **Commit**. **Fetch all** updates every repository from its remote.

## Making a commit

**Commit** opens a window:

- tick the files to include (**All** to take everything);
- write the message in the [Conventional Commits](https://www.conventionalcommits.org) format: type, short description, optional details;
- **Suggest** proposes a type (`feat`, `fix`, `docs`, `test`, `ci`…), a scope and a description from the changed files, without calling the AI;
- **Commit** or **Commit & push**.

If the push fails after the commit, the commit stays and DevForge tells you.

## GitHub

With GitHub connected ([Connections](/devforge/en/getting-started/connections/#github)), the **GitHub** tab of each [project page](/devforge/en/dev/projects/) shows:

- **GitHub Actions**: the latest runs (success, failed, running…), **Re-run failed jobs**, **Open on GitHub**;
- **Open pull requests**, drafts included;
- published **Releases** and pre-releases.

A private repository the token cannot reach shows as not found.

## With Forgy

Forgy reads the state and diff of your repositories. It can propose a commit, a pull or a push, which you approve; it never force-pushes. See [Forgy's actions](/devforge/en/forgy/actions/).
