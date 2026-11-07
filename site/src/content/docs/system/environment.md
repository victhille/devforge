---
title: Environnement
description: Les outils de dev installés sur ton PC, leurs versions, et la compatibilité avec ce que demandent tes projets.
---

La page **Environnement** détecte les outils de dev installés sur ce PC et leur version.

| Catégorie | Outils |
|---|---|
| JavaScript | Node.js, npm, pnpm, Yarn |
| Contrôle de version | Git |
| PHP | PHP, Composer, Symfony CLI |
| Infrastructure | Docker, Python |

Un outil absent est marqué *Non détecté*, avec **Installer…** : un lien vers sa page d'installation et, quand il y en a une, la commande à lancer (par exemple `npm install -g pnpm`).

La détection est gardée en mémoire (les outils changent rarement) ; **Actualiser** la relance.

## Versions requises par les projets

En dessous, DevForge compare les versions installées avec ce que demandent tes projets : pour Node.js, `.nvmrc`, `.node-version`, `volta` ou `engines` dans `package.json` ; pour PHP, `require.php` dans `composer.json`. Chaque contrainte est **Compatible**, **Mauvaise version**, **Non installé** ou **Contrainte inconnue** ; le titre résume « tout est compatible » ou le nombre de problèmes.

Les ateliers [Symfony et Laravel](/devforge/dev/projects/#les-ateliers-par-framework) renvoient ici quand PHP ou Symfony CLI manquent.
