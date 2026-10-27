# Étude : DevForge sur macOS et Linux

Étude du lot 5 de la [v3.2](../roadmap/v3.2.md#lot-5--macos-et-linux), faite le 27/10/2026 sur la 3.1 (lecture du code, rien n'a encore été lancé ailleurs que sous Windows).

## En bref

- **Le code est plus portable qu'on ne le croyait** : Electron, Node et les modules natifs (`node-pty`, `onnxruntime` pour la dictée, `ssh2`) existent pour les trois systèmes, et une bonne partie des services a déjà sa branche Unix (ports, fichier hosts, arrêt des processus, recherche des exécutables, guillemets du shell).
- **Ce qui manque est surtout autour** : les terminaux (Bash et Zsh à ajouter), les textes qui parlent de Windows, le coffre à secrets de Linux, la fabrication et les tests sur les deux systèmes.
- **Le vrai frein est macOS** : sans compte développeur Apple (99 $ par an), l'appli n'est pas signée ; macOS la bloque au premier lancement, et **les mises à jour automatiques n'y marchent pas** (elles exigent une signature). Linux n'a aucune de ces contraintes.
- **Recommandation : Linux d'abord** (AppImage, mises à jour automatiques comprises), testable sur ton PC avec WSL ; macOS ensuite, une fois la signature décidée.

## Ce qui marche déjà ailleurs

| Domaine | Pourquoi |
|---|---|
| Git, Docker, SSH, bases de données, Vercel, GitHub, n8n, page de statut, VPN | bibliothèques Node (`ssh2`, `pg`, `mysql2`, `sql.js`) et outils en ligne de commande identiques partout |
| Ports à l'écoute, arrêt d'un processus | `portService` a sa branche Unix ; `killTree` tue le groupe de processus hors Windows |
| Commande d'un port (suggestions) | `ps` hors Windows, Get-CimInstance sous Windows |
| Fichier hosts | `osascript` (macOS) et `pkexec` (Linux) pour l'élévation, déjà écrits |
| Recherche d'un exécutable, guillemets | `which` et guillemets simples hors Windows (`safe.ts`, `exec.ts`) |
| Domaines locaux | le proxy essaie d'autres ports quand le 80 est refusé (il l'est sans droits root) |
| Forgy, dictée | API Anthropic ; Whisper via `onnxruntime-node`, qui existe pour macOS et Linux |
| Raccourcis globaux | `CommandOrControl` : Cmd sur Mac, Ctrl ailleurs |
| Démarrage avec la session | `setLoginItemSettings` marche sous macOS (pas sous Linux, voir plus bas) |

## Ce qu'il faut adapter

| Domaine | Aujourd'hui | À faire | Taille |
|---|---|---|---|
| Terminal intégré | PowerShell, PowerShell 7, Git Bash, cmd | ajouter **Bash** et **Zsh** natifs (Bash réutilise déjà le script de marqueurs de Git Bash ; Zsh en demande un) ; terminal par défaut selon le système | M |
| « Ouvrir un terminal » (projet, Forgy › Ouvrir avec) | Windows Terminal, PowerShell, cmd ; ailleurs, ouvre seulement le dossier | Terminal.app (`open -a Terminal`), puis `x-terminal-emulator` / `gnome-terminal` / `konsole` sous Linux | S |
| Secrets sous Linux | `safeStorage` | il dépend d'un trousseau (GNOME Keyring, KWallet) ; sans lui, Electron chiffre avec une clé fixe (`basic_text`) : le détecter (`getSelectedStorageBackend`) et le dire dans Connexions | S |
| Démarrer avec la session (Linux) | non géré | un fichier `.desktop` dans `~/.config/autostart` | S |
| Zone de notification (Linux) | `Tray` | dépend du bureau (AppIndicator) ; garder la fenêtre si elle manque | S |
| Widget Forgy de bureau | placé au-dessus de la barre des tâches | sous macOS, au-dessus du Dock ; à vérifier sous GNOME et KDE | S |
| Textes de l'interface | 16 phrases parlent de Windows (« chiffré par Windows », « Démarrer avec Windows », « Comme Windows », micro…) | un mot selon le système (« Windows », « macOS », « le système ») | S |
| Fabrication | `nsis` (Windows) | `AppImage` (+ `deb` éventuel) et `dmg`, icônes `.png` / `.icns`, workflow Release sur les trois systèmes | M |
| Mises à jour | `latest.yml` | `latest-linux.yml` pour l'AppImage (géré par electron-updater) ; macOS : seulement avec une appli signée | S (Linux) |
| CI | Windows | matrice Windows + Linux (e2e sous `xvfb`) ; macOS plus tard | M |
| Site et README | « l'atelier de dev sur Windows » | page Installation par système | S |

## Ce qui reste Windows seulement

À cacher ailleurs, comme les pages qui attendent un serveur :
- les terminaux **PowerShell** (Windows PowerShell 5) et **cmd** ; PowerShell 7 (`pwsh`) existe sur les trois systèmes et peut rester ;
- l'explication de l'alerte **SmartScreen**.

Rien d'autre n'est propre à Windows au point de devoir disparaître.

## Points de vigilance

- **macOS sans signature** : il faut un clic droit › Ouvrir, voire Réglages › Confidentialité pour autoriser l'appli ; electron-builder signe « ad hoc » pour les Mac Apple Silicon, ce qui évite le message « endommagée » mais pas l'avertissement ; et pas de mise à jour automatique. Avec un compte développeur : signature et notarisation dans le workflow Release.
- **Tests** : ni Mac ni Linux natif ici. Linux se teste avec WSL (WSLg affiche les fenêtres sous Windows 11) et sur le runner Ubuntu de GitHub ; macOS seulement sur le runner `macos-latest` de GitHub (gratuit pour un dépôt public).
- **Chemins** : le code utilise `path.join` partout ; les seuls chemins Windows en dur (Git Bash, fichier hosts) sont déjà derrière un test de plateforme.

## Plan proposé

| Étape | Contenu | Taille | Version |
|---|---|---|---|
| 1 | Linux : Bash et Zsh dans le terminal, ouvrir un terminal, secrets (`basic_text` signalé), démarrage avec la session, textes selon le système | M | v3.3 |
| 2 | Linux : AppImage dans la release, mises à jour, CI Ubuntu avec e2e, page Installation du site | M | v3.3 |
| 3 | macOS : décider la signature (compte développeur ou non) | — | — |
| 4 | macOS : `dmg`, Terminal.app, Dock, CI `macos-latest`, signature et notarisation si décidées | M | v3.4 |

**Fini quand** (portage) : une AppImage installée sous Linux passe les 7 étapes du parcours d'un inconnu (lot 6 de la [v3.0](../roadmap/v3.0.md)) et se met à jour toute seule.
