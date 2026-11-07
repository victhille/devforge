---
title: Git
description: Le tableau de bord Git de tous tes projets, le commit guidé et GitHub.
---

La page **Git** est le tableau de bord de tous les dépôts de tes projets, en un coup d'œil.

## Le tableau de bord

![Le tableau de bord Git](../../../assets/screens/git-fr.png)

En haut, quatre compteurs : **Dépôts**, **Avec modifications**, **À pousser**, **À récupérer**. Le filtre **À traiter** ne garde que les dépôts qui demandent quelque chose ; **Tous** les montre tous. Quand rien n'est à faire : « Tout est propre ».

Pour chaque dépôt : la branche, le nombre de fichiers modifiés, les commits d'avance ou de retard, et les cas particuliers (*pas d'upstream*, *pas de remote*). Boutons **Fetch**, **Pull**, **Push** et **Commit**. **Tout fetch** met tous les dépôts à jour du remote.

## Faire un commit

**Commit** ouvre une fenêtre :

- coche les fichiers à inclure (**Tous** pour tout prendre) ;
- écris le message au format [Conventional Commits](https://www.conventionalcommits.org) : type, description courte, détails facultatifs ;
- **Suggérer** propose un type (`feat`, `fix`, `docs`, `test`, `ci`…), une portée et une description d'après les fichiers modifiés, sans appel à l'IA ;
- **Commit** ou **Commit & push**.

Si le push échoue après le commit, le commit reste et DevForge te le dit.

## GitHub

Avec GitHub connecté ([Connexions](/devforge/getting-started/connections/#github)), l'onglet **GitHub** de chaque [fiche projet](/devforge/dev/projects/) montre :

- **GitHub Actions** : les dernières exécutions (réussi, échec, en cours…), **Relancer les échecs**, **Ouvrir sur GitHub** ;
- **Pull requests ouvertes**, brouillons compris ;
- **Versions** publiées et préversions.

Un dépôt privé auquel le jeton n'a pas accès apparaît comme introuvable.

## Avec Forgy

Forgy lit l'état et le diff de tes dépôts. Il peut proposer un commit, un pull ou un push, que tu valides ; il ne pousse jamais en force. Voir [Actions de Forgy](/devforge/forgy/actions/).
