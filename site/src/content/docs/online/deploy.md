---
title: Déploiement
description: Déployer sur tes serveurs en SSH en un clic, et suivre tes projets Vercel.
---

## Sur un serveur, en SSH

La page **Déploiement** déploie sur tes serveurs en un clic. Une **cible** = un serveur, un dossier et un script.

:::note
Il faut d'abord un serveur SSH (voir [Connexions](/devforge/getting-started/connections/#serveurs-vps)).
:::

En haut, la carte du déploiement en cours, ou du dernier : la cible et son serveur, les **étapes** tirées de son script (**Envoi**, **Récupération**, **Installation**, **Build**, **Redémarrage**, **Vérification**…), chacune faite, en cours, en échec ou à venir, puis le journal. Un menu montre les déploiements précédents de la cible.

Dessous, le tableau des cibles : le serveur, la **méthode** (Node.js · PM2, Docker Compose, site statique, Symfony, Laravel ou script), le **dernier déploiement** (réussi ou échec, quand, combien de temps), puis **Journal**, **Déployer** et le menu **⋯** (**Modifier**, **Supprimer**).

### Créer une cible

**Nouvelle cible** :

| Champ | Effet |
|---|---|
| Nom | le nom de la cible |
| Serveur (SSH) | une connexion enregistrée |
| Dossier sur le serveur | le script s'exécute depuis ce dossier, dans un shell de connexion (nvm, pm2… disponibles) |
| Script | une commande par ligne ; s'arrête à la première erreur |
| Projet local | facultatif : relie la cible à un projet de DevForge |
| git push avant de déployer | pousse le projet local avant de lancer le script |

Les boutons sous le script remplissent un modèle : **Node.js · PM2**, **Docker Compose**, **site statique**, **Symfony**, **Laravel**. Exemple de script :

```bash
git pull --ff-only
npm ci
npm run build
pm2 restart mon-app
```

### Détecter sur un serveur

**Détecter sur un serveur** analyse, en lecture seule, `/var/www`, `/srv`, `/opt` et le dossier personnel : dépôts Git et applications PM2. Ils sont reliés à tes projets locaux par leur remote Git. **Créer la cible** en fait une cible.

### Déployer

**Déployer** lance le script : la carte du haut suit chaque étape et le journal en direct. Chaque déploiement est gardé dans l'historique de la cible, avec son journal (**Journal** sur sa ligne). Une notification dit s'il a réussi ou échoué.

Le déploiement d'un projet se retrouve aussi dans l'onglet **Déploiement** de sa [fiche](/devforge/dev/projects/), avec la [synchronisation du .env](/devforge/dev/projects/#synchroniser-le-env-avec-le-serveur).

## Vercel

Avec un jeton Vercel ([Connexions](/devforge/getting-started/connections/#vercel)), un projet dont le dossier est lié à Vercel (`vercel link`) a un onglet **Vercel** dans sa fiche :

- **Déploiements** de production et d'aperçu, leur état (prêt, build, erreur, en file…) et celui qui est *en production* ;
- **Redéployer** relance un build à partir d'un déploiement ;
- **Mettre en production** fait pointer la production vers un déploiement ; **Revenir à celui-ci** pour un retour en arrière ;
- **Logs de build** ;
- **Variables** : compare les **noms** des clés du `.env` local et de Vercel (*dans le fichier, pas sur Vercel* et l'inverse), sans lire aucune valeur ;
- **Domaines** : vérifié ou non, DNS à corriger, certificat, redirections ;
- **Ouvrir le site**, **Ouvrir sur Vercel**.

Forgy peut proposer de redéployer ou de mettre en production (actions à valider).
