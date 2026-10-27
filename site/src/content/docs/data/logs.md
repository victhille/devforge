---
title: Logs
description: Suivre un fichier de log en direct, coloré par niveau et filtrable.
---

La page **Logs** suit un fichier de log **en direct**, comme `tail -f`.

## Ouvrir un fichier

- **Ouvrir un fichier de log** choisit n'importe quel fichier.
- **Fichiers de log trouvés dans vos projets** propose ceux de tes projets : `storage/logs` (Laravel), `var/log` (Symfony), `logs`…

Formats reconnus : Laravel, Symfony, nginx, pm2, et les logs JSON (pino, winston). Les lignes sont **colorées par niveau** (erreur, avertissement, info, debug).

## Lire

- **Filtrer les lignes…** : n'affiche que les lignes qui contiennent le texte.
- **Pause** / **Suivre** : fige l'affichage ou reprend le suivi.
- **Retour à la ligne** ou non.
- **Vider l'affichage**.

## Ailleurs

- L'onglet **Logs** de chaque [fiche projet](/devforge/dev/projects/) suit les logs de ce projet.
- Les logs des conteneurs sont sur la page [Docker](/devforge/dev/docker/#logs).
- Sur cette page, Forgy reçoit les 150 dernières lignes affichées pour expliquer une erreur.
