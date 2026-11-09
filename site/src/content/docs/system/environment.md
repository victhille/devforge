---
title: Environnement
description: Les outils de dev installés sur ton PC, leurs versions, et la compatibilité avec ce que demandent tes projets.
---

La page **Environnement** détecte les outils de dev installés sur ce PC et leur version, en cartes par famille :

| Carte | Outils |
|---|---|
| JavaScript | Node.js, npm, pnpm, Yarn |
| PHP | PHP, Composer, Symfony CLI |
| Outils | Git, Docker |
| Autres langages | Python |

Un outil trouvé a une coche et sa version. Un outil absent est grisé, avec **Installer** : un lien vers sa page d'installation et, à côté, la commande à lancer quand il y en a une (par exemple `npm install -g pnpm`). Quand un de tes projets en a besoin, le bouton passe en couleur et dit lequel (« utilisé par boutique-en-ligne »).

Chaque carte dit combien de ses outils sont détectés (« 3 / 4 »).

La détection est gardée en mémoire (les outils changent rarement) ; **Actualiser** la relance.

## Versions requises par les projets

En dessous, DevForge compare les versions installées avec ce que demandent tes projets : pour Node.js, `.nvmrc`, `.node-version`, `volta` ou `engines` dans `package.json` ; pour PHP, `require.php` dans `composer.json`. Chaque contrainte est **Compatible**, **Mauvaise version**, **Non installé** ou **Contrainte inconnue** ; le titre résume « tout est compatible » ou le nombre de problèmes.

Les ateliers [Symfony et Laravel](/devforge/dev/projects/#les-ateliers-par-framework) renvoient ici quand PHP ou Symfony CLI manquent.
