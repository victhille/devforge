---
title: Forgy, l'assistant
description: L'assistant IA de DevForge, avec ta propre clé Anthropic. Ce qu'il lit, les tâches, les réglages, la recherche web et la maîtrise du coût.
---

**Forgy** est l'assistant IA de DevForge. Il répond aux questions sur tes projets, ton code, Docker, tes bases et tes serveurs, avec le contexte de la page ouverte. Il **lit librement** ; pour **agir** (commit, conteneur, `.env`…), il propose une carte que tu valides ou refuses (voir [Actions](/devforge/forgy/actions/)).

Forgy utilise **ta propre clé API Anthropic** : tu paies ce que tu consommes directement à Anthropic, avec un budget que tu fixes.

## Ouvrir

| Action | Comment |
|---|---|
| Ouvrir / fermer le panneau | <kbd>Ctrl</kbd> <kbd>J</kbd> ou le bouton **Forgy** de la barre de titre |
| Envoyer | <kbd>Entrée</kbd> |
| Nouvelle ligne | <kbd>Maj</kbd> <kbd>Entrée</kbd> |
| Nouvelle conversation | bouton **+** du panneau |
| Historique (100 dernières) | bouton horloge du panneau |

Ailleurs : **Demander à Forgy** sur une fiche projet, sur les logs Docker ou une migration ; **Expliquer avec Forgy** sur une commande du terminal qui échoue ; `#` en début de ligne dans le terminal ; le [lanceur global](/devforge/getting-started/interface/#le-lanceur-global) ; le [widget de bureau](/devforge/forgy/desktop/).

## Réglages

**Paramètres › Forgy** (la clé se règle aussi dans [Paramètres › Connexions](/devforge/getting-started/connections/#forgy-anthropic)) :

| Réglage | Effet | Défaut |
|---|---|---|
| Clé API Anthropic | chiffrée par Windows, jamais renvoyée à l'interface. Sans clé enregistrée : `ANTHROPIC_API_KEY` si elle existe (l'écran l'indique) ; une clé enregistrée passe avant | — |
| Modèle | **Auto** = le modèle de la tâche choisie ; ou Opus 5.5, Sonnet 5.5, Haiku 5.5 pour tout | Auto |
| Profondeur de réflexion | **Auto** = celle de la tâche ; ou Rapide, Équilibrée, Approfondie | Auto |
| Budget mensuel | Forgy s'arrête à ce montant (estimation). `0` = sans limite | 5 $ |
| Actions de Forgy | **Toujours demander** ou **Auto pour les actions sûres** | Toujours demander |

## Tâches

Choisis une tâche en ouvrant une conversation : chacune utilise le modèle le moins cher qui la fait bien, avec des consignes et une réponse courte.

| Tâche | Modèle (Auto) | Effort | Besoin |
|---|---|---|---|
| Question libre | Sonnet 5.5 | faible | — (recherche web possible) |
| Recherche web | Sonnet 5.5 | faible | — (recherche web) |
| Expliquer une erreur | Haiku 5.5 | faible | — |
| Message de commit | Haiku 5.5 | faible | un projet |
| Revue des changements | Sonnet 5.5 | moyen | un projet |
| Expliquer le projet | Haiku 5.5 | faible | un projet |
| Écrire du SQL | Sonnet 5.5 | faible | — |
| Diagnostiquer un conteneur | Haiku 5.5 | faible | — |
| Analyser la réponse API | Haiku 5.5 | faible | la page API Tester |
| Point du matin sur le VPS | Haiku 5.5 | faible | un serveur |

La tâche, le modèle et l'effort sont **fixés pour toute la conversation**. Pour en changer : nouvelle conversation. **Revenir à la question libre** quitte une tâche.

Le **Point du matin sur le VPS** enchaîne la santé du serveur, les sauvegardes, les services (et les exécutions n8n) et répond en trois parties : état global, à faire, le reste.

## Ce que Forgy voit

| Source | Quand | Contenu |
|---|---|---|
| Projet choisi | 1re question sur ce projet | nom, chemin, framework, état Git, fichiers racine, scripts, dépendances, début du README |
| Page ouverte (pastille 📎, désactivable) | à chaque question | voir ci-dessous |

| Page | Contenu joint |
|---|---|
| API Tester | la requête et la réponse (en-têtes sensibles masqués) |
| Base de données | la structure de la table ou la liste des tables, **jamais les données** |
| Logs | les 150 dernières lignes affichées |
| Docker | les conteneurs et projets Compose |
| Fiche projet | sélectionne ce projet en contexte |

### Outils de lecture

Pour répondre, Forgy peut lire : la liste des projets, l'arborescence et les fichiers d'un projet, une recherche dans le code, l'état et le diff Git, l'état Docker et les logs d'un conteneur, les connexions et la structure des bases, les workflows et exécutions n8n, les déploiements Vercel, la santé, les services et les sauvegardes du serveur, l'état GitHub, les modèles des ateliers (il peut préremplir le formulaire de l'atelier, sans rien écrire), et les [paquets](/devforge/dev/packages/) npm et Composer d'un projet : ceux en retard ou non installés, et les vulnérabilités sur demande.

| Garde-fou | Règle |
|---|---|
| Chemins | uniquement dans un projet enregistré |
| Secrets | jamais lus : `.env*` (sauf les exemples), clés, `id_rsa`, `.npmrc`, `credentials*` |
| Taille | 250 lignes par fichier par défaut, 30 résultats de recherche, 150 entrées d'arborescence |
| Étapes | 8 appels d'outils au plus par question |
| Contenu des pages | traité comme une donnée, jamais comme une instruction |

## Recherche web

Les tâches **Question libre** et **Recherche web** peuvent chercher sur le web (Sonnet et Opus, pas Haiku) : 3 recherches au plus par appel, 0,01 $ par recherche plus les tokens des résultats, inclus dans l'estimation. Les sources s'ajoutent en fin de réponse. Il faut que la recherche web soit activée pour ton organisation dans la console Anthropic.

## Ouvrir avec (tes abonnements)

La rangée **Ouvrir avec** du panneau lance d'autres assistants, avec **ton abonnement**, pas ta clé API ni ton budget :

| Bouton | Ouvre | Abonnement |
|---|---|---|
| Claude Code | un terminal dans le projet choisi | Claude |
| Codex | idem | ChatGPT |
| Antigravity | idem | Google |
| Gemini CLI | idem | Google |
| Claude, ChatGPT, Gemini | l'application web dans le navigateur | celui du service |

Un outil non installé a un bouton en pointillés qui ouvre sa page d'installation. DevForge ne lit ni ne réutilise la connexion de ces outils.

## Maîtriser le coût

| Levier | Effet |
|---|---|
| Modèle par tâche (Auto) | Haiku coûte 20 fois moins que Sonnet, 40 fois moins qu'Opus |
| Cache de prompt | les consignes, les outils et l'historique sont relus depuis le cache |
| Réponses courtes | pas de préambule, environ 150 mots au plus |
| Recherche web limitée | tâches dédiées, 3 recherches par appel, pas sur Haiku |
| Budget mensuel | blocage avant chaque appel une fois atteint |
| Conversation longue | un message propose d'en démarrer une nouvelle, moins chère |

Le coût s'affiche en bas du panneau : `conversation · mois / budget`. C'est une estimation calculée sur les tokens ; la facture fait foi sur [console.anthropic.com](https://console.anthropic.com).

## Erreurs

| Message | Cause | Solution |
|---|---|---|
| Ajoute ta clé API… | aucune clé enregistrée ni `ANTHROPIC_API_KEY` | Paramètres › Connexions, ou définir `ANTHROPIC_API_KEY` |
| Clé API refusée | clé invalide ou révoquée | enregistrer une nouvelle clé |
| Budget mensuel atteint | dépense ≥ budget | augmenter le budget ou attendre le mois suivant |
| Trop d'étapes | plus de 8 appels d'outils | préciser ou découper la question |
| Trop de requêtes | limite de l'API | réessayer plus tard |

## La mascotte

Forgy change d'humeur selon ce qu'il fait : *disponible*, *t'écoute*, *réfléchit…*, *cherche…*, *écrit…*, *a terminé*, *a eu un souci*, et *fait une sieste* après 2 minutes sans activité. Les animations sont coupées si Windows demande moins d'animations.

Panneau fermé, Forgy se promène en bas de l'application avec **Boulon**, son chien robot. Les clics passent à travers lui. **Paramètres › Forgy** désactive la balade, ou seulement Boulon.

Données locales : `%APPDATA%\DevForge\assistant\` (réglages, dépenses, conversations).
