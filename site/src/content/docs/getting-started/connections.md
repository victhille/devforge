---
title: Connexions
description: Brancher GitHub, l'identité Git, la clé de Forgy, Vercel, Docker, des serveurs SSH et des bases de données dans Paramètres › Connexions.
---

**Paramètres › Connexions** réunit les services que DevForge utilise pour toi. Rien n'est configuré d'avance : chacun se branche ici, se **teste** et se **retire**. Une page qui a besoin d'un service absent (GitHub, Vercel, un serveur, la clé de Forgy) l'explique et propose un bouton pour le brancher.

Chaque service tient sur une ligne : son état (une pastille verte quand il est branché), puis de petites actions, **Tester**, **Modifier**, **Retirer**. Ce qui se tape (une clé, un jeton, ton nom) s'ouvre sous la ligne, seulement quand tu le demandes : **Ajouter une clé**, **Ajouter un jeton** ou **Modifier**. Le haut de la carte **Comptes** compte les services branchés.

:::note[Où vont les secrets]
Tout reste sur ce PC, dans le dossier de DevForge. Clés, jetons et mots de passe sont chiffrés par Windows et ne se réaffichent jamais. Retirer un service l'efface ; il faudra le reconfigurer pour s'en servir.
:::

## Comptes

### GitHub

Dépôts, Actions et releases. Trois façons de se connecter :

- **GitHub CLI** : lance une fois `gh auth login` dans un terminal. DevForge utilise cette connexion quand elle existe et affiche `GitHub CLI : ton-compte`.
- **Se connecter** : sans GitHub CLI, DevForge affiche un code (`WDJB-MJHT`). **Ouvrir GitHub** ouvre la page où le taper, puis tu acceptes l'accès de DevForge (dépôts, privés compris, et organisations). La ligne passe au vert toute seule, le jeton reçu est chiffré.
- **Jeton personnel** : sans GitHub CLI, **Ajouter un jeton**, puis colle un jeton GitHub. Droits utiles : *Actions* et *Contents* en lecture, *Actions* en écriture pour relancer les jobs en échec. Il est vérifié, puis chiffré.

Sans l'un ni l'autre, l'onglet GitHub des projets et la création de dépôt GitHub depuis [Nouveau projet](/devforge/dev/new-project/) restent indisponibles.

### Identité Git

Le **nom** et l'**e-mail** de tes commits, écrits dans `git config --global` ; la ligne les affiche, **Modifier** ouvre les deux champs. Un nom sur une ligne (100 caractères au plus) et un e-mail valide.

### Forgy (Anthropic)

La **clé API** qui fait parler [Forgy](/devforge/forgy/assistant/) : celle d'Anthropic par défaut, ou celle du [fournisseur choisi](/devforge/forgy/assistant/#fournisseurs) dans Paramètres › Forgy (la ligne porte son nom). La ligne dit si une clé est enregistrée ; elle se saisit, se teste (le test liste les modèles : il ne coûte rien), se remplace et se retire dans [Paramètres › Forgy](/devforge/forgy/assistant/#réglages), où mène **Réglages de Forgy**. Sans clé enregistrée, DevForge utilise la variable d'environnement `ANTHROPIC_API_KEY` si elle existe, et la ligne l'indique : « clé lue dans ANTHROPIC_API_KEY ». Une clé enregistrée passe avant la variable.

### Vercel

