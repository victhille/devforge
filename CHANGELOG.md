# Notes de version

Toutes les versions de DevForge. Format : [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), versions [SemVer](https://semver.org/lang/fr/).

## [2.1.0-beta.4](https://github.com/victhille/devforge/compare/v2.1.0-beta.3...v2.1.0-beta.4) — 2026-10-23

> Tes automatisations Automations s'affichent sur l'accueil de DevForge, et Forgy peut lire leur flux.

### Nouveautés

- **automations** : Widget Automatisations et lecture du flux par Forgy ([ac6ca1f](https://github.com/victhille/devforge/commit/ac6ca1f1f1269b5eb9f52700352c4997ad5bc815))

## [2.1.0-beta.3](https://github.com/victhille/devforge/compare/v2.1.0-beta.2...v2.1.0-beta.3) — 2026-10-23

> Les mises à jour arrivent enfin toutes seules : DevForge lit les versions avec ta connexion GitHub CLI, et le bouton « Mettre à jour » apparaît à côté de Forgy.

### Corrections

- **updates** : Lire les versions du dépôt privé avec le jeton de GitHub CLI ([6fd7b84](https://github.com/victhille/devforge/commit/6fd7b84899122c08c75ccdce621c1b3f3cd95d75))

## [2.1.0-beta.2](https://github.com/victhille/devforge/compare/v2.1.0-beta.1...v2.1.0-beta.2) — 2026-10-23

> Sauvegardes de nuit du VPS avec copie sur le PC, accueil à composer soi-même, palette qui agit, mode compact, .env synchronisés avec le serveur, GitHub sur la page projet, et Forgy qui veille sur le VPS.

### Nouveautés

- Synchronisation des .env, GitHub sur la page projet, Forgy plus complet ([1412c5d](https://github.com/victhille/devforge/commit/1412c5d0da1a2acf6ed4bf6a810f8f36ade478a7))
- **home** : Accueil personnalisable, palette avec actions, mode compact ([7165e94](https://github.com/victhille/devforge/commit/7165e941ad1131fe18b0f2e15d7bd1149c73447b))
- **backups** : Sauvegardes automatiques du VPS ([ce3b025](https://github.com/victhille/devforge/commit/ce3b025bcdc53142ed18a42ebb79984e81af3201))

## [2.1.0-beta.1](https://github.com/victhille/devforge/compare/v2.0.0...v2.1.0-beta.1) — 2026-10-22

> Un bouton « Mettre à jour » à côté de Forgy, et ton VPS sous contrôle : ses services web s'ouvrent en un clic, et une page Santé signale ce qui demande ton attention.

### Nouveautés

- **vps** : Bouton Mise à jour, services et santé du VPS ([5dca864](https://github.com/victhille/devforge/commit/5dca864aaa6b301f8caf5065de0323aab020021d))

### Corrections

- **i18n** : Pas de texte vide pour les niveaux de santé impossibles ([d6f467d](https://github.com/victhille/devforge/commit/d6f467dc059d6de1cef7cf3d80681cb8e30c20ff))

_1 changement(s) technique(s) (tests, CI, documentation du dépôt) non listé(s)._

## [2.0.0](https://github.com/victhille/devforge/compare/v2.0.0-beta.5...v2.0.0) — 2026-10-22

> DevForge 2.0 : Forgy agit pour toi, n8n s'installe et se pilote sur ton VPS (aussi en français), une page VPN pour WireGuard, Vercel, la dictée vocale en local, des paramètres et un menu à ton goût.

### Nouveautés

- **menu** : Favoris du menu au choix ([0d8f5f3](https://github.com/victhille/devforge/commit/0d8f5f3bdcc8db4fa10485b3fcf14ed307781767))

### Corrections

- **ssh** : Requêtes HTTP par la session SSH (wg-easy 408, clé d'API n8n) ([cfd4107](https://github.com/victhille/devforge/commit/cfd410730bc6d222a76254ecd2e2481932e038e9))

## [2.0.0-beta.5](https://github.com/victhille/devforge/compare/v2.0.0-beta.4...v2.0.0-beta.5) — 2026-10-22

> Nouvelle page VPN : les clients WireGuard du VPS, avec ajout, suppression et QR code, sans ligne de commande.

### Nouveautés

- **vpn** : Page VPN pour le WireGuard du VPS (wg-easy) ([f107860](https://github.com/victhille/devforge/commit/f1078600d0dee28d3bc5b18dd61b20ef45631a4f))

### Corrections

- **ui** : Sélecteurs alignés avec les boutons, version au-dessus de « Réduire le menu » ([2e4632d](https://github.com/victhille/devforge/commit/2e4632dda0997daf2e8746947df56df08609b38a))

_2 changement(s) technique(s) (tests, CI, documentation du dépôt) non listé(s)._

## [2.0.0-beta.4](https://github.com/victhille/devforge/compare/v2.0.0-beta.3...v2.0.0-beta.4) — 2026-10-20

> n8n s'ouvre seulement quand son éditeur est prêt : plus de « Cannot GET / » juste après un démarrage.

### Corrections

- **n8n** : Attendre l'éditeur avant d'annoncer que n8n est prêt ([d163a8d](https://github.com/victhille/devforge/commit/d163a8dc4d68c0b548d63db7b8399526c9eea9eb))

## [2.0.0-beta.3](https://github.com/victhille/devforge/compare/v2.0.0-beta.2...v2.0.0-beta.3) — 2026-10-20

> n8n peut s'afficher en français : une option sur la page n8n utilise la traduction communautaire, mise à jour à chaque version.

### Nouveautés

- **n8n** : Interface de n8n en français ([f83a32d](https://github.com/victhille/devforge/commit/f83a32df23758f5d4dc8903bc333227fa61d1431))

## [2.0.0-beta.2](https://github.com/victhille/devforge/compare/v2.0.0-beta.1...v2.0.0-beta.2) — 2026-10-20

> n8n s'ouvre depuis DevForge sans commande, et le domaine est vérifié avant l'installation.

### Corrections

- **n8n** : N8n s'ouvre depuis DevForge sans commande, le sous-domaine est vérifié avant l'installation HTTPS, et l'ancien Caddy est retiré ([3e07965](https://github.com/victhille/devforge/commit/3e0796573e688197574e1b3ceaac1703daa129bc))

## [2.0.0-beta.1](https://github.com/victhille/devforge/compare/v1.5.0...v2.0.0-beta.1) — 2026-10-20

> DevForge 2.0 : Forgy agit, une page par projet, le VPS surveillé, n8n et Vercel.

### Nouveautés

- Dictée Whisper sur ton PC, premier démarrage guidé, meilleure accessibilité (clavier, contrastes) et CPU des services Docker ([1d0366a](https://github.com/victhille/devforge/commit/1d0366ae1554bcca1ad8478f97f108bfef765a5d))
- Paramètres et notes de version repensés, fenêtre « Quoi de neuf », n8n installé et suivi sur le VPS, déploiements Vercel sur la page projet ([0264ac2](https://github.com/victhille/devforge/commit/0264ac2bf75376957f3ba28115cf9a8c9144979e))
- **monitor** : Surveillance du VPS en arrière-plan avec 7 jours d'historique, courbes 24 h, alertes, et Docker sur le VPS ([7176d77](https://github.com/victhille/devforge/commit/7176d77e811826a95f870136f85330bb3617506e))
- **projects** : Page projet qui réunit Git, Docker, variables, bases, logs, ports et déploiement, avec un projet actif suivi par Forgy et l'accueil ([1973870](https://github.com/victhille/devforge/commit/1973870fb7e39e26a2a99490810568505b959a2e))
- **assistant** : Forgy peut agir : commit, Compose, SQL, ports, scripts, variables .env, toujours après ta validation, avec journal et annulation ([298a5f2](https://github.com/victhille/devforge/commit/298a5f29f487553cae1cebd6e30b61151605a3de))
- Bases de la v2 : données versionnées et sauvegardées, journal local avec rapport de diagnostic, canal bêta, thème clair revu ([f2581d2](https://github.com/victhille/devforge/commit/f2581d2b52cc27ee58b0e373d73e4c9312a247ff))

## [1.5.0](https://github.com/victhille/devforge/compare/v1.4.1...v1.5.0) — 2026-10-19

> DevForge change de tête : menu repensé, accueil vivant, et Forgy qui se promène avec Boulon.

### Nouveautés

- Nouveau design : menu repensé, accueil vivant, panneau Forgy, pages refaites, Forgy se promène avec Boulon et widget de bureau ([3260e55](https://github.com/victhille/devforge/commit/3260e55c94c7707bc823420a483f058c5ed7fbae))

## [1.4.1](https://github.com/victhille/devforge/compare/v1.4.0...v1.4.1) — 2026-10-18

> Une application plus fluide, surtout quand elle tourne en arrière-plan.

### Performances

- Application plus fluide : la mascotte ne consomme plus rien au repos, pages Git et Docker plus rapides ([c2c739e](https://github.com/victhille/devforge/commit/c2c739e5e17fc765fc6e9e0ec0d487b27fac6285))

## [1.4.0](https://github.com/victhille/devforge/compare/v1.3.0...v1.4.0) — 2026-10-18

> Arrivée de Forgy, l'assistant qui connaît ton projet et la page où tu es.

### Nouveautés

- **assistant** : Recherche web dans l'assistant (avec sources) et raccourcis vers Claude Code, Codex, Antigravity, Gemini et les apps web ([e093320](https://github.com/victhille/devforge/commit/e093320e242818181c5256f77bfca948d11d7558))
- **assistant** : Forgy, le petit robot de l'assistant, montre ce qu'il fait (réfléchit, cherche, écrit, a fini…) ([70a57d3](https://github.com/victhille/devforge/commit/70a57d3ad3208122e21d40df90a8fed95c3d1f0a))
- **assistant** : Tâches prêtes à l'emploi et maîtrise du coût de l'assistant (modèle adapté à chaque tâche, budget mensuel) ([96c722a](https://github.com/victhille/devforge/commit/96c722a05296734d92d7246f536338eb8b1b7c28))
- **assistant** : Assistant IA intégré (Ctrl+J) qui connaît le projet et la page en cours, en lecture seule ([5c60467](https://github.com/victhille/devforge/commit/5c60467bc19a5203db1757404071a65cd3aed8e6))

### Corrections

- **settings** : « Voir les nouveautés » ouvre aussi les notes quand on est déjà sur la page Paramètres ([5776309](https://github.com/victhille/devforge/commit/5776309ec58a767ede609a545082565bbc5a59c8))

_1 changement(s) technique(s) (tests, CI, documentation du dépôt) non listé(s)._

## [1.3.0](https://github.com/victhille/devforge/compare/v1.2.2...v1.3.0) — 2026-10-18

> L'API Tester sait afficher les pages HTML.

### Nouveautés

- **api-tester** : Aperçu des réponses HTML et onglet des en-têtes de réponse dans l'API Tester ([82f9300](https://github.com/victhille/devforge/commit/82f9300616e1dfd3b0b12528520b19541881eae8))

## [1.2.2](https://github.com/victhille/devforge/compare/v1.2.1...v1.2.2) — 2026-10-18

### Corrections

- **i18n** : Le message de mise à jour et le démarrage de l'application respectent la langue choisie ([6a2acde](https://github.com/victhille/devforge/commit/6a2acde8d9902e059431bb7cf9922d07868926d5))

## [1.2.1](https://github.com/victhille/devforge/compare/v1.2.0...v1.2.1) — 2026-10-18

### Corrections

- **release** : Notes de version dans la langue de l'application (français ou anglais) ([52fd18a](https://github.com/victhille/devforge/commit/52fd18a2535e046739a79acb5becdd2119ca431b))

_2 changement(s) technique(s) (tests, CI, documentation du dépôt) non listé(s)._

## [1.2.0](https://github.com/victhille/devforge/compare/v1.1.0...v1.2.0) — 2026-10-18

### Nouveautés

- **versions** : Versions automatiques à partir des commits, notes de version et publication sur GitHub ([00cad77](https://github.com/victhille/devforge/commit/00cad77b4900085b0792f3dcd070d4e1c03202b3))
- Explorateur de base façon phpMyAdmin (structure, index, relations, infos) et panneau des connexions rétractable ([cc30530](https://github.com/victhille/devforge/commit/cc305308c6139e7ad7b2378ce52235daccfcfc90))
- **base de données** : Plus de plantage quand le serveur coupe la connexion (ex. arrêt d'un conteneur) : reconnexion automatique ([b320fbb](https://github.com/victhille/devforge/commit/b320fbb2bfc6397fd5965b6626f51d7e8dd54b72))
- **docker** : Les projets Compose affichent leurs services, le projet DevForge lié passe en légende ([fc37cc1](https://github.com/victhille/devforge/commit/fc37cc14306d6d4c94e691131585a969196a36c3))
- **docker** : Lancer les projets Compose depuis DevForge, nettoyage qui épargne leurs conteneurs, détection des bases depuis le compose ([6ab43ed](https://github.com/victhille/devforge/commit/6ab43ed6d500938c7b68c97667c0b664d8d5264a))
- **BDD via SSH** : Essai aussi de l'adresse publique du serveur, depuis le serveur ([4040f7d](https://github.com/victhille/devforge/commit/4040f7d0cbe566f899c20af0dc2045dc8470745f))
- **BDD via SSH** : Recherche de la base dans les conteneurs Docker du serveur quand son adresse ne répond pas ([3696e67](https://github.com/victhille/devforge/commit/3696e67bfaf17645b355098f61c3772dff26ce30))
- **base de données** : Accès aux bases hébergées sur un serveur SSH enregistré via un tunnel SSH automatique ([2a5bd60](https://github.com/victhille/devforge/commit/2a5bd603b42c5dd56b307ab416be26237de3948c))
- Interface isolée (sandbox + CSP), le testeur d'API passe par le processus principal ([532d934](https://github.com/victhille/devforge/commit/532d934a98a00b6abef65bc6255b398823d5bfcb))

### Sécurité

- Vérification des clés des serveurs SSH (confiance à la première connexion) ([6bc543b](https://github.com/victhille/devforge/commit/6bc543be6e5c28c89fec1e80dd88cfd2d0700fa5))
- Plus d'injection de commandes via les chemins, URL ou noms de scripts ([ec42992](https://github.com/victhille/devforge/commit/ec42992047e21299655e830a9834da528eed9e00))

### Corrections

- Tests, lint et CI ; correction du cron (dimanche = 7) et des antislashs doublés dans les .env ([bc42178](https://github.com/victhille/devforge/commit/bc421782bd4d72dad28df784b83cb8f22815de85))
- Détection sur serveur distant : scripts correctement protégés pour le shell distant ([53bbc54](https://github.com/victhille/devforge/commit/53bbc54cb1b6fdc1917e99202195c4fbaa23645a))

### Dépendances et build

- Electron 29 → 44.5.1 et electron-builder 26 ([51cbe7a](https://github.com/victhille/devforge/commit/51cbe7a4ef1c9b93c0e4f1bd781600a2bf839a23))

## 1.1.0 — 2026-10-17

### Nouveautés

- Une seule suggestion de domaine par projet, même avec plusieurs serveurs de dev ([f12711d](https://github.com/victhille/devforge/commit/f12711db9b1fa8deb346de574230ecb2fa265e17))
- Détection des projets déployés sur un serveur et création des cibles de déploiement ([ea2c7eb](https://github.com/victhille/devforge/commit/ea2c7eb1634df6eb7e7ba8eff34f575f44cac6d2))
- Suggestions de fichiers de log, d’URL à surveiller et de domaines locaux depuis les projets ([4cfdd3f](https://github.com/victhille/devforge/commit/4cfdd3fec962a64f5096c0b215c30e7ce4b23d49))
- **base de données** : Tunnels SSH, détection sur serveur et import depuis les .env ([27cc1a4](https://github.com/victhille/devforge/commit/27cc1a4bf0e7ccc4459dbabacc121add0ada1aab))
- Barre latérale rétractable (icônes seules, Ctrl+B) et panneau des serveurs SSH ([7e7913f](https://github.com/victhille/devforge/commit/7e7913f4281284ad17b9e1088497e0046dc0f7e8))
- Suppression du « + » en double sur les boutons qui ont déjà une icône ([4ab4654](https://github.com/victhille/devforge/commit/4ab46541c5f1d902bcf69ec0a859036a12e08f87))
- Outils cron, timestamp et URL dans la boîte à outils ([f81f181](https://github.com/victhille/devforge/commit/f81f1814d558eb390e97744e7dbca294fbe994e4))
- Testeur de webhooks ([220974f](https://github.com/victhille/devforge/commit/220974fd8c6cde2f378ad1484ec2b36a23b2c094))
- Lecteur de fichiers de log en direct ([4d18232](https://github.com/victhille/devforge/commit/4d1823219a93e5518a41e113cdc9715ea7622179))
- Client de base de données (PostgreSQL, MySQL/MariaDB, SQLite) ([8ad3fb5](https://github.com/victhille/devforge/commit/8ad3fb5495b327814dda0808a406fc2d7fb0aaae))
- Domaines locaux (.test) avec reverse proxy intégré ([e84d654](https://github.com/victhille/devforge/commit/e84d65469856e8851ee7cda94a8dcb1a9821ead3))
- Surveillance d'URL en arrière-plan ([6ce2087](https://github.com/victhille/devforge/commit/6ce2087e47ac6ffac022f8b0486873676b481045))
- Déploiement en un clic via SSH ([c7d5d27](https://github.com/victhille/devforge/commit/c7d5d271cdd1b40232e71668979db12150c10728))
- Panneau Docker local ([c3dd44c](https://github.com/victhille/devforge/commit/c3dd44c58afe91f2715a258abdea293b3c2e8f1e))
- Assistant de commit et protection des pages contre les erreurs ([3ca5023](https://github.com/victhille/devforge/commit/3ca50238a5ee6f12a198e53ee70f58530ad10f6c))
- Lanceur de stacks ([786e944](https://github.com/victhille/devforge/commit/786e9441e373216a12547cbc53110ba63fb44fc2))
- Gestionnaire de .env et vérification des versions requises par les projets ([b325b8f](https://github.com/victhille/devforge/commit/b325b8f79d544b087ae75ac92d3f31ea63f9c7d0))
- Nettoyeur de disque et barre latérale réorganisée ([d496858](https://github.com/victhille/devforge/commit/d496858dd64cc7c1562fa18929220cded7f6e33c))
- Tableau de bord Git multi-projets et notifications ([127c46a](https://github.com/victhille/devforge/commit/127c46a9f4ee7ef4d3f4fc5dd353963ac3db2640))
- Palette de commandes (Ctrl+K) et registre de navigation unique ([615e2a4](https://github.com/victhille/devforge/commit/615e2a4b59d042b39b286d21822bfb80baab62bc))
- Processus principal non bloquant, pages chargées à la demande, interface plus aérée ([344376d](https://github.com/victhille/devforge/commit/344376dce4606f3d808c090438462a2f2796f5e1))
- Mots de passe SSH chiffrés (safeStorage), suppression de code inutilisé ([f368250](https://github.com/victhille/devforge/commit/f368250f6d87edcd6e3f7478c6473feddf841866))
- État initial de DevForge ([0146628](https://github.com/victhille/devforge/commit/014662859d2afacec261577e6b15b21e8fd46cfb))

### Corrections

- Affichage des chemins des logs suggérés sous Windows ([fed7485](https://github.com/victhille/devforge/commit/fed74851e69330bcaafd14860c7e501f77f5f06f))
- Conflit de couleur du texte, refonte de la navigation, des onglets et des boutons ([dd32e2e](https://github.com/victhille/devforge/commit/dd32e2e99dc53d9df02aaa8a202a52247c6e1854))

### Améliorations internes

- Conversion des derniers fichiers CRLF en LF ([f0da60d](https://github.com/victhille/devforge/commit/f0da60d851c576bcd926b500b2ac1231216ed3e8))
- Fins de ligne normalisées en LF (.gitattributes) ([84d437a](https://github.com/victhille/devforge/commit/84d437afc96e46c4e5193097562802a0fbff0f73))
- Messages git attendus masqués dans getGitStatus ([faaa833](https://github.com/victhille/devforge/commit/faaa833844e8eb98d29137a40401eff36ebf72a2))
- Interface passée à Tailwind v4, gros fichiers découpés ([5b4ee84](https://github.com/victhille/devforge/commit/5b4ee8458c66321fdf3dec94b5258c254e044d4f))
- Architecture réorganisée par fonctionnalité ([32dd6f5](https://github.com/victhille/devforge/commit/32dd6f5efc59f243e50584b66ec227020bc171b9))
