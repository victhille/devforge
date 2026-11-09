---
title: Connexions
description: Brancher GitHub, l'identité Git, la clé de Forgy, Vercel, Docker, des serveurs SSH et des bases de données dans Paramètres › Connexions.
---

**Paramètres › Connexions** réunit les services que DevForge utilise pour toi. Rien n'est configuré d'avance : chacun se branche ici, se **teste** et se **retire**. Une page qui a besoin d'un service absent (GitHub, Vercel, un serveur, la clé de Forgy) l'explique et propose un bouton pour le brancher.

Chaque service tient sur une ligne : son état (une pastille verte quand il est branché), puis de petites actions, **Tester**, **Modifier**, **Retirer**. Ce qui se tape (une clé, un jeton, ton nom) s'ouvre sous la ligne, seulement quand tu le demandes : **Ajouter une clé**, **Ajouter un jeton** ou **Modifier**. Le haut de la carte **Comptes et clés** compte les services branchés.

:::note[Où vont les secrets]
Tout reste sur ce PC, dans le dossier de DevForge. Clés, jetons et mots de passe sont chiffrés par Windows et ne se réaffichent jamais. Retirer un service l'efface ; il faudra le reconfigurer pour s'en servir.
:::

## Comptes et clés

### GitHub

Dépôts, Actions et releases. Deux façons de se connecter :

- **GitHub CLI** : lance une fois `gh auth login` dans un terminal. DevForge utilise cette connexion quand elle existe et affiche `GitHub CLI : ton-compte`.
- **Jeton personnel** : **Ajouter un jeton**, puis colle un jeton GitHub. Droits utiles : *Actions* et *Contents* en lecture, *Actions* en écriture pour relancer les jobs en échec. Il est vérifié, puis chiffré.

Sans l'un ni l'autre, l'onglet GitHub des projets et la création de dépôt GitHub depuis [Nouveau projet](/devforge/dev/new-project/) restent indisponibles.

### Identité Git

Le **nom** et l'**e-mail** de tes commits, écrits dans `git config --global` ; la ligne les affiche, **Modifier** ouvre les deux champs. Un nom sur une ligne (100 caractères au plus) et un e-mail valide.

### Forgy (Anthropic)

La **clé API** qui fait parler [Forgy](/devforge/forgy/assistant/) : celle d'Anthropic par défaut, ou celle du [fournisseur choisi](/devforge/forgy/assistant/#fournisseurs) dans Paramètres › Forgy (la ligne porte son nom). **Ajouter une clé** ouvre le champ ; le bouton **Tester** liste les modèles disponibles : il ne coûte rien. **Réglages de Forgy** mène à Paramètres › Forgy. Sans clé enregistrée, DevForge utilise la variable d'environnement `ANTHROPIC_API_KEY` si elle existe, et la ligne l'indique : « clé lue dans ANTHROPIC_API_KEY ». Une clé enregistrée ici passe avant la variable.

### Vercel

Déploiements, domaines et variables des projets liés à Vercel. Crée un jeton sur *vercel.com › Account Settings › Tokens*, puis **Ajouter un jeton** et colle-le. Voir [Déploiement](/devforge/online/deploy/#vercel).

### Docker

Le moteur Docker de ce PC (Docker Desktop) : conteneurs, Compose, bases des projets. Rien à saisir : la ligne indique si Docker répond. S'il n'est pas installé, **Installer Docker Desktop** ouvre la page de téléchargement.

## Serveurs (VPS)

Les connexions SSH servent au terminal, à la surveillance, à n8n, à la page de statut, aux sauvegardes et aux déploiements. **Ajouter un serveur**, en haut de la carte, ouvre le formulaire :

| Champ | Exemple |
|---|---|
| Nom | `mon-serveur` |
| Hôte / IP | `203.0.113.10` ou `vps.example.com` |
| Port | `22` |
| Nom d'utilisateur | `deploy` |
| Authentification | **Mot de passe** (stocké chiffré) ou **Clé privée** (chemin du fichier, par exemple `C:\Users\toi\.ssh\id_ed25519`) |
| Couleur | pour reconnaître le serveur dans les listes |

Chaque serveur montre `utilisateur@hôte:port` et sa méthode (clé SSH ou mot de passe) ; **Modifier** rouvre le formulaire avec ses valeurs, la corbeille le retire.

La **clé du serveur** est mémorisée à la première connexion ; si elle change, DevForge refuse de se connecter. **Oublier la clé** la remet à zéro (après une réinstallation du serveur, par exemple).

:::tip
Préfère une clé SSH : la page [Santé](/devforge/servers/health/) ne propose de couper les mots de passe SSH que si DevForge se connecte déjà avec une clé.
:::

Sans serveur, les pages qui en ont besoin (Santé, Services, Sauvegardes, n8n, VPN, Page de statut) restent simplement de côté : le menu les masque et indique combien de pages s'ajoutent avec un serveur.

## Bases de données

Les connexions de la page [Base de données](/devforge/data/database/) : PostgreSQL, MySQL / MariaDB et SQLite, en direct ou à travers un serveur SSH. **Ajouter une base**, en haut de la carte, ouvre le même formulaire que sur cette page ; **Ouvrir** affiche la base sur la page Base de données.

## n8n et alertes

Ces deux services tournent sur tes serveurs : DevForge garde la clé de n8n et lit les réglages de la page de statut par SSH.

- **n8n · mon-serveur** : une ligne par n8n installé depuis la page [n8n](/devforge/online/n8n/), pour sa **clé API n8n** (**Ajouter une clé** ; dans n8n : *Paramètres › API › Créer une clé*). **Tester** compte les workflows, **Ouvrir** mène à la page n8n. Sans n8n, la ligne renvoie à cette page pour l'installer.
- **Page de statut · mon-serveur** : une ligne par [page de statut](/devforge/online/status-page/) installée. **Lire les alertes** va voir sur le serveur si les alertes ntfy sont actives, et s'il y a aussi un webhook. Sans alerte ntfy, un formulaire règle le **serveur ntfy** (`https://ntfy.sh` par défaut) et le **sujet** : garde-le secret, qui le connaît reçoit les alertes. **Tester** envoie une vraie alerte de test ; **Retirer** coupe l'alerte ntfy sans toucher au reste de la page de statut.

## Tester et retirer

Chaque ligne a un bouton **Tester** : le résultat s'affiche en pastille, « Ça répond : … » en vert ou « Échec : … » en rouge avec la cause (jeton refusé, Docker ne répond pas, introuvable…). Un serveur pas encore testé l'indique. **Retirer** (la corbeille pour un serveur ou une base) demande confirmation.

## Sur un autre PC

**Paramètres › Données › Exporter** enregistre ta configuration dans un fichier, **sans aucun secret**. Sur l'autre PC, **Importer…** la reprend ; il reste à ressaisir mots de passe, jetons et clés ici. Voir [Données](/devforge/settings/data/).