Déploiements, domaines et variables des projets liés à Vercel. **Se connecter** ouvre le navigateur sur Vercel : tu acceptes l'accès de DevForge, le navigateur revient sur ce PC (`127.0.0.1`) et la ligne affiche « connecté ». L'accès dure une heure et DevForge le renouvelle tout seul ; au bout de 30 jours sans servir, il faut se reconnecter. Sinon, crée un jeton sur *vercel.com › Account Settings › Tokens*, puis **Ajouter un jeton** et colle-le ; la ligne affiche alors « jeton enregistré » (le compte au survol). Voir [Déploiement](/devforge/online/deploy/#vercel).

### Docker

Le moteur Docker de ce PC (Docker Desktop) : conteneurs, Compose, bases des projets. Rien à saisir : la ligne indique « répond » (la version au survol). Tant qu'il ne répond pas, **Tester** vérifie de nouveau et **Installer Docker Desktop** ouvre la page de téléchargement.

## Serveurs MCP pour Forgy

Les serveurs MCP officiels des services que tu utilises deviennent des outils de [Forgy](/devforge/forgy/assistant/#serveurs-mcp). DevForge propose :

| Serveur | Connexion | Pour Forgy |
|---|---|---|
| Vercel | se connecter | projets, déploiements, journaux de build, domaines |
| Context7 | sans compte | la doc à jour des bibliothèques |
| Supabase | se connecter | tables, migrations, journaux, fonctions |
| Sentry | se connecter | les erreurs en production, avec leur trace |
| Linear | se connecter | tickets et cycles |
| Notion | se connecter | specs et notes de projet |
| Playwright | sur ce PC (`npx`) | piloter un navigateur sur ton projet lancé |

- **Se connecter** ouvre le navigateur sur la page du service : tu acceptes, le navigateur revient sur ce PC (`127.0.0.1`) et DevForge garde la connexion, chiffrée par Windows. Aucun jeton à copier.
- L'interrupteur dit si Forgy peut utiliser le serveur ; la ligne dit combien d'outils il a, et combien ne font que lire.
- **Ajouter** branche un serveur de la liste ; le filtre en haut montre tous les serveurs, ceux déjà branchés, ou ceux qui marchent sans compte.
- **Ajouter un serveur MCP** branche un serveur qui n'est pas dans la liste : son adresse (`https://…/mcp`), ou la commande qui le lance sur ce PC (`npx`, `uvx`…). Une commande est montrée avant d'être ajoutée : elle tourne avec tes droits. Pas de clé dans l'adresse : le serveur demande lui-même la connexion. Forgy demande ton accord avant chacun de ses outils.
- La corbeille retire le serveur et oublie sa connexion ; ton compte chez le service n'est pas touché.

## Serveurs (VPS)

Les connexions SSH servent au terminal, à la surveillance, à n8n, à la page de statut, aux sauvegardes et aux déploiements. **Ajouter un serveur**, en haut de la carte, ouvre le formulaire :

| Champ | Exemple |
|---|---|
| Nom | `mon-serveur` |
| Hôte / IP | `203.0.113.10` ou `vps.example.com` |
| Port | `22` |
| Nom d'utilisateur | `deploy` |
| Authentification | **Mot de passe** (stocké chiffré) ou **Clé privée** (chemin du fichier sur ce PC, par exemple `C:\Users\toi\.ssh\id_ed25519` ; une clé sur un partage réseau est refusée, car Windows y enverrait ton identifiant) |
| Couleur | pour reconnaître le serveur dans les listes |

Chaque serveur montre `utilisateur@hôte:port` et sa méthode (clé SSH ou mot de passe) ; **Modifier** rouvre le formulaire avec ses valeurs, la corbeille le retire.

La **clé du serveur** est mémorisée à la première connexion ; si elle change, DevForge refuse de se connecter. **Oublier la clé** la remet à zéro, après une confirmation dans une fenêtre de Windows (après une réinstallation du serveur, par exemple).

Ce que DevForge garde pour un serveur reste attaché à son hôte, son port et son utilisateur : son mot de passe, la clé API de n8n, l'accès au VPN et les mots de passe des bases qui passent par lui. Si l'un des trois change, ou si le serveur est retiré, DevForge les oublie : rien ne part vers une autre machine. En modification, le formulaire prévient qu'il faudra les saisir à nouveau. Une nouvelle adresse a aussi sa propre clé du serveur, mémorisée à sa première connexion.

:::tip
Préfère une clé SSH : la page [Santé](/devforge/servers/health/) ne propose de couper les mots de passe SSH que si DevForge se connecte déjà avec une clé.
:::

Sans serveur, les pages qui en ont besoin (Santé, Services, Sauvegardes, n8n, VPN, Page de statut) restent simplement de côté : le menu les masque et indique combien de pages s'ajoutent avec un serveur.

## Bases de données

Les connexions de la page [Base de données](/devforge/data/database/) : PostgreSQL, MySQL / MariaDB et SQLite, en direct ou à travers un serveur SSH. **Ajouter une base**, en haut de la carte, ouvre le même formulaire que sur cette page. Chaque base montre son type et son emplacement ; **Ouvrir** l'affiche sur la page Base de données, la corbeille la retire.

## n8n et alertes

Ces deux services tournent sur tes serveurs : DevForge garde la clé de n8n et lit les réglages de la page de statut par SSH.

- **n8n · mon-serveur** : une ligne par n8n installé depuis la page [n8n](/devforge/online/n8n/), pour sa **clé API n8n** (la ligne dit si elle est enregistrée ; **Ajouter une clé**, puis dans n8n : *Paramètres › API › Créer une clé*). **Tester** compte les workflows, **Ouvrir** mène à la page n8n. Sans n8n, la ligne renvoie à cette page pour l'installer.
- **Page de statut · mon-serveur** : une ligne par [page de statut](/devforge/online/status-page/) installée. **Lire les alertes** va voir sur le serveur si les alertes ntfy sont actives, et s'il y a aussi un webhook. Sans alerte ntfy, un formulaire règle le **serveur ntfy** (`https://ntfy.sh` par défaut) et le **sujet** : garde-le secret, qui le connaît reçoit les alertes. **Tester** envoie une vraie alerte de test ; **Retirer** coupe l'alerte ntfy sans toucher au reste de la page de statut.

## Tester et retirer

Les comptes, les serveurs, n8n et les pages de statut ont un bouton **Tester** : le résultat s'affiche en pastille, « Ça répond : … » en vert ou « Échec : … » en rouge avec la cause (jeton refusé, Docker ne répond pas, introuvable…). Un serveur pas encore testé l'indique. **Retirer**, en rouge (la corbeille pour un serveur ou une base), demande confirmation.

## Sur un autre PC

**Paramètres › Données › Exporter** enregistre ta configuration dans un fichier, **sans aucun secret**. Sur l'autre PC, **Importer…** la reprend ; il reste à ressaisir mots de passe, jetons et clés ici. Voir [Données](/devforge/settings/data/).
