---
title: Services web du serveur
description: Ouvrir les interfaces web des conteneurs de ton VPS (Portainer, Adminer, phpMyAdmin…) par un tunnel SSH.
---

La page **Services** liste les **interfaces web des conteneurs** de ton serveur : Portainer, Adminer, phpMyAdmin, ou toute application qui publie un port HTTP. Chaque carte montre le service, son port, à quoi il sert (ou son image Docker pour un service inconnu) et l'état de son tunnel : **tunnel ouvert**, **fermé** ou **arrêté**. **Actualiser** relit les conteneurs.

## Ouvrir un service

**Ouvrir** passe par un **tunnel dans la session SSH** : l'interface s'ouvre dans ton navigateur à une adresse locale, même si le port n'est pas ouvert sur Internet. Une fois le tunnel ouvert, la carte montre le port local (`:9000 → localhost:…`).

Le service **wg-easy** (le VPN) a aussi **Gérer dans DevForge**, qui ouvre la page [VPN](/devforge/online/vpn/).

## Exposition

Un service publié sur `127.0.0.1` du serveur n'est joignable que par tunnel : c'est le réglage sûr, et la carte n'affiche rien de plus.

Un service publié sur toutes les adresses porte le badge **Ouvert sur Internet** : n'importe qui peut l'atteindre. Si ce n'est pas voulu, publie-le sur `127.0.0.1` dans ton `compose.yaml` (par exemple `127.0.0.1:8080:80`).

Un service dont le conteneur est arrêté est marqué *arrêté* et ne s'ouvre pas.

Les services s'ouvrent aussi depuis la palette de commandes (<kbd>Ctrl</kbd> <kbd>K</kbd>, « Ouvrir … ») et depuis le widget **Services du VPS** de l'accueil.
