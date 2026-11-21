# Notes de version

Toutes les versions de DevForge. Format : [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), versions [SemVer](https://semver.org/lang/fr/).

## [Non publié]

## [0.6.0](https://github.com/victhille/devforge/compare/v0.5.0...v0.6.0) — 2026-11-20

> Se connecter à GitHub sans jeton, et un Expo qui démarre et s'ouvre sur le téléphone.

### Nouveautés

- **Connexions** : dans **Paramètres › Connexions**, **Se connecter** branche GitHub sans jeton à copier. DevForge affiche un code, **Ouvrir GitHub** ouvre la page où le taper, et la ligne passe au vert dès que tu as accepté. Coller un jeton reste possible

### Corrections

- **Expo** : quand Windows réserve le port de Metro (WSL, Hyper-V le font souvent pour 8081), DevForge prend le suivant qui est libre et le dit dans le journal, au lieu de rester bloqué sur « Démarrage… »
- **Expo** : le QR code ne garde plus le « › » de Metro collé à l'adresse. Scanné avec Expo Go, il ouvre l'appli au lieu d'afficher « Failed to download remote update »
- **Connexions** : une connexion annulée libère tout de suite le port local, le nouvel essai ne dit plus « Une autre connexion est en cours »

## [0.5.0](https://github.com/victhille/devforge/compare/v0.4.0...v0.5.0) — 2026-11-20

> Les serveurs MCP officiels se branchent à Forgy en un clic, et les mises à jour s'installent en silence.

### Nouveautés

- **Serveurs MCP pour Forgy** : dans **Paramètres › Connexions**, les serveurs officiels de Vercel, Supabase, Sentry, Linear, Notion, Context7 et Playwright se branchent en un clic. Ceux qui demandent un compte ouvrent le navigateur sur la page du service : aucun jeton à copier. Leurs outils deviennent ceux de Forgy
- **Serveurs MCP pour Forgy** : **Ajouter un serveur MCP** branche un serveur qui n'est pas dans la liste, par son adresse ou par la commande qui le lance sur ce PC. Un interrupteur dit si Forgy peut s'en servir

### Améliorations

- **Mises à jour** : à partir de la mise à jour qui suivra la 0.5.0, l'installation se fait en silence, sans PowerShell ni page d'installeur, et une petite fenêtre DevForge la suit jusqu'à la réouverture. Le passage de la 0.4.0 à la 0.5.0 montre encore l'ancienne page
- **Expo** : le QR code donne au téléphone l'adresse Wi-Fi du PC, et non plus une adresse qu'il ne peut pas joindre ; l'appli s'ouvre dans Expo Go
- **Tests** : trois tests qui échouaient au hasard sur la CI sont stabilisés

### Sécurité

- **Serveurs MCP** : Forgy demande ton accord par une carte avant tout outil qui modifie quelque chose, et avant chaque outil d'un serveur ajouté à la main. Ce que renvoie un serveur lui est donné comme des données, jamais comme des instructions
- **Serveurs MCP** : les connexions sont chiffrées par Windows ; une adresse avec un mot de passe ou une clé est refusée, et une commande est montrée avant d'être ajoutée

## [0.4.0](https://github.com/victhille/devforge/compare/v0.3.0...v0.4.0) — 2026-11-20

> Vercel et Expo ont chacun leur page, et les projets dont le dossier a disparu se retirent tout seuls.

### Nouveautés

- **Vercel** : une page **Mise en ligne › Vercel** pour tout le compte ou une équipe : projets, déploiements et domaines. Elle annule un build, passe un aperçu en production et lie un projet Vercel à un dossier de DevForge
- **Expo** : une page **Développement › Expo** pour lancer une appli React Native, monorepos compris, avec Expo Go ou un build de dev, en Wi-Fi, en tunnel ou sur ce PC. Le QR code s'affiche dans la page, les commandes de Metro (recharger, menu de dev, Android, navigateur…) sont des boutons, et les paquets s'alignent sur le SDK
- **Forgy** : il explique un déploiement Vercel en échec ou une erreur de Metro à partir de la fin du journal

### Améliorations

- **Projets** : un projet dont le dossier a disparu est retiré tout seul, au démarrage et à chaque **Rescanner**, avec **Annuler**. Un disque débranché ou un lecteur réseau garde ses projets
- **Forgy** : le choix du projet devient une liste avec une recherche, les icônes, les favoris puis les projets récents, utilisable au clavier
- **Accessibilité** : un bouton qui charge l'annonce aux lecteurs d'écran

### Sécurité

- **Vercel** : les secrets reconnus sont masqués dans les journaux de build, à l'écran comme pour Forgy
- **Expo** : le serveur Metro s'arrête avec DevForge, sans rester en arrière-plan

## [0.3.0](https://github.com/victhille/devforge/compare/v0.2.1...v0.3.0) — 2026-11-20

> Les mises à jour se voient : un bloc de téléchargement, un écran au redémarrage, et une app plus accessible et plus discrète.

### Nouveautés

- **Mises à jour** : un bloc en bas à droite suit le téléchargement (barre, Mo reçus, temps restant) ; il se réduit en pastille dans la barre de titre, et propose **Redémarrer et mettre à jour** ou **Plus tard** quand la version est prête
- **Mises à jour** : au redémarrage, un voile annonce l'installation, l'installeur s'intitule « Mise à jour de DevForge », et une petite fenêtre « Mise à jour installée » s'affiche le temps que DevForge se rouvre
- **Vie privée** : les mises à jour automatiques peuvent se couper, et **Paramètres** explique ce qui sort du PC
- **Licences** : la licence de DevForge et celles de ses composants sont livrées dans l'installeur et se lisent depuis **Paramètres › À propos**

### Améliorations

- **Accessibilité** : le contraste élevé de Windows est suivi, les champs de saisie sont plus lisibles, la langue choisie est annoncée aux lecteurs d'écran, et les petits boutons font au moins 24 px
- **Sobriété** : les écrans qui interrogent le réseau (Docker, Vercel, VPS, GitHub…) s'arrêtent quand la fenêtre est réduite
- **Installeur** : il est plus léger, et la désinstallation fait le ménage

### Sécurité

- **Forgy** : en mode auto-sûr, seuls les serveurs de développement démarrent seuls ; les autres scripts demandent un clic
- **Forgy** : il ne lit plus certains fichiers sensibles
- **Journal** : il masque plus de secrets et les dossiers d'utilisateur
- **Webhooks** : relancer une requête capturée l'envoie toujours à l'adresse choisie, même si l'appel reçu donnait une adresse complète
- **Base de données** : une base ouverte ne peut plus lancer d'expression régulière en dehors de la recherche
- **Publication** : l'installeur est construit sans droit d'écriture sur le dépôt, et sa provenance est attestée par GitHub

### Dépendances et build

- **Electron** 44.11.5 et mises à jour mineures des autres composants

## [0.2.1](https://github.com/victhille/devforge/compare/v0.2.0...v0.2.1) — 2026-11-10

> Correctifs de sécurité pour le lancement des scripts, et une interface qui suit partout la taille du texte.

### Améliorations

- **Taille du texte** : le terminal (blocs et SSH), l'arbre des fichiers, l'onglet Paquets et les tests de la fiche projet suivent maintenant la taille du texte et la densité choisies
- **Clavier** : les sélecteurs des Paramètres, comme la taille du texte, se parcourent aux flèches, avec un seul arrêt de Tab
- **Serveurs et projets** : la palette Ctrl+K, le tableau de bord d'un serveur, le terminal et le widget de Forgy suivent tout de suite un serveur ou un projet ajouté, renommé ou retiré
- **Lecteurs d'écran** : un tableau en cours de chargement l'annonce, comme les autres squelettes

### Corrections

- **Base de données** : le schéma en plein écran ne recouvre plus le bas de la barre de titre

### Sécurité

- **Scripts** : avec pnpm ou yarn, un script nommé comme une commande du gestionnaire (`publish`, `install`…) lance bien le script ; un clic ne peut plus publier un paquet par erreur
- **Scripts** : un nom de script avec des caractères qu'un shell interprète, ou un gestionnaire de paquets inconnu venu d'un export importé, n'arrive plus dans le terminal, dans Forgy ni dans la création d'un projet
- **Dossiers réseau** : les scripts d'un partage réseau ne sont lus que pour un projet enregistré, pour ne pas envoyer l'identifiant Windows à un hôte inconnu

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
