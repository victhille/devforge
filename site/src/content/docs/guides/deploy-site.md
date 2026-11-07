---
title: Mettre un site en ligne sur ton serveur
description: Guide pas à pas, du serveur ajouté au premier déploiement en un clic, avec le .env et la surveillance du site.
---

Ton site tourne sur ton PC, tu veux le mettre sur ton serveur et le redéployer en un clic à chaque changement.

**Il faut** : un serveur Linux joignable en SSH, et le projet sur GitHub (ou un autre dépôt Git que le serveur peut cloner). Compter 15 minutes la première fois.

## 1. Ajoute ton serveur

**Paramètres › Connexions**, **Ajouter un serveur** : l'adresse (par exemple `203.0.113.10`), l'utilisateur et une clé SSH ou un mot de passe. **Tester** vérifie la connexion avant d'enregistrer. Voir [Connexions](/devforge/getting-started/connections/#serveurs-vps).

## 2. Prépare le dossier sur le serveur

La première fois, clone le projet sur le serveur depuis le terminal de la page [SSH](/devforge/servers/ssh/) :

```bash
cd /var/www
git clone https://github.com/toi/boutique-en-ligne.git boutique
```

## 3. Crée la cible

Page **Déploiement**, deux chemins :

- **Détecter sur un serveur** trouve, en lecture seule, les dépôts Git et les applications PM2 du serveur, et les relie à tes projets. **Créer la cible** en fait une cible toute prête.
- **Nouvelle cible** pour tout remplir : le serveur, le dossier (`/var/www/boutique`), le projet local et le script.

Le script s'exécute dans le dossier, une commande par ligne, et s'arrête à la première erreur :

```bash
git pull --ff-only
npm ci
npm run build
pm2 restart boutique
```

Coche **git push avant de déployer** : DevForge pousse ton travail avant de lancer le script.

## 4. Déploie

**Déployer** lance le script ; la sortie s'affiche en direct. Une notification Windows dit si c'est réussi. Chaque déploiement reste dans l'historique de la cible, avec son journal : utile quand le build casse.

## 5. Mets le .env à jour

Le `.env` n'est pas dans Git. Dans la fiche du projet, onglet **Déploiement**, **Synchroniser le .env** compare le fichier de ton PC et celui du serveur, clé par clé, sans jamais afficher les valeurs. Voir [Projets](/devforge/dev/projects/#synchroniser-le-env-avec-le-serveur).

## 6. Sois prévenu si le site tombe

Page **Monitoring**, **Ajouter une URL** avec l'adresse du site : une notification arrive quand il ne répond plus, puis quand il revient. Voir [Monitoring](/devforge/servers/monitoring/#les-urls).

## Pour aller plus loin

- [Déploiement](/devforge/online/deploy/) : toutes les options, et Vercel.
- [Santé du serveur](/devforge/servers/health/) : disque, mises à jour, sécurité.
- [Sauvegardes](/devforge/servers/backups/) : la base et les fichiers, chaque nuit.
