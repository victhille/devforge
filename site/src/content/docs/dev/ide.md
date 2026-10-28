---
title: IDE
description: Les IDE que DevForge trouve sur ton PC, ceux que tu ajoutes à la main, et un IDE par projet.
---

Partout où un projet s'ouvre (cartes, fiche, palette de commandes, lanceur, tableau Git), le bouton porte le **nom de l'IDE** qui l'ouvrira.

## Les IDE trouvés

DevForge cherche ces IDE dans leurs dossiers d'installation habituels, puis dans le `PATH` :

| Famille | IDE |
|---|---|
| Éditeurs | VS Code, Cursor, Windsurf, Antigravity, Zed, Sublime Text, Notepad++ |
| JetBrains | PhpStorm, WebStorm, IntelliJ IDEA, PyCharm, Rider, GoLand, RustRover (installés à la main ou par la Toolbox) |
| Microsoft | Visual Studio |

Dans [Paramètres › Général](/devforge/settings/general/), **IDE par défaut** ne propose que ceux trouvés sur ce PC ; les autres apparaissent grisés sous « Pas trouvés sur ce PC ». **Aucun** retire les boutons d'IDE.

## Ajouter un IDE à la main

Un IDE absent de la liste (une version portable, un éditeur rare) : **IDE ajoutés à la main › Ajouter un IDE**.

| Champ | Contenu |
|---|---|
| Nom | le nom affiché sur les boutons |
| Programme | le fichier `.exe`, `.cmd` ou `.bat` (**Parcourir** ouvre l'explorateur) |
| Arguments | `{dir}` est remplacé par le dossier du projet ; `{dir}` seul par défaut, par exemple `--new-window "{dir}"` |

**Essayer** ouvre ton dossier de projets avec cet IDE avant de l'enregistrer. Une fois enregistré, il rejoint le choix de l'IDE par défaut et celui de chaque projet ; le crayon le modifie, la corbeille le retire. Un IDE dont le programme a disparu est marqué « introuvable ».

Le programme est lancé directement, sans passer par un shell ; un `.cmd` ou `.bat` en a besoin, alors son chemin et ses arguments ne peuvent pas contenir de caractères que `cmd.exe` interpréterait.

## Un IDE par projet

Sur la fiche d'un projet, tuile **Projet**, **IDE de ce projet** : *Par défaut* suit les Paramètres ; un autre IDE reste celui de ce projet, même si l'IDE par défaut change.

Dans un [groupe](/devforge/dev/projects/#les-projets-imbriqués-groupes), chaque projet a aussi le sien, choisi dans son panneau sur la fiche du groupe : PhpStorm pour le back, Cursor pour le front, par exemple. Sans choix, un sous-projet prend l'IDE du groupe.
