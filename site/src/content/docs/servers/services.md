---
title: Services web du serveur
description: Ouvrir les interfaces web des conteneurs de ton VPS (Portainer, Adminer, phpMyAdmin…) par un tunnel SSH.
---

La page **Services** liste les **interfaces web des conteneurs** de ton serveur : Portainer, Adminer, phpMyAdmin, ou toute application qui publie un port HTTP.

## Ouvrir un service

**Ouvrir** passe par un **tunnel dans la session SSH** : l'interface s'ouvre dans ton navigateur à une adresse locale (`Tunnel : http://127.0.0.1:…`), même si le port n'est pas ouvert sur Internet.

## Exposition

Chaque service indique comment il est publié :

- **Local au serveur** : publié sur `127.0.0.1` du serveur, joignable seulement par tunnel. C'est le réglage sûr.
- **Ouvert sur Internet** : publié sur toutes les adresses, n'importe qui peut l'atteindre. Si ce n'est pas voulu, publie-le sur `127.0.0.1` dans ton `compose.yaml` (par exemple `127.0.0.1:8080:80`).

Un service dont le conteneur est arrêté est marqué *arrêté*.

Les services s'ouvrent aussi depuis la palette de commandes (<kbd>Ctrl</kbd> <kbd>K</kbd>, « Ouvrir … ») et depuis le widget **Services du VPS** de l'accueil.
