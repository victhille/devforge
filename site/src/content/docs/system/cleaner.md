---
title: Nettoyage disque
description: Libérer de la place en supprimant les dossiers que tes outils savent regénérer (node_modules, vendor, builds, caches).
---

La page **Nettoyage disque** libère de la place en supprimant les dossiers que tes outils savent regénérer.

## Analyser

Choisis un dossier (le champ en haut à droite, ou l'icône de dossier pour le parcourir) et **Analyser**. DevForge liste avec leur taille :

| Catégorie | Exemples |
|---|---|
| Dépendances | `node_modules`, `vendor` (à côté d'un `composer.json`), `target` (à côté d'un `Cargo.toml`), `.venv`, `venv` |
| Builds | `dist` et `build` (à côté d'un `package.json`), `.next`, `.nuxt`, `.output`, `.svelte-kit` |
| Caches | `.turbo`, `.parcel-cache`, `.cache`, `coverage`, `__pycache__` |

Une carte donne le total **récupérable**, une barre qui le répartit entre dépendances, caches et builds, et le bouton **Supprimer la sélection** avec sa taille. Le tableau donne pour chaque dossier sa catégorie (sa couleur), le projet, la **dernière activité** du projet et la taille. Les projets sans activité depuis plus de 30 jours sont marqués *inactif*.

## Choisir

- Coche les dossiers un à un, ou **Tout sélectionner**.
- **Projets inactifs depuis 30 j** ne coche que les dossiers des projets inactifs.
- **Vider** décoche tout. Les filtres **Tout**, **Dépendances**, **Builds**, **Caches** restreignent la liste.

## Supprimer

**Supprimer la sélection** demande confirmation : les dossiers sont **supprimés définitivement** (pas de corbeille). Ils se regénèrent avec `npm install`, `composer install`, `cargo build`… À la fin, DevForge affiche la place libérée.
