---
title: Développeurs
description: Compiler DevForge, comprendre son architecture, sortir une version et contribuer.
---

DevForge est open source, sous [licence MIT](https://github.com/victhille/devforge/blob/main/LICENSE). Il est écrit avec Electron, React 18, TypeScript et Tailwind CSS.

## Compiler

Il faut Node.js 22 et Windows.

```bash
git clone https://github.com/victhille/devforge.git
cd devforge
npm install
npm run dev        # l'app avec rechargement à chaud
npm run check      # types, lint, tests et build (comme la CI)
npm run test:e2e   # tests de bout en bout (Playwright, sur l'app compilée)
npm run dist       # installeur Windows dans dist/
```

Pour un fork, change `repository` et `build.publish` dans `package.json` : les mises à jour automatiques et les liens « À propos » suivent.

## Pour aller plus loin

| Document | Contenu |
|---|---|
| [Architecture](https://github.com/victhille/devforge/blob/main/docs/dev/architecture.md) | organisation du code, IPC, données, secrets, tests |
| [Versions](https://github.com/victhille/devforge/blob/main/docs/dev/versions.md) | numéros de version, messages de commit, sortir une release, mises à jour automatiques |
| [Contribuer](https://github.com/victhille/devforge/blob/main/CONTRIBUTING.md) | signaler un problème, proposer une modification, conventions |
| [Journal des versions](https://github.com/victhille/devforge/blob/main/CHANGELOG.md) | ce qui a changé à chaque version |

## Signaler un problème

Ouvre une [issue](https://github.com/victhille/devforge/issues) avec ce que tu faisais, ce qui s'est passé, ce que tu attendais, et le rapport de diagnostic (**Paramètres › À propos › Copier le rapport**). Une faille de sécurité se signale en privé : **Report a vulnerability** dans l'onglet *Security* du dépôt.

## Ce site

Ce site est dans le dossier [`site/`](https://github.com/victhille/devforge/tree/main/site) du dépôt, construit avec [Astro Starlight](https://starlight.astro.build) et publié par GitHub Pages. Le lien « Modifier la page », en bas de chaque page, ouvre sa source sur GitHub.
