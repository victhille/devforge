# Notes de version

Toutes les versions de DevForge. Format : [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), versions [SemVer](https://semver.org/lang/fr/).

## [Non publié]

## [0.2.0](https://github.com/victhille/devforge/compare/v0.1.0...v0.2.0) — 2026-11-09

> Toute l'app passe à l'interface « Forge », avec une couleur au choix, un texte qui s'agrandit et des pages qui s'affichent tout de suite.

### Nouveautés

- **Interface** : refonte « Forge » de toutes les pages, du menu aux Paramètres : nouvelles couleurs et polices, cartes, tableaux et compteurs, couleurs du code dans l'aperçu des fichiers
- **Apparence** : six couleurs principales (Orange Forge, Bleu, Violet, Rose, Turquoise, Vert) qui teintent toute l'interface, en thème sombre comme clair, et une taille du texte réglable de Petite à Très grande
- **Accueil** : pastilles d'état, « Reprendre » pour retrouver les derniers projets, carte Forgy, et des widgets tous construits de la même façon
- **Projets** : les cartes montrent l'état Git (branche, fichiers modifiés, commits à pousser), les groupes se replient en pastilles, et un projet créé arrive sur sa page d'accueil
- **Fiche projet** : Fichiers et Git réunis dans un seul onglet, avec la branche, Fetch, Pull et Push au-dessus de l'arbre ; les onglets qui ne tiennent pas passent dans « Plus »
- **Notes** : plusieurs notes titrées par projet, rangées dans `.devforge/notes` (elles suivent Git), avec des listes à cocher que Forgy sait lire, cocher et compléter
- **Nouveau projet** : l'assistant montre ses étapes à gauche et « Ce qui sera créé » à droite, avec un récapitulatif
- **Base de données** : onglet « Rechercher » pour trouver un texte, des mots, une expression exacte ou une expression régulière dans toutes les tables, résultats surlignés
- **Serveurs et mise en ligne** : barres des dernières 24 h, Déploiement qui suit les étapes de son script, un onglet Docker par serveur, compteurs n8n du jour et code QR de chaque appareil VPN
- **Système et outils** : Environnement range les outils par famille, Ports signale les serveurs de dev oubliés, Variables `.env` masque les secrets et sait les régénérer, Diff côte à côte ou unifié
- **Paramètres** : sections rangées en cartes, Connexions en lignes compactes (Tester, Modifier, Retirer), coût du mois de Forgy, et une « Zone sensible » pour tout effacer

### Améliorations

- **Chargement** : réglages, serveurs SSH, modèles de projet et IDE restent en mémoire : une page qui revient s'affiche tout de suite, un changement fait ailleurs se voit partout, et des squelettes à la forme du contenu remplacent les roues de chargement
- **Nettoyage** : la taille des dossiers se lit environ 20 fois plus vite

### Corrections

- **Fermeture** : les processus lancés par DevForge (serveurs de dev, commandes, tests, journaux Docker) s'arrêtent avec l'app au lieu de continuer à tourner
- **Langue** : tailles et durées s'affichent dans la langue de l'interface (Mo, MB…)
- **Windows** : l'icône DevForge revient dans la barre des tâches

### Sécurité

- **SSH** : un serveur qui change d'hôte, de port ou d'utilisateur oublie son mot de passe, sa clé de serveur et les secrets gardés pour lui (n8n, VPN)
- **Variables `.env`** : une clé ou une valeur qui ajouterait des lignes au fichier est refusée
- **Base de données** : la recherche refuse les expressions régulières dangereuses et passe par des requêtes préparées

## [0.1.0](https://github.com/victhille/devforge/releases/tag/v0.1.0) — 2026-11-07

> Première préversion : tout l'atelier de dev Windows dans une seule app, gratuite, open source et sans compte.

### Nouveautés

- **Projets** : création guidée (Laravel, Symfony, Next.js, Node…), ouverture dans l'éditeur, terminal intégré, scripts et ateliers par framework
- **Git et GitHub** : état, branches, commits et pull requests
- **Docker** : conteneurs, Compose, base de données Docker par projet, Docker d'un serveur par SSH
- **Serveurs** : connexions SSH, santé, services, sauvegardes, VPN, n8n et page de statut
- **Bases de données** : connexions, requêtes, sauvegardes, modélisation (MCD, MPD, diagrammes) et testeur d'API
- **Déploiements** : Vercel et serveurs
- **Forgy** (Ctrl+J) : assistant IA avec ta propre clé (Anthropic, OpenAI, Gemini, Mistral, Grok, OpenRouter, Groq, DeepSeek ou un modèle local avec Ollama), outils en lecture seule, coût maîtrisé
- **Configuration** : tout se règle dans Paramètres › Connexions ; secrets chiffrés par Windows, export et import de la configuration sans les secrets
- **Mises à jour** : automatiques, en différentiel, canaux Stable et Bêta
- **Interface** : français et anglais, thèmes sombre et clair, mode compact
