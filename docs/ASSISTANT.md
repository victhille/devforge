# Assistant IA (Forgy)

Panneau latéral qui répond aux questions sur tes projets, ton code, Docker et tes bases, avec le contexte de la page ouverte. Il **lit** sans jamais rien modifier.

## Ouvrir

| Action | Raccourci |
|---|---|
| Ouvrir / fermer le panneau | **Ctrl+J** ou bouton **Forgy** dans la barre de titre |
| Envoyer | **Entrée** |
| Nouvelle ligne | **Maj+Entrée** |
| Nouvelle conversation | bouton **+** du panneau |
| Historique (100 dernières) | bouton horloge du panneau |

## Configuration

**Paramètres → Assistant IA**

| Réglage | Effet | Défaut |
|---|---|---|
| Clé API Anthropic | Chiffrée par Windows, jamais renvoyée à l'interface. Sans clé : `ANTHROPIC_API_KEY` si elle existe | — |
| Modèle | `Auto` = le modèle de la tâche choisie ; ou Opus 5.5 / Sonnet 5.5 / Haiku 5.5 pour tout | Auto |
| Profondeur de réflexion | `Auto` = celle de la tâche ; ou Rapide / Équilibrée / Approfondie | Auto |
| Budget mensuel | L'assistant s'arrête à ce montant (estimation). `0` = sans limite | 5 $ |

## Tâches (skills)

Chaque tâche a son modèle, son effort, ses consignes et un format de réponse court.

| Tâche | Modèle (Auto) | Effort | Besoin |
|---|---|---|---|
| Question libre | Sonnet 5.5 | faible | — |
| Expliquer une erreur | Haiku 5.5 | faible | — |
| Message de commit | Haiku 5.5 | faible | projet |
| Revue des changements | Sonnet 5.5 | moyen | projet |
| Expliquer le projet | Haiku 5.5 | faible | projet |
| Écrire du SQL | Sonnet 5.5 | faible | — |
| Diagnostiquer un conteneur | Haiku 5.5 | faible | — |
| Analyser la réponse API | Haiku 5.5 | faible | page API Tester |

La tâche, le modèle et l'effort sont **fixés pour toute la conversation**. Pour en changer : nouvelle conversation.

## Contexte envoyé

| Source | Quand | Contenu |
|---|---|---|
| Projet choisi | 1re question sur ce projet | nom, chemin, framework, git, fichiers racine, scripts, dépendances, début du README |
| Page ouverte (pastille 📎, désactivable) | à chaque question | voir ci-dessous |

| Page | Contenu joint |
|---|---|
| API Tester | requête et réponse (en-têtes sensibles masqués) |
| Base de données | structure de la table ou liste des tables, jamais les données |
| Logs | 150 dernières lignes affichées |
| Docker | conteneurs et projets Compose |
| Fiche projet | sélectionne le projet en contexte |

## Outils (lecture seule)

`list_projects` · `list_files` · `read_file` · `search_code` · `git_status` · `git_diff` · `docker_status` · `container_logs` · `db_connections` · `db_schema`

| Garde-fou | Règle |
|---|---|
| Chemins | uniquement dans un projet enregistré (liens résolus) |
| Secrets | jamais lus : `.env*` (sauf exemples), clés, `id_rsa`, `.npmrc`, `credentials*` |
| Taille | `read_file` 250 lignes par défaut, recherche 30 résultats, arborescence 150 entrées |
| Étapes | 8 appels d'outils au plus par question |
| Contenu des pages | traité comme donnée, jamais comme instruction |

## Maîtrise du coût

| Levier | Effet |
|---|---|
| Modèle par tâche (Auto) | Haiku coûte 20× moins que Sonnet, 40× moins qu'Opus |
| Cache de prompt | la partie fixe (consignes + outils) et l'historique sont relus depuis le cache |
| Réponses courtes | consignes « pas de préambule », ~150 mots max |
| Sorties d'outils limitées | chaque résultat est renvoyé à chaque message suivant |
| Budget mensuel | blocage avant chaque appel une fois atteint |
| Conversation longue | un message propose d'en démarrer une nouvelle (moins chère) |

Coût affiché en bas du panneau : `conversation · mois / budget`. C'est une estimation calculée sur les tokens ; la facture fait foi sur [console.anthropic.com](https://console.anthropic.com).

## Forgy, la mascotte

| État | Quand |
|---|---|
| Disponible | au repos |
| T'écoute | pendant la saisie |
| Réfléchit | question envoyée, avant la réponse |
| Cherche | un outil s'exécute |
| Écrit | la réponse arrive |
| A fini | réponse terminée |
| A eu un souci | erreur (clé, budget, réseau…) |
| Sieste | 2 min sans activité |

Animations coupées si Windows demande moins d'animations.

## Erreurs

| Message | Cause | Solution |
|---|---|---|
| Ajoute ta clé API… | aucune clé | Paramètres → Assistant IA |
| Clé API refusée | clé invalide ou révoquée | enregistrer une nouvelle clé |
| Budget mensuel atteint | dépense ≥ budget | augmenter le budget ou attendre le mois suivant |
| Trop d'étapes | plus de 8 appels d'outils | préciser ou découper la question |
| Trop de requêtes | limite de l'API | réessayer plus tard |

## Fichiers

| Fichier | Rôle |
|---|---|
| `src/main/services/assistant/assistantService.ts` | boucle d'appel à Claude, coût, budget |
| `src/main/services/assistant/assistantTools.ts` | outils et garde-fous |
| `src/main/services/assistant/assistantStorage.ts` | clé chiffrée, réglages, conversations, dépenses |
| `src/main/services/assistant/projectContext.ts` | résumé du projet |
| `src/shared/data/assistantSkills.ts` | tâches, prix des modèles |
| `src/renderer/src/features/assistant/` | panneau, Markdown, contexte de page, Forgy |
| `tests/main/assistant*.test.ts` | tests (outils, boucle, coût, budget) |

Données locales : `%APPDATA%\devforge\assistant\` (`config.json`, `usage.json`, `conversations/`).
