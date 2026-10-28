---
title: Activité
description: Les commits de tous tes projets sur 12 semaines, les plus actifs, ceux qui dorment et les branches à pousser.
---

La page **Activité** (menu Développement) montre ce que tu as fait sur tous tes projets. Tout est lu dans Git, sur ce PC : aucun service en ligne, rien n'est envoyé.

## Commits par semaine

Un graphe en barres des **12 dernières semaines** (une semaine commence le lundi). Les projets les plus actifs ont chacun leur couleur, les autres sont réunis en « autres ». Survole une barre pour voir le détail de la semaine, projet par projet.

Les commits de fusion (merge) ne sont pas comptés.

## Les filtres

- **Dossiers** : avec plusieurs [dossiers de projets](/devforge/dev/projects/), une pastille par dossier ne garde que ses projets.
- **Moi / Tout le monde** : par défaut, seuls tes commits comptent, reconnus à l'adresse de `git config --global user.email`. **Tout le monde** compte aussi ceux des autres.

## Les trois cartes

- **Les plus actifs ce mois-ci** : les projets avec le plus de commits ces 30 derniers jours, avec les lignes ajoutées et supprimées.
- **Ceux qui dorment** : aucun commit depuis 3 mois, avec la date du dernier. Un dossier qui n'est pas un dépôt Git n'y apparaît pas.
- **Branches à suivre** : les commits pas encore poussés (↑) ou à récupérer (↓), projet par projet. Un clic ouvre l'onglet Git du projet.

Un clic sur un projet ouvre sa [fiche](/devforge/dev/projects/).

## Rafraîchir

L'activité est lue à l'ouverture de la page, six projets à la fois, puis gardée 3 minutes. **Rafraîchir** la relit tout de suite (après un `git fetch`, par exemple).

## Sur l'accueil

Le widget **Commits** de l'[accueil](/devforge/getting-started/interface/) montre tes commits de la semaine, les 12 dernières semaines en petit et les branches à pousser. Ajoute-le avec **Personnaliser**.
