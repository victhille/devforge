---
title: Modélisation
description: Concevoir sa base et son appli avant de coder — un MCD (Merise) dessiné dans DevForge, enregistré dans le projet et versionné avec Git.
---

La page **Modélisation** (menu *Données & API*) sert à concevoir avant de coder. Les modèles sont rangés **par projet** : ce sont des fichiers du dossier `conception/` du projet (`boutique.mcd.json`…), donc versionnés avec Git comme le reste du code.

## La page

- **Le sélecteur de projet**, en haut à droite : le projet actif par défaut.
- **La chaîne du projet** : MCD → MLD → MPD → SQL → base liée, avec l'état de chacun. Le MCD est là ; les étapes suivantes arrivent avec les prochaines versions.
- **Les modèles du projet** : un aperçu, le type, la date, le fichier. Un clic ouvre le modèle ; renommer et supprimer au survol.
- **Créer un modèle** : un **MCD** pour l'instant (les diagrammes UML et le reste suivent).

## L'éditeur MCD

Un MCD décrit les données à la manière de Merise : des **entités** (CLIENT, COMMANDE…) avec leurs attributs, des **associations** entre elles (PASSER, CONTENIR…) et la **cardinalité** de chaque entité dans chaque association.

| Action | Comment |
|---|---|
| Ajouter une entité | **Entité** dans la palette, ou double-clic sur le fond |
| Ajouter une association | **Association** dans la palette |
| Relier | **Lien**, puis une entité et une association (Échap pour arrêter) |
| Changer une cardinalité | un clic dessus : 0,1 → 1,1 → 0,n → 1,n |
| Déplacer | glisser un élément ; glisser le fond déplace la vue |
| Zoomer | la molette, ou − / + ; **Ajuster** montre tout |
| Supprimer | **Suppr** sur l'élément choisi |
| Annuler, rétablir | **Ctrl+Z**, **Ctrl+Y** |

Le panneau de droite modifie l'élément choisi : le nom, les **attributs** (nom, type, longueur d'un texte court) et ceux qui forment l'**identifiant** (soulignés). Une association peut porter des attributs (une quantité, une date…).

Chaque changement est **enregistré tout seul** dans le fichier du projet.

### Vérifier

**Vérifier** liste ce qui bloquerait la suite (le MLD) ou mérite un coup d'œil : une entité sans identifiant, un élément sans nom, deux éléments du même nom, un attribut sans type, une association reliée à moins de deux entités, une entité reliée à rien. Un clic sur une ligne choisit l'élément.

### Exporter

**PNG** ou **SVG** enregistre le MCD en image.
