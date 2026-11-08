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

En haut, trois compteurs : les URLs **surveillées**, leur **disponibilité** sur les dernières vérifications et les **incidents des 30 derniers jours**, avec leur durée totale. Un incident commence quand une URL ne répond plus et finit quand elle répond de nouveau.

DevForge vérifie chaque URL en arrière-plan et envoie une **notification Windows** quand l'une tombe ou revient. Le tableau montre pour chaque URL :

| Colonne | Contenu |
|---|---|
| Cible | le nom, et le texte attendu ou le domaine |
| État | *en ligne*, *hors ligne*, *en pause* ou *en attente*, et depuis quand |
| Réponse | le temps de réponse de la dernière vérification, ou son erreur |
| Dernières 24 h | une barre par heure : verte si tout a répondu, orange si une vérification a échoué, rouge si aucune n'a répondu |
| 30 jours | la disponibilité sur 30 jours, d'après la durée des incidents |

En bout de ligne : **Vérifier maintenant**, **Mettre en pause** / **Reprendre**, **Modifier**, **Supprimer** et **Détails**, qui déplie la disponibilité par demi-heure et le temps de réponse des 24 dernières heures.

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
