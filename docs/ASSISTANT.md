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
| Question libre | Sonnet 5.5 | faible | — (recherche web possible) |
| Recherche web | Sonnet 5.5 | faible | — (recherche web) |
| Expliquer une erreur | Haiku 5.5 | faible | — |
| Message de commit | Haiku 5.5 | faible | projet |
| Revue des changements | Sonnet 5.5 | moyen | projet |
| Expliquer le projet | Haiku 5.5 | faible | projet |
| Écrire du SQL | Sonnet 5.5 | faible | — |
| Diagnostiquer un conteneur | Haiku 5.5 | faible | — |
| Analyser la réponse API | Haiku 5.5 | faible | page API Tester |

La tâche, le modèle et l'effort sont **fixés pour toute la conversation**. Pour en changer : nouvelle conversation.

## Recherche web

| Point | Règle |
|---|---|
| Tâches concernées | Question libre, Recherche web |
| Modèles | Sonnet 5.5 et Opus 5.5 (pas Haiku) |
| Limite | 3 recherches par appel |
| Coût | 0,01 $ par recherche + les tokens des résultats, inclus dans l'estimation |
| Sources | ajoutées en fin de réponse (liens cliquables) |
| Prérequis | recherche web activée pour l'organisation dans la console Anthropic |

## Ouvrir avec (abonnements)

Rangée **Ouvrir avec** du panneau. Ces outils utilisent **ton abonnement**, pas la clé API ni le budget.

| Bouton | Ouvre | Abonnement |
|---|---|---|
| Claude Code | terminal dans le projet choisi (sinon le dossier personnel) | Claude |
| Codex | idem | ChatGPT |
| Antigravity | idem | Google |
| Gemini CLI | idem | Google |
| Claude / ChatGPT / Gemini | l'app web dans le navigateur | celui du service |

Outil non installé : bouton en pointillés, il ouvre la page d'installation. DevForge ne lit ni ne réutilise la connexion de ces outils : les conditions des éditeurs réservent l'abonnement à leurs propres applications.

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

## Outils de lecture

`list_projects` · `list_files` · `read_file` · `search_code` · `git_status` · `git_diff` · `docker_status` · `container_logs` · `db_connections` · `db_schema` · `n8n_workflows` · `n8n_executions` · `vercel_deployments` · `vps_health` · `vps_services` · `backups_status` · `github_status`

La compétence **Point du matin sur le VPS** enchaîne `vps_health`, `backups_status`, `vps_services` (et `n8n_executions`) et répond en trois parties : état global, à faire, le reste.

| Garde-fou | Règle |
|---|---|
| Chemins | uniquement dans un projet enregistré (liens résolus) |
| Secrets | jamais lus : `.env*` (sauf exemples), clés, `id_rsa`, `.npmrc`, `credentials*` |
| Taille | `read_file` 250 lignes par défaut, recherche 30 résultats, arborescence 150 entrées |
| Étapes | 8 appels d'outils au plus par question |
| Contenu des pages | traité comme donnée, jamais comme instruction |

## Actions

Forgy peut aussi agir. Chaque action s'affiche en **carte** dans le panneau : ce qui va se passer, puis **Valider** ou **Refuser**. Rien ne s'exécute avant le clic. Une action proposée depuis le widget ouvre DevForge sur la carte.

| Outil | Ce qu'il fait | Annulable | Auto possible |
|---|---|---|---|
| `git_commit` | commit des fichiers modifiés (ou d'une liste) | oui : `reset --soft`, si pas encore poussé | oui |
| `git_pull` | `pull --ff-only` | non | non |
| `git_push` | push vers l'upstream, jamais forcé | non | non |
| `compose_action` | Compose `up` / `stop` / `restart` d'un projet | oui (`up` ↔ `stop`) | `up` / `stop` |
| `container_action` | `start` / `stop` / `restart` d'un conteneur | oui (`start` ↔ `stop`) | non |
| `sql_execute` | une requête SQL : lecture (50 lignes) ou écriture | non | lecture seule |
| `free_port` | arrête le processus qui écoute sur un port | non | non |
| `run_script` | lance un script `package.json` en arrière-plan | oui (arrêt) | oui |
| `env_add` | ajoute une **nouvelle** clé à un `.env` (valeur masquée sur la carte) | oui (suppression) | oui |
| `n8n_set_workflow` | active ou désactive un workflow n8n | oui (inverse) | oui |
| `n8n_retry_execution` | relance une exécution n8n en échec | non | non |
| `vercel_redeploy` | relance un build Vercel (par défaut celui en production) | non | non |
| `vercel_promote` | met un déploiement Vercel en production (aperçu, ou retour en arrière) | oui (production précédente) | non |
| `vpn_create_client` | crée un client WireGuard (wg-easy) ; la page VPN s'ouvre sur son QR code | non | non |
| `backup_now` | lance tout de suite la sauvegarde de nuit du VPS | non | non |
| `github_rerun` | relance les jobs en échec d'un run GitHub Actions | non | non |

| Garde-fou | Règle |
|---|---|
| SQL | une seule requête ; `DROP`, `TRUNCATE`, `ALTER … DROP`, `GRANT`, accès fichiers refusés ; `DELETE` / `UPDATE` sans `WHERE` refusés |
| Git | jamais de push forcé ; un premier push (sans upstream) se fait depuis la page Git |
| `.env` | jamais de modification d'une clé existante |
| Ports | jamais un service Windows ni DevForge |
| Refus | Forgy est prévenu et ne relance pas l'action |
| Arrêt | arrêter la réponse vaut refus des actions en attente |

**Réglage** (Paramètres → Assistant IA → Actions de Forgy) :
- *Toujours demander* (par défaut) ;
- *Auto pour les actions sûres* : seules les actions de la colonne « Auto possible » partent sans clic.

**Journal** : bouton ☑ du panneau. Il liste chaque action proposée (faite, refusée, échouée, annulée), avec **Annuler** quand c'est possible. Stocké dans `userData/assistant/actions.json` (200 dernières). Chaque action faite ou échouée apparaît aussi dans l'activité de l'accueil.

## Maîtrise du coût

| Levier | Effet |
|---|---|
| Modèle par tâche (Auto) | Haiku coûte 20× moins que Sonnet, 40× moins qu'Opus |
| Cache de prompt | la partie fixe (consignes + outils) et l'historique sont relus depuis le cache |
| Réponses courtes | consignes « pas de préambule », ~150 mots max |
| Recherche web limitée | tâches dédiées, 3 recherches par appel, pas sur Haiku |
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

### En balade

Panneau fermé, Forgy marche en bas de l'app avec **Boulon**, son chien robot : balade, coucou, pause, course, sieste (avec l'assistant).

