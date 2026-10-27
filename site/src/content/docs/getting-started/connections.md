---
title: Connexions
description: Brancher GitHub, l'identité Git, la clé de Forgy, Vercel, Docker, des serveurs SSH et des bases de données dans Paramètres › Connexions.
---

**Paramètres › Connexions** réunit les services que DevForge utilise pour toi. Rien n'est configuré d'avance : chacun se branche ici, se **teste** et se **retire**. Une page qui a besoin d'un service absent (GitHub, Vercel, un serveur, la clé de Forgy) l'explique et propose un bouton pour le brancher.

:::note[Où vont les secrets]
Tout reste sur ce PC, dans le dossier de DevForge. Clés, jetons et mots de passe sont chiffrés par Windows et ne se réaffichent jamais. Retirer un service l'efface ; il faudra le reconfigurer pour s'en servir.
:::

## Comptes et clés

### GitHub

Dépôts, Actions et releases. Deux façons de se connecter :

- **GitHub CLI** : lance une fois `gh auth login` dans un terminal. DevForge utilise cette connexion quand elle existe et affiche `GitHub CLI : ton-compte`.
- **Jeton personnel** : colle un jeton GitHub. Droits utiles : *Actions* et *Contents* en lecture, *Actions* en écriture pour relancer les jobs en échec. Il est vérifié, puis chiffré.

Sans l'un ni l'autre, l'onglet GitHub des projets et la création de dépôt GitHub depuis [Nouveau projet](/devforge/dev/new-project/) restent indisponibles.

### Identité Git

Le **nom** et l'**e-mail** de tes commits, écrits dans `git config --global`. Un nom sur une ligne (100 caractères au plus) et un e-mail valide.

### Forgy (Anthropic)

La **clé API Anthropic** qui fait parler [Forgy](/devforge/forgy/assistant/). Le bouton **Tester** liste les modèles disponibles : il ne coûte rien. Sans clé enregistrée, DevForge utilise la variable d'environnement `ANTHROPIC_API_KEY` si elle existe.

### Vercel

Déploiements, domaines et variables des projets liés à Vercel. Crée un jeton sur *vercel.com › Account Settings › Tokens* et colle-le ici. Voir [Déploiement](/devforge/online/deploy/#vercel).

### Docker

Le moteur Docker de ce PC (Docker Desktop) : conteneurs, Compose, bases des projets. Rien à saisir : la ligne indique si Docker répond. S'il n'est pas installé, **Installer Docker Desktop** ouvre la page de téléchargement.

## Serveurs (VPS)

Les connexions SSH servent au terminal, à la surveillance, à n8n, à la page de statut, aux sauvegardes et aux déploiements. **Ajouter un serveur** ouvre le formulaire :

| Champ | Exemple |
|---|---|
| Nom | `mon-serveur` |
| Hôte / IP | `203.0.113.10` ou `vps.example.com` |
| Port | `22` |
| Nom d'utilisateur | `deploy` |
| Authentification | **Mot de passe** (stocké chiffré) ou **Clé privée** (chemin du fichier, par exemple `C:\Users\toi\.ssh\id_ed25519`) |
| Couleur | pour reconnaître le serveur dans les listes |

La **clé du serveur** est mémorisée à la première connexion ; si elle change, DevForge refuse de se connecter. **Oublier la clé** la remet à zéro (après une réinstallation du serveur, par exemple).

:::tip
Préfère une clé SSH : la page [Santé](/devforge/servers/health/) ne propose de couper les mots de passe SSH que si DevForge se connecte déjà avec une clé.
:::

Sans serveur, les pages qui en ont besoin (Santé, Services, Sauvegardes, n8n, VPN, Page de statut) restent simplement de côté : le menu les masque et indique combien de pages s'ajoutent avec un serveur.

## Bases de données

Les connexions de la page [Base de données](/devforge/data/database/) : PostgreSQL, MySQL / MariaDB et SQLite, en direct ou à travers un serveur SSH. **Ajouter une base** ouvre le même formulaire que sur cette page.

## Tester et retirer

Chaque ligne a un bouton **Tester** (« Ça répond : … » ou « Échec : … » avec la cause : jeton refusé, Docker ne répond pas, introuvable…) et un bouton **Retirer**, qui demande confirmation.

## Sur un autre PC

**Paramètres › Données › Exporter** enregistre ta configuration dans un fichier, **sans aucun secret**. Sur l'autre PC, **Importer…** la reprend ; il reste à ressaisir mots de passe, jetons et clés ici. Voir [Données](/devforge/settings/data/).
