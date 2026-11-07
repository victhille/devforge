---
title: Sauvegardes du serveur
description: Des sauvegardes de nuit faites par le serveur lui-même, une copie sur ton PC et la restauration en un clic.
---

La page **Sauvegardes** met en place des **sauvegardes de nuit faites par le serveur lui-même**, même PC éteint, avec une copie sur ce PC.

## Activer

DevForge cherche ce qu'il y a à sauvegarder :

- **Bases de données** : les bases PostgreSQL et MariaDB des conteneurs. Elles sont exportées avec les identifiants de leurs conteneurs : **aucun mot de passe ne sort du serveur**.
- **Volumes et dossiers** : les volumes Docker et dossiers de données, avec les conteneurs qui les utilisent. Un volume de base déjà couvert par son export est signalé.

Puis règle :

| Réglage | Effet |
|---|---|
| Heure | l'heure de la sauvegarde, à l'heure du serveur |
| Jours gardés | nombre de sauvegardes quotidiennes conservées |
| Semaines gardées | nombre de sauvegardes hebdomadaires conservées |
| Copie sur ce PC | un dossier local où DevForge copie la dernière sauvegarde quand il tourne (facultatif) |

**Activer les sauvegardes** installe la tâche de nuit (cron) sur le serveur.

## Suivre

- **Dernière sauvegarde** : réussie (date et taille) ou en échec. Après plus de 36 h sans sauvegarde, DevForge prévient : vérifie que le serveur tourne et que cron est actif.
- Si la tâche de nuit a disparu du serveur, **Enregistrer** la remet.
- **Sauvegarder maintenant** lance une sauvegarde tout de suite.
- **Copier sur ce PC** rapatrie la dernière sauvegarde ; **Ouvrir le dossier** l'affiche.
- **Fichiers sur le serveur** liste les sauvegardes (*jour* ou *semaine*).
- **Journal** montre le détail de chaque opération.

## Restaurer

**Restaurer** remet une base ou un volume dans l'état d'un jour donné. Avant, une copie de l'état actuel est faite dans `pre-restore/` ; les conteneurs qui utilisent ces données sont arrêtés pendant la restauration, puis redémarrés.

## Désactiver

**Désactiver** arrête les sauvegardes de nuit. Les fichiers déjà faits restent sur le serveur.

Les sauvegardes se lancent aussi depuis la palette (<kbd>Ctrl</kbd> <kbd>K</kbd>) et Forgy peut proposer d'en lancer une (action à valider).
