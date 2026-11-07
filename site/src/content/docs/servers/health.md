---
title: Santé du serveur
description: Mises à jour, espace disque, mémoire, ports ouverts, sécurité SSH et conteneurs de ton VPS, avec les corrections en un clic.
---

La page **Santé** fait le tour de ton serveur : mises à jour, espace, ports, SSH et conteneurs. Elle demande un serveur configuré (voir [Connexions](/devforge/getting-started/connections/#serveurs-vps)).

En haut, un résumé : **Tout va bien**, **À surveiller** ou **À corriger**, et l'heure de la vérification. **Actualiser** relance la lecture.

## Les vérifications

| Vérification | Ce qui est regardé |
|---|---|
| Mises à jour | paquets en attente, dont ceux de sécurité |
| Redémarrage | une mise à jour demande-t-elle de redémarrer ? |
| Disque | pourcentage utilisé et espace libre |
| Fichiers | inodes utilisés (beaucoup de petits fichiers) |
| Mémoire | mémoire disponible |
| Ports ouverts | seuls SSH et les ports attendus (web, WireGuard) devraient être ouverts sur Internet |
| Connexion root | root peut-il se connecter avec un mot de passe ? |
| Mots de passe SSH | connexion par clé uniquement, ou mots de passe acceptés |
| fail2ban | bloque-t-il les adresses qui insistent ? |
| Essais de connexion | essais refusés sur 24 h |
| Conteneurs | arrêtés sur une erreur, en boucle ou qui redémarrent souvent |
| Espace Docker | place récupérable (images inutilisées, cache) |

Une information illisible sur ce serveur s'affiche *Inconnu*.

## Les corrections

Certaines vérifications proposent une correction :

| Bouton | Effet |
|---|---|
| Installer les mises à jour | peut prendre plusieurs minutes ; les services redémarrés par les paquets sont brièvement coupés |
| Redémarrer le serveur | serveur injoignable une à deux minutes (VPN, n8n et sites coupés) |
| Nettoyer | libère l'espace Docker |
| Installer fail2ban | bloque les essais en série |
| Clé uniquement | refuse les connexions SSH par mot de passe |

Chaque correction montre la commande exacte avant de la lancer, avec **Lancer**, **Copier la commande** ou **Annuler**, puis un **Journal**.

:::caution
- **Clé uniquement** n'est proposé que si DevForge se connecte déjà avec une clé SSH : sinon, il se couperait lui-même l'accès.
- Si `sudo` demande un mot de passe sur ce serveur, DevForge ne lance rien : copie la commande et exécute-la toi-même dans un terminal SSH.
:::

## Ailleurs

- Le widget **Santé du VPS** de l'accueil et la carte Santé du [tableau de bord](/devforge/servers/ssh/#le-tableau-de-bord-du-serveur) résument cette page.
- Forgy peut lire la santé du serveur (« Point du matin sur le VPS »), voir [Forgy](/devforge/forgy/assistant/#tâches).
