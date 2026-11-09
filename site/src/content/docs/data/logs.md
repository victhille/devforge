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

Chaque ligne montre son heure, son niveau (**ERROR**, **WARNING**, **INFO**, **DEBUG**) et son message.

- En haut, le fichier suivi : le menu passe d'un fichier ouvert à l'autre, ou en ouvre un autre.
- **Pause** / **Suivre** : fige l'affichage ou reprend le suivi.
- **Filtrer les lignes…** : n'affiche que les lignes qui contiennent le texte.
- **Tout**, **Erreurs**, **Avertissements**, **Infos** : un niveau à la fois ; les erreurs et les avertissements donnent leur nombre.
- À droite, le projet, le nombre de lignes et l'état du suivi.
- Le menu **⋯** : **Retour à la ligne** ou non, **Vider l'affichage**, **Fermer ce fichier**.

## Forgy explique la ligne

Un clic sur une erreur ou un avertissement ouvre à côté la carte **Forgy explique la ligne** : **Expliquer cette ligne** envoie à Forgy la ligne et celles qui l'entourent, pour savoir d'où vient le problème et comment le corriger. **Ouvrir le fichier** l'ouvre dans ton éditeur.

## Ailleurs

- L'onglet **Logs** de chaque [fiche projet](/devforge/dev/projects/) suit les logs de ce projet.
- Les logs des conteneurs sont sur la page [Docker](/devforge/dev/docker/#journaux).
- Sur cette page, Forgy reçoit les 150 dernières lignes affichées pour expliquer une erreur.