- Les clics passent à travers.
- Assis et immobile quand la fenêtre n'a pas le focus.
- Coût : environ 3 % du fil principal en marchant, rien au repos.
- Réglages → Assistant IA : désactiver Forgy ou seulement Boulon.

## Sur le bureau (widget)

Paramètres → Assistant IA → **Forgy sur le bureau** (désactivé par défaut). Une bulle reste au premier plan en bas à droite de l'écran principal, au-dessus de l'horloge, même quand DevForge est dans la barre des tâches.

- **Ouvrir** : clic sur la bulle ou **Ctrl+Alt+Espace** depuis n'importe quelle appli. Si une autre appli a déjà ce raccourci, c'est **Ctrl+Alt+J** ; le raccourci actif est affiché sous l'interrupteur.
- **Demander** : une ligne, Entrée. La réponse s'affiche au-dessus, avec **Copier** et **Ouvrir dans DevForge** (la conversation continue dans le panneau).
- **Pastilles** : bulle repliée pendant une réponse → pastille orange quand elle arrive, rouge en cas d'erreur.
- **Puces** : profondeur de réflexion (fixée pour la conversation) et projet en contexte.
- **Micro** : clic pour parler, clic pour finir (60 s au plus). Le texte s'ajoute au champ. Même bouton dans le panneau.
- **Replier** : chevron, Échap ou le raccourci. Un clic ailleurs replie aussi si rien n'est affiché. Replier après une réponse démarre une nouvelle conversation.

Même assistant que le panneau : même clé, même budget, même historique. Repliée, la bulle ne prend jamais le focus et rien n'y est animé (sauf quelques anneaux à l'arrivée d'une réponse). Elle se replace quand la barre des tâches ou l'écran change.

## Dictée

Whisper tourne sur ce PC (transformers.js + ONNX Runtime, dans le processus principal) : la voix ne quitte pas l'ordinateur et aucun compte n'est nécessaire.

- **Modèle** (Paramètres → Forgy → Dictée) : *Rapide* (whisper-base, ~75 Mo) ou *Précise* (whisper-small, ~250 Mo, meilleur sur les mots techniques). Il se télécharge depuis Hugging Face à la première dictée (ou avec « Télécharger maintenant »), dans `userData/models`, puis tout marche hors ligne.
- **Langue** : celle de l'interface.
- **Garde-fous** : un silence ne donne rien (Whisper invente du texte sur le silence) et une phrase qui boucle est coupée à sa première occurrence.
- **Micro refusé** : Paramètres Windows → Confidentialité → Microphone.

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
| `src/main/widget.ts` | fenêtre du widget de bureau, position, raccourci global |
| `src/renderer/src/features/widget/Widget.tsx` | interface du widget (`widget.html`) |
| `src/main/services/assistant/projectContext.ts` | résumé du projet |
| `src/shared/data/assistantSkills.ts` | tâches, prix des modèles et de la recherche web |
| `src/main/services/system/aiTools.ts` | détection et lancement de Claude Code, Codex, Antigravity, Gemini CLI |
| `src/renderer/src/features/assistant/` | panneau, Markdown, contexte de page, Forgy |
| `tests/main/assistant*.test.ts` | tests (outils, boucle, coût, budget) |

Données locales : `%APPDATA%\devforge\assistant\` (`config.json`, `usage.json`, `conversations/`).
