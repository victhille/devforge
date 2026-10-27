---
title: n8n
description: Installer n8n sur ton VPS, le tenir à jour, et suivre tes workflows et leurs exécutions depuis DevForge.
---

La page **n8n** installe et gère [n8n](https://n8n.io), l'outil d'automatisation, sur ton serveur.

## Installer

DevForge vérifie d'abord le serveur : Docker et Docker Compose v2 sont nécessaires. Tout est écrit dans `~/devforge/n8n` sur le serveur : un Compose avec n8n et PostgreSQL, et un `.env` créé sur place. Rien d'autre n'est touché.

Choisis l'**accès** :

| Accès | Fonctionnement |
|---|---|
| HTTPS sur un sous-domaine | Caddy obtient le certificat. Le sous-domaine (par exemple `n8n.example.com`) doit déjà pointer vers le serveur ; DevForge vérifie le DNS. Il faut aussi un e-mail pour le certificat |
| Seulement sur le serveur | n8n écoute sur `127.0.0.1:5678` ; **Ouvrir n8n** passe par un tunnel dans la session SSH de DevForge |

Pas de domaine ? DevForge propose une adresse gratuite en `sslip.io` qui pointe vers l'IP du serveur. Si les ports 80 et 443 sont déjà pris (un autre serveur web), choisis « Seulement sur le serveur » ou libère-les.

Une installation déjà présente dans `~/devforge/n8n` peut être relancée : ses données sont gardées.

## Gérer

- État : *en marche*, *arrêté*, *pas lancé*.
- **Ouvrir n8n**, **Démarrer**, **Arrêter**, **Redémarrer**, **Logs**.
- **Mettre à jour** : sauvegarde la base de n8n, puis passe à la dernière image.
- **Interface en français** : active la traduction communautaire de n8n. La base est sauvegardée puis n8n redémarre ; les textes ajoutés par une nouvelle version de n8n restent en anglais en attendant leur traduction.
- **Oublier ce serveur** : retire n8n de DevForge sans rien supprimer sur le serveur.

## Workflows et exécutions

Avec une **clé d'API n8n** (dans n8n : *Paramètres › API › Créer une clé*), chiffrée par Windows :

- **Workflows** : la liste, avec leur date de modification et **Exporter dans un projet** (un fichier JSON dans un de tes projets) ;
- **Exécutions** : réussie, échec, plantée, en cours…, avec le filtre **Échecs seulement**.

Forgy peut activer ou désactiver un workflow et relancer une exécution en échec (actions à valider). La palette de commandes ouvre et redémarre n8n.
