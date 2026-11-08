---
title: SSH et tableau de bord
description: Les connexions SSH, le terminal à onglets et le tableau de bord d'un serveur.
---

La page **SSH / VPS** réunit tes serveurs : un terminal SSH à onglets et, pour chaque serveur, un tableau de bord.

## Les connexions

La colonne de gauche liste les serveurs enregistrés (même liste que [Paramètres › Connexions](/devforge/getting-started/connections/#serveurs-vps)). **+** (ou **Ajouter un serveur**) ouvre le formulaire : nom, hôte ou IP, port, utilisateur, mot de passe ou clé privée, couleur.

Chaque serveur affiche son nom, `utilisateur@hôte` et une pastille : verte quand son terminal est ouvert, orange pendant la connexion, grise sans session. Au survol (ou au clavier), ses boutons :

| Bouton | Effet |
|---|---|
| clic sur le nom | ouvre un terminal SSH |
| Tableau de bord | ouvre le tableau de bord du serveur (aussi en haut du terminal de la session ouverte) |
| Bases de données du serveur | ouvre la page [Base de données](/devforge/data/database/#détecter-des-bases) et cherche les bases de ce serveur |
| Modifier la connexion | change ses réglages ; laisser le mot de passe vide le garde |
| Supprimer la connexion | retire le serveur |

**Masquer les serveurs** replie la colonne pour donner toute la place au terminal. En bas de la colonne, un rappel : les clés restent dans `~\.ssh` et les mots de passe sont chiffrés par Windows.

:::note[Clé du serveur]
DevForge mémorise l'empreinte de la clé du serveur à la première connexion, comme OpenSSH. Si elle change, la connexion est refusée. Après une réinstallation du serveur, **Oublier la clé** dans le formulaire la remet à zéro.
:::

## Le terminal

Sans session ouverte, la page t'invite à choisir une connexion à gauche. Une fois connecté, l'en-tête montre le serveur, son état (*connecté*, *Connexion en cours...*, *Déconnecté*), `utilisateur@hôte:port` et deux boutons :

- **Fichiers (SFTP)** parcourt les dossiers du serveur (en partant de ton dossier personnel, ou d'un chemin tapé) et **télécharge** un fichier à l'endroit que tu choisis sur ce PC. Tu vois ce que l'utilisateur SSH peut lire, comme dans le terminal ; rien n'est modifié sur le serveur.
- **Tableau de bord** ouvre le tableau de bord du serveur.

Le terminal tient dans une carte sombre. Les onglets apparaissent dès que tu ouvres un deuxième serveur ; chacun se ferme avec sa croix. Avec une seule session, **Fermer la session** est dans l'en-tête.

## Le tableau de bord du serveur

Une fois connecté, le tableau de bord se met à jour en continu. En haut, le nom du serveur avec **en ligne** et sa durée de marche, son adresse et son système, puis les boutons :

- **Terminal** ouvre la page SSH avec la session de ce serveur ;
- **Mettre à jour (n)**, quand des mises à jour attendent, ouvre la page [Santé](/devforge/servers/health/) de ce serveur.

Dessous :

- quatre cartes : **CPU** (avec la charge et les dernières mesures en barres), **Mémoire** (utilisée sur totale, et le swap), **Disque** (la partition `/` et l'espace libre), **Allumé depuis** et version du noyau ;
- **Conteneurs** : nom, image et depuis quand ils tournent, avec le nombre en ligne ;
- l'alerte **Santé** du serveur, avec ce qui demande ton attention et un lien vers la page [Santé](/devforge/servers/health/) ;
- **Raccourcis** vers les Services, Sauvegardes, le Déploiement et le VPN de ce serveur ;
- **Disques** : l'occupation de chaque partition ;
- **Processus (top CPU)**.

## Les pages serveur

Une fois un serveur ajouté, ces pages apparaissent dans le menu. Quand tu en as plusieurs, chacune a un sélecteur **Serveur** dans son en-tête :

- [Santé](/devforge/servers/health/) : mises à jour, disque, ports, SSH, conteneurs ;
- [Services](/devforge/servers/services/) : les interfaces web des conteneurs ;
- [Sauvegardes](/devforge/servers/backups/) : sauvegardes de nuit et restauration ;
- [n8n](/devforge/online/n8n/), [VPN](/devforge/online/vpn/), [Page de statut](/devforge/online/status-page/).

La surveillance en arrière-plan (alertes disque, conteneur, serveur injoignable) se règle dans [Monitoring](/devforge/servers/monitoring/#les-serveurs).
