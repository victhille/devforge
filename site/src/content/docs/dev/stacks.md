---
title: Lanceur de stack
description: Démarrer tout ton environnement de dev en un clic, front, API, Docker, VS Code et navigateur.
---

Le **Lanceur** (page *Lanceur de stack*) démarre tout ton environnement de dev en un clic. Une **stack** regroupe ce que tu lances chaque jour : le front, l'API, Docker, VS Code, le navigateur…

## Créer une stack

**Nouvelle stack** ouvre l'éditeur :

- **Nom** (par exemple `Mon SaaS (front + API)`) et **Couleur**.
- **Étapes**, dans l'ordre :
  - **Commande** : un libellé, la commande et son **dossier** ;
  - **VS Code** sur un dossier ;
  - **URL** à ouvrir dans le navigateur, avec un **délai avant ouverture** (en millisecondes) pour laisser démarrer le serveur.
- **+ Depuis un projet…** ajoute d'un coup le script `dev` du projet et VS Code.

## Démarrer et arrêter

- **Démarrer** lance toutes les étapes. Chaque commande affiche son état : *en cours*, *terminé*, *arrêté*, *échec*.
- **Tout arrêter** arrête les processus de la stack.
- **Modifier** rouvre l'éditeur ; supprimer une stack arrête ses processus.

Les stacks se démarrent aussi depuis la palette de commandes (<kbd>Ctrl</kbd> <kbd>K</kbd>).
