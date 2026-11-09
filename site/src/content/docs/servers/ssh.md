---
title: SSH et tableau de bord
description: Les connexions SSH, le terminal à onglets et le tableau de bord d'un serveur.
---

La page **SSH / VPS** réunit tes serveurs : un terminal SSH à onglets et, pour chaque serveur, un tableau de bord.

## Les connexions

La colonne de gauche liste les serveurs enregistrés (même liste que [Paramètres › Connexions](/devforge/getting-started/connections/#serveurs-vps)). **+** (ou **Ajouter un serveur**) ouvre le formulaire : nom, hôte ou IP, port, utilisateur, mot de passe ou clé privée, couleur.

Sur chaque serveur :

| Bouton | Effet |
|---|---|
| clic sur le nom | ouvre un terminal SSH dans un nouvel onglet |
| Tableau de bord | ouvre le tableau de bord du serveur (aussi en haut du terminal de la session ouverte) |
| Bases de données du serveur | ouvre la page [Base de données](/devforge/data/database/#détecter-des-bases) et cherche les bases de ce serveur |
| Modifier la connexion | change ses réglages ; laisser le mot de passe vide le garde, sauf si l'hôte, le port ou l'utilisateur change : il faut alors le saisir à nouveau |
| Supprimer la connexion | retire le serveur |

**Masquer les serveurs** replie la colonne pour donner toute la place au terminal.

:::note[Clé du serveur]
DevForge mémorise l'empreinte de la clé du serveur à la première connexion, comme OpenSSH. Si elle change, la connexion est refusée. Après une réinstallation du serveur, **Oublier la clé** dans le formulaire la remet à zéro.
:::

## Le terminal

Chaque connexion ouverte est un onglet ; on peut en ouvrir plusieurs et les fermer une à une. Au-dessus, le serveur de l'onglet affiché, son état (*connecté*, *Connexion en cours…*, *Déconnecté*) et deux boutons :

- **Fichiers (SFTP)** parcourt les dossiers du serveur (en partant de ton dossier personnel, ou d'un chemin tapé) et **télécharge** un fichier à l'endroit que tu choisis sur ce PC. Tu vois ce que l'utilisateur SSH peut lire, comme dans le terminal ; rien n'est modifié sur le serveur.
- **Tableau de bord** ouvre le tableau de bord du serveur.

## Le tableau de bord du serveur

Une fois connecté, le tableau de bord se met à jour en continu :

- **CPU** (avec la charge et une courbe), **Mémoire** (utilisée, totale, disponible), **Swap** s'il y en a, **Allumé depuis** et version du noyau ;
- la carte **Santé** du serveur (voir [Santé](/devforge/servers/health/)) ;
- **Disques** : l'occupation de chaque partition ;
- **Processus (top CPU)** ;
- **Docker** : les conteneurs du serveur.

## Les pages serveur

Une fois un serveur ajouté, ces pages apparaissent dans le menu. Chacune a un sélecteur **Serveur** quand tu en as plusieurs :

- [Santé](/devforge/servers/health/) : mises à jour, disque, ports, SSH, conteneurs ;
- [Services](/devforge/servers/services/) : les interfaces web des conteneurs ;
- [Sauvegardes](/devforge/servers/backups/) : sauvegardes de nuit et restauration ;
- [n8n](/devforge/online/n8n/), [VPN](/devforge/online/vpn/), [Page de statut](/devforge/online/status-page/).

La surveillance en arrière-plan (alertes disque, conteneur, serveur injoignable) se règle dans [Monitoring](/devforge/servers/monitoring/#les-serveurs).
