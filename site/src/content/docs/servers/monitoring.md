---
title: Monitoring
description: Être prévenu quand un site ou une API tombe, et surveiller tes serveurs en arrière-plan.
---

La page **Monitoring** surveille tes sites et API, et l'état de tes serveurs.

## Les URLs

**Ajouter une URL** :

| Champ | Effet |
|---|---|
| URL | l'adresse à vérifier |
| Nom | facultatif, par défaut le domaine |
| Vérifier toutes les | 30 s, 1 min, 5 min, 15 min ou 1 h |
| Texte attendu | facultatif : la page doit le contenir pour être considérée en ligne |

DevForge vérifie chaque URL en arrière-plan et envoie une **notification Windows** quand l'une tombe ou revient. Chaque URL montre son état depuis quand, son historique sur 24 h et son temps de réponse. **Vérifier maintenant**, **Mettre en pause** / **Reprendre**, **Modifier**, **Supprimer**.

**Trouvées dans vos projets** propose des URLs repérées dans tes projets.

:::note
Les vérifications tournent tant que DevForge est ouvert ou réduit dans la barre système. Pour une surveillance 24 h/24, même PC éteint, installe la [page de statut](/devforge/online/status-page/) sur ton serveur.
:::

## Les serveurs

DevForge relève l'état de chaque serveur surveillé **toutes les minutes** (dans une session SSH dédiée) et garde **7 jours** d'historique : CPU, mémoire, disque, conteneurs en ligne, disponibilité sur 24 h.

**Surveiller ce serveur** l'active. Les alertes se règlent dans **Paramètres › Serveurs** :

- **Alerte disque à** 75, 80, 85, 90 ou 95 % ;
- **Me prévenir quand** : le disque se remplit, un conteneur s'arrête, un serveur ne répond plus, un site tombe.

Les alertes arrivent en notification Windows ; Forgy fait aussi la tête dans le widget de bureau. **Paramètres › Données › Effacer l'historique de surveillance** remet les courbes à zéro.
