---
template: splash
title: Feuille de route
description: Ce qui est prêt, les étapes jusqu'à la 1.0 et les idées à l'étude pour DevForge.
---

Ce qui arrive dans DevForge, du plus proche au plus lointain. Aucune date n'est promise : une version sort quand elle est prête. Ce qui est déjà sorti est dans les [Nouveautés](/devforge/news/).

Une idée, un besoin ? Propose-le dans les [discussions](https://github.com/victhille/devforge/discussions) ou en [issue](https://github.com/victhille/devforge/issues/new/choose).

## Prêt pour la prochaine version

Fait et en relecture, avant la première bêta de la 1.0 :

- **Accessibilité** : le contraste élevé de Windows est suivi, les champs de saisie sont plus lisibles, et la langue choisie est annoncée aux lecteurs d'écran.
- **Licences** : la licence de DevForge et celles de ses composants sont livrées dans l'installeur, et se lisent depuis **Paramètres › À propos**.
- **Vie privée** : les mises à jour automatiques peuvent se couper, le journal masque plus de secrets, et Forgy ne lit plus certains fichiers sensibles.
- **Sobriété** : les écrans qui interrogent le réseau (Docker, Vercel, VPS, GitHub…) s'arrêtent quand la fenêtre est réduite.
- **Publication** : l'installeur est construit sans droit d'écriture sur le dépôt, et sa provenance est attestée par GitHub.

## Vers la 1.0

1. Une **préversion 1.0.0-beta.1**, sur le canal **Bêta** (**Paramètres › Mises à jour**).
2. Des essais sur un Windows neuf : installation, mise à jour depuis la 0.2.1, désinstallation.
3. Si tout se passe bien, la **1.0.0**, une fois que la bêta a tourné une semaine sans bug bloquant, avec une vidéo et des captures à jour.
4. Ensuite, un essai pour **signer l'installeur**, pour que Windows SmartScreen ne s'en méfie plus.

## À l'étude

Rien de commencé, et l'ordre peut changer :

- une page **Vercel** à part entière : les projets, les déploiements et les domaines du compte connecté ;
- une page **Expo** : lancer un projet React Native, montrer le QR code à scanner avec Expo Go et suivre le serveur de développement.
