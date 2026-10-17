import { useState } from 'react'
import { Search, Copy, Check } from 'lucide-react'
import FrameworkIcon from '@renderer/components/ui/FrameworkIcon'
import styles from './DocsPage.module.css'

// ─── Types ────────────────────────────────────────────────────────────────────

interface DocEntry {
  cmd:      string
  desc:     string
  example?: string
}

interface DocSection {
  title:   string
  entries: DocEntry[]
}

interface DocTech {
  id:       string
  name:     string
  color:    string
  sections: DocSection[]
}

// ─── Content ──────────────────────────────────────────────────────────────────

const DOCS: DocTech[] = [
  // ── Docker ────────────────────────────────────────────────────────────────
  {
    id: 'docker', name: 'Docker', color: '#2496ED',
    sections: [
      {
        title: 'Conteneurs', entries: [
          { cmd: 'docker ps',                              desc: 'Lister les conteneurs actifs' },
          { cmd: 'docker ps -a',                           desc: 'Lister tous les conteneurs (y compris arrêtés)' },
          { cmd: 'docker run -d --name <nom> <image>',     desc: 'Démarrer un conteneur en arrière-plan' },
          { cmd: 'docker run -it <image> bash',            desc: 'Démarrer un conteneur en mode interactif' },
          { cmd: 'docker run -p 8080:80 <image>',          desc: 'Mapper un port hôte vers le conteneur' },
          { cmd: 'docker run -v /local:/container <image>',desc: 'Monter un volume hôte dans le conteneur' },
          { cmd: 'docker start <nom>',                     desc: 'Démarrer un conteneur arrêté' },
          { cmd: 'docker stop <nom>',                      desc: 'Arrêter un conteneur proprement' },
          { cmd: 'docker restart <nom>',                   desc: 'Redémarrer un conteneur' },
          { cmd: 'docker rm <nom>',                        desc: 'Supprimer un conteneur arrêté' },
          { cmd: 'docker rm -f <nom>',                     desc: 'Forcer la suppression (même actif)' },
          { cmd: 'docker exec -it <nom> bash',             desc: 'Ouvrir un shell dans un conteneur actif' },
          { cmd: 'docker logs <nom>',                      desc: 'Voir les logs du conteneur' },
          { cmd: 'docker logs -f <nom>',                   desc: 'Suivre les logs en temps réel' },
          { cmd: 'docker logs --tail 100 <nom>',           desc: 'Voir les 100 dernières lignes de logs' },
          { cmd: 'docker inspect <nom>',                   desc: 'Détails complets du conteneur (JSON)' },
          { cmd: 'docker stats',                           desc: 'Statistiques en temps réel de tous les conteneurs' },
          { cmd: 'docker cp <nom>:/path /local',           desc: 'Copier un fichier depuis le conteneur' },
          { cmd: 'docker rename <ancien> <nouveau>',       desc: 'Renommer un conteneur' },
        ]
      },
      {
        title: 'Images', entries: [
          { cmd: 'docker images',                     desc: 'Lister les images locales' },
          { cmd: 'docker pull <image>:<tag>',         desc: 'Télécharger une image depuis Docker Hub' },
          { cmd: 'docker build -t <nom>:<tag> .',     desc: 'Construire une image depuis le Dockerfile courant' },
          { cmd: 'docker build -f <fichier> .',       desc: 'Utiliser un Dockerfile spécifique' },
          { cmd: 'docker rmi <image>',                desc: 'Supprimer une image locale' },
          { cmd: 'docker image prune',                desc: 'Supprimer les images sans conteneur associé' },
          { cmd: 'docker image prune -a',             desc: 'Supprimer toutes les images inutilisées' },
          { cmd: 'docker tag <image> <nouveau-nom>',  desc: 'Tagger une image' },
          { cmd: 'docker push <image>',               desc: 'Pousser une image vers un registry' },
          { cmd: 'docker history <image>',            desc: 'Voir les couches d\'une image' },
          { cmd: 'docker save -o img.tar <image>',    desc: 'Exporter une image en fichier tar' },
          { cmd: 'docker load -i img.tar',            desc: 'Importer une image depuis un tar' },
        ]
      },
      {
        title: 'Docker Compose', entries: [
          { cmd: 'docker compose up -d',              desc: 'Démarrer tous les services en arrière-plan' },
          { cmd: 'docker compose up --build',         desc: 'Reconstruire les images et démarrer' },
          { cmd: 'docker compose down',               desc: 'Arrêter et supprimer les conteneurs' },
          { cmd: 'docker compose down -v',            desc: 'Supprimer aussi les volumes' },
          { cmd: 'docker compose ps',                 desc: 'État des services' },
          { cmd: 'docker compose logs -f',            desc: 'Suivre les logs de tous les services' },
          { cmd: 'docker compose logs -f <service>',  desc: 'Suivre les logs d\'un service spécifique' },
          { cmd: 'docker compose build',              desc: 'Reconstruire les images sans démarrer' },
          { cmd: 'docker compose pull',               desc: 'Mettre à jour toutes les images' },
          { cmd: 'docker compose restart <service>',  desc: 'Redémarrer un service' },
          { cmd: 'docker compose exec <service> bash',desc: 'Shell dans un service' },
          { cmd: 'docker compose stop',               desc: 'Arrêter sans supprimer' },
          { cmd: 'docker compose start',              desc: 'Redémarrer des services arrêtés' },
          { cmd: 'docker compose scale web=3',        desc: 'Scaler un service à N instances' },
        ]
      },
      {
        title: 'Réseau & Volumes', entries: [
          { cmd: 'docker network ls',                     desc: 'Lister les réseaux' },
          { cmd: 'docker network create <nom>',           desc: 'Créer un réseau personnalisé' },
          { cmd: 'docker network connect <réseau> <ctn>', desc: 'Connecter un conteneur à un réseau' },
          { cmd: 'docker network inspect <réseau>',       desc: 'Détails d\'un réseau' },
          { cmd: 'docker volume ls',                      desc: 'Lister les volumes' },
          { cmd: 'docker volume create <nom>',            desc: 'Créer un volume nommé' },
          { cmd: 'docker volume rm <nom>',                desc: 'Supprimer un volume' },
          { cmd: 'docker volume prune',                   desc: 'Supprimer les volumes inutilisés' },
          { cmd: 'docker system prune',                   desc: 'Nettoyer tout ce qui est inutilisé' },
          { cmd: 'docker system prune -a --volumes',      desc: 'Nettoyage complet (images + volumes)' },
          { cmd: 'docker system df',                      desc: 'Espace utilisé par Docker' },
        ]
      },
    ]
  },

  // ── React ──────────────────────────────────────────────────────────────────
  {
    id: 'react', name: 'React', color: '#61DAFB',
    sections: [
      {
        title: 'Hooks essentiels', entries: [
          { cmd: 'useState(initialValue)',           desc: 'État local du composant', example: 'const [count, setCount] = useState(0)' },
          { cmd: 'useEffect(fn, deps)',              desc: 'Effets de bord, fetch, abonnements', example: 'useEffect(() => { fetch(url) }, [url])' },
          { cmd: 'useRef(initial)',                  desc: 'Référence DOM ou valeur persistante', example: 'const ref = useRef<HTMLDivElement>(null)' },
          { cmd: 'useContext(Context)',              desc: 'Consommer un contexte React', example: 'const theme = useContext(ThemeContext)' },
          { cmd: 'useMemo(fn, deps)',                desc: 'Mémoïser une valeur calculée coûteuse', example: 'const sorted = useMemo(() => list.sort(), [list])' },
          { cmd: 'useCallback(fn, deps)',            desc: 'Mémoïser une fonction (éviter les re-renders)', example: 'const fn = useCallback(() => doSomething(), [dep])' },
          { cmd: 'useReducer(reducer, init)',        desc: 'Gestion d\'état complexe avec reducer', example: 'const [state, dispatch] = useReducer(reducer, {})' },
          { cmd: 'useId()',                          desc: 'Générer un ID stable et unique' },
          { cmd: 'useTransition()',                  desc: 'Marquer des mises à jour non urgentes' },
          { cmd: 'useDeferredValue(value)',          desc: 'Reporter la mise à jour d\'une valeur' },
        ]
      },
      {
        title: 'Patterns & Composition', entries: [
          { cmd: 'React.memo(Component)',            desc: 'Éviter le re-render si les props n\'ont pas changé' },
          { cmd: 'createContext(defaultValue)',      desc: 'Créer un contexte partageable entre composants', example: 'const ThemeCtx = createContext("light")' },
          { cmd: 'forwardRef((props, ref) => ...)', desc: 'Passer une ref vers un composant enfant' },
          { cmd: 'React.lazy(() => import(...))',   desc: 'Charger un composant en code-splitting' },
          { cmd: '<Suspense fallback={...}>',        desc: 'Afficher un fallback pendant le chargement lazy' },
          { cmd: '<ErrorBoundary>',                  desc: 'Capturer les erreurs de rendu enfant' },
          { cmd: 'children prop',                    desc: 'Composition de composants via enfants', example: '<Card><Content /></Card>' },
          { cmd: 'Custom Hook',                      desc: 'Extraire de la logique dans un hook réutilisable', example: 'function useDebounce(value, delay) { ... }' },
        ]
      },
      {
        title: 'Performance', entries: [
          { cmd: 'React DevTools Profiler',          desc: 'Identifier les composants qui re-rendent inutilement' },
          { cmd: 'key={id}',                         desc: 'Toujours utiliser une clé stable dans les listes' },
          { cmd: 'Virtualisation (react-window)',    desc: 'Rendre uniquement les éléments visibles d\'une longue liste' },
          { cmd: 'Code splitting (lazy + Suspense)', desc: 'Charger les routes/composants à la demande' },
          { cmd: 'Éviter les objets inline',         desc: 'Créer des objets/tableaux en dehors du JSX pour éviter les re-renders' },
        ]
      },
    ]
  },

  // ── Vue ───────────────────────────────────────────────────────────────────
  {
    id: 'vue', name: 'Vue 3', color: '#42B883',
    sections: [
      {
        title: 'Composition API', entries: [
          { cmd: 'ref(value)',              desc: 'Valeur réactive primitive', example: 'const count = ref(0); count.value++' },
          { cmd: 'reactive(obj)',           desc: 'Objet entièrement réactif', example: 'const state = reactive({ name: "", age: 0 })' },
          { cmd: 'computed(() => ...)',     desc: 'Valeur dérivée calculée automatiquement', example: 'const double = computed(() => count.value * 2)' },
          { cmd: 'watch(source, fn)',       desc: 'Observer un changement de réf/computed' },
          { cmd: 'watchEffect(fn)',         desc: 'Effet automatique qui piste ses dépendances' },
          { cmd: 'onMounted(fn)',           desc: 'Hook exécuté après le montage du composant' },
          { cmd: 'onUnmounted(fn)',         desc: 'Nettoyage avant destruction' },
          { cmd: 'onUpdated(fn)',           desc: 'Après chaque mise à jour du DOM' },
          { cmd: 'provide / inject',        desc: 'Passer des données en profondeur sans props' },
        ]
      },
      {
        title: 'Template', entries: [
          { cmd: 'v-bind  :prop="val"',    desc: 'Liaison d\'attribut dynamique' },
          { cmd: 'v-on  @click="fn"',      desc: 'Écouter un événement' },
          { cmd: 'v-model',                desc: 'Liaison bidirectionnelle (input ↔ réf)' },
          { cmd: 'v-if / v-else',          desc: 'Rendu conditionnel' },
          { cmd: 'v-for="item in list"',   desc: 'Boucle de rendu', example: '<li v-for="i in items" :key="i.id">{{ i.name }}</li>' },
          { cmd: 'v-show',                 desc: 'Masquer avec display:none (reste monté)' },
          { cmd: ':class="{ active: ok }"',desc: 'Classes conditionnelles' },
          { cmd: 'defineProps / defineEmits',desc: 'Déclarer props et événements dans <script setup>' },
        ]
      },
    ]
  },

  // ── Symfony ───────────────────────────────────────────────────────────────
  {
    id: 'symfony', name: 'Symfony', color: '#000000',
    sections: [
      {
        title: 'Console (Make)', entries: [
          { cmd: 'php bin/console make:controller NomController',   desc: 'Créer un contrôleur' },
          { cmd: 'php bin/console make:entity',                     desc: 'Créer ou modifier une entité Doctrine' },
          { cmd: 'php bin/console make:migration',                  desc: 'Générer un fichier de migration' },
          { cmd: 'php bin/console doctrine:migrations:migrate',     desc: 'Exécuter les migrations en attente' },
          { cmd: 'php bin/console doctrine:schema:update --force',  desc: 'Mettre à jour le schéma (dev uniquement)' },
          { cmd: 'php bin/console make:form',                       desc: 'Créer un type de formulaire' },
          { cmd: 'php bin/console make:user',                       desc: 'Créer l\'entité User + sécurité' },
          { cmd: 'php bin/console make:auth',                       desc: 'Générer l\'authentification' },
          { cmd: 'php bin/console make:crud',                       desc: 'Générer un CRUD complet' },
          { cmd: 'php bin/console make:test',                       desc: 'Créer une classe de test' },
          { cmd: 'php bin/console make:command',                    desc: 'Créer une commande Symfony custom' },
          { cmd: 'php bin/console make:event',                      desc: 'Créer un événement + listener' },
          { cmd: 'php bin/console make:serializer:encoder',         desc: 'Créer un encodeur de sérialisation' },
        ]
      },
      {
        title: 'Debug & Routes', entries: [
          { cmd: 'php bin/console debug:router',        desc: 'Lister toutes les routes' },
          { cmd: 'php bin/console debug:router <route>',desc: 'Détail d\'une route spécifique' },
          { cmd: 'php bin/console debug:container',     desc: 'Lister les services du conteneur' },
          { cmd: 'php bin/console debug:autowiring',    desc: 'Types autoinjectable (autowiring)' },
          { cmd: 'php bin/console debug:config',        desc: 'Configuration des bundles' },
          { cmd: 'php bin/console debug:event-dispatcher', desc: 'Événements et listeners' },
          { cmd: 'php bin/console debug:dotenv',        desc: 'Variables d\'environnement chargées' },
        ]
      },
      {
        title: 'Cache & Assets', entries: [
          { cmd: 'php bin/console cache:clear',          desc: 'Vider le cache (dev/prod)' },
          { cmd: 'php bin/console cache:warmup',         desc: 'Préchauffer le cache de prod' },
          { cmd: 'php bin/console assets:install',       desc: 'Installer les assets dans /public' },
          { cmd: 'php bin/console importmap:require npm:lib', desc: 'Ajouter une lib JS via AssetMapper' },
        ]
      },
      {
        title: 'Doctrine', entries: [
          { cmd: 'php bin/console doctrine:database:create',  desc: 'Créer la base de données' },
          { cmd: 'php bin/console doctrine:database:drop',    desc: 'Supprimer la base de données' },
          { cmd: 'php bin/console doctrine:fixtures:load',    desc: 'Charger les fixtures (données de test)' },
          { cmd: 'php bin/console doctrine:query:sql "SELECT ..."', desc: 'Exécuter une requête SQL directe' },
          { cmd: 'php bin/console doctrine:mapping:info',     desc: 'Infos sur le mapping des entités' },
        ]
      },
    ]
  },

  // ── Node.js / npm ──────────────────────────────────────────────────────────
  {
    id: 'nodejs', name: 'Node.js / npm', color: '#5FA04E',
    sections: [
      {
        title: 'npm', entries: [
          { cmd: 'npm init -y',                  desc: 'Initialiser un projet avec package.json par défaut' },
          { cmd: 'npm install',                  desc: 'Installer toutes les dépendances du projet' },
          { cmd: 'npm install <pkg>',            desc: 'Ajouter une dépendance production' },
          { cmd: 'npm install -D <pkg>',         desc: 'Ajouter une dépendance de développement' },
          { cmd: 'npm install -g <pkg>',         desc: 'Installer un package globalement' },
          { cmd: 'npm uninstall <pkg>',          desc: 'Désinstaller un package' },
          { cmd: 'npm update',                   desc: 'Mettre à jour les dépendances' },
          { cmd: 'npm run <script>',             desc: 'Exécuter un script du package.json' },
          { cmd: 'npm run dev',                  desc: 'Démarrer en mode développement (convention)' },
          { cmd: 'npm run build',                desc: 'Builder pour la production (convention)' },
          { cmd: 'npm list --depth=0',           desc: 'Lister les packages installés' },
          { cmd: 'npm outdated',                 desc: 'Voir les packages avec une mise à jour disponible' },
          { cmd: 'npm audit',                    desc: 'Vérifier les vulnérabilités de sécurité' },
          { cmd: 'npm audit fix',                desc: 'Corriger automatiquement les vulnérabilités' },
          { cmd: 'npx <pkg>',                    desc: 'Exécuter un package sans installation permanente' },
        ]
      },
      {
        title: 'Modules & Async', entries: [
          { cmd: 'import { fn } from "./module"',    desc: 'Import ES modules (ESM)' },
          { cmd: 'const { fn } = require("module")', desc: 'Import CommonJS (CJS)' },
          { cmd: 'export default / export { }',       desc: 'Exporter des valeurs (ESM)' },
          { cmd: 'async function fetchData() { }',    desc: 'Fonction asynchrone', example: 'const data = await fetch(url).then(r => r.json())' },
          { cmd: 'Promise.all([p1, p2])',             desc: 'Exécuter plusieurs Promises en parallèle' },
          { cmd: 'Promise.allSettled([p1, p2])',      desc: 'Attendre toutes les Promises (même si erreur)' },
          { cmd: 'process.env.NOM',                   desc: 'Lire une variable d\'environnement' },
          { cmd: 'process.argv',                      desc: 'Arguments de la ligne de commande' },
        ]
      },
    ]
  },

  // ── Git ───────────────────────────────────────────────────────────────────
  {
    id: 'git', name: 'Git', color: '#F05032',
    sections: [
      {
        title: 'Bases', entries: [
          { cmd: 'git init',                    desc: 'Initialiser un dépôt Git local' },
          { cmd: 'git clone <url>',             desc: 'Cloner un dépôt distant' },
          { cmd: 'git status',                  desc: 'État des fichiers (modifiés, staged, untracked)' },
          { cmd: 'git add <fichier>',           desc: 'Ajouter un fichier au stage' },
          { cmd: 'git add .',                   desc: 'Ajouter tous les fichiers modifiés au stage' },
          { cmd: 'git commit -m "message"',     desc: 'Enregistrer les changements stagés' },
          { cmd: 'git commit -am "message"',    desc: 'Stage + commit des fichiers trackés en une commande' },
          { cmd: 'git log --oneline',           desc: 'Historique compact des commits' },
          { cmd: 'git diff',                    desc: 'Voir les modifications non stagées' },
          { cmd: 'git diff --staged',           desc: 'Voir les modifications stagées' },
        ]
      },
      {
        title: 'Branches', entries: [
          { cmd: 'git branch',                  desc: 'Lister les branches locales' },
          { cmd: 'git branch <nom>',            desc: 'Créer une nouvelle branche' },
          { cmd: 'git switch <branche>',        desc: 'Changer de branche' },
          { cmd: 'git switch -c <branche>',     desc: 'Créer et basculer sur une nouvelle branche' },
          { cmd: 'git merge <branche>',         desc: 'Fusionner une branche dans la branche courante' },
          { cmd: 'git rebase <branche>',        desc: 'Rebaser la branche courante sur une autre' },
          { cmd: 'git branch -d <branche>',     desc: 'Supprimer une branche locale (fusionnée)' },
          { cmd: 'git branch -D <branche>',     desc: 'Forcer la suppression d\'une branche' },
          { cmd: 'git stash',                   desc: 'Sauvegarder temporairement les modifications' },
          { cmd: 'git stash pop',               desc: 'Restaurer le dernier stash' },
        ]
      },
      {
        title: 'Remote & Sync', entries: [
          { cmd: 'git remote -v',               desc: 'Lister les dépôts distants' },
          { cmd: 'git remote add origin <url>', desc: 'Ajouter un dépôt distant' },
          { cmd: 'git fetch',                   desc: 'Récupérer les changements distants sans les fusionner' },
          { cmd: 'git pull',                    desc: 'Fetch + merge (ou rebase) de la branche distante' },
          { cmd: 'git push',                    desc: 'Pousser la branche courante vers l\'origin' },
          { cmd: 'git push -u origin <branche>',desc: 'Pousser et définir la branche upstream' },
          { cmd: 'git push --force-with-lease', desc: 'Force push sécurisé (préféré à --force)' },
          { cmd: 'git pull --rebase',           desc: 'Mettre à jour avec rebase plutôt que merge' },
        ]
      },
      {
        title: 'Corrections', entries: [
          { cmd: 'git restore <fichier>',       desc: 'Annuler les modifications d\'un fichier (non stagé)' },
          { cmd: 'git restore --staged <fich>', desc: 'Déstaguer un fichier sans annuler les modifs' },
          { cmd: 'git commit --amend',          desc: 'Modifier le dernier commit (message ou contenu)' },
          { cmd: 'git reset --soft HEAD~1',     desc: 'Annuler le dernier commit, garder les modifs stagées' },
          { cmd: 'git reset --hard HEAD~1',     desc: 'Annuler le dernier commit et les modifications' },
          { cmd: 'git revert <hash>',           desc: 'Créer un commit qui annule un commit passé' },
          { cmd: 'git cherry-pick <hash>',      desc: 'Appliquer un commit spécifique sur la branche courante' },
        ]
      },
    ]
  },

  // ── Linux / Shell ──────────────────────────────────────────────────────────
  {
    id: 'shell', name: 'Linux / Shell', color: '#89E051',
    sections: [
      {
        title: 'Fichiers & Dossiers', entries: [
          { cmd: 'ls -la',                           desc: 'Lister fichiers (y compris cachés) avec détails' },
          { cmd: 'cd <dossier>',                     desc: 'Changer de répertoire' },
          { cmd: 'pwd',                              desc: 'Afficher le chemin courant' },
          { cmd: 'mkdir -p <chemin>',                desc: 'Créer un dossier (et les parents si besoin)' },
          { cmd: 'cp -r <src> <dest>',               desc: 'Copier récursivement' },
          { cmd: 'mv <src> <dest>',                  desc: 'Déplacer ou renommer' },
          { cmd: 'rm -rf <chemin>',                  desc: 'Supprimer récursivement (sans confirmation !)' },
          { cmd: 'find . -name "*.log"',             desc: 'Chercher des fichiers par nom' },
          { cmd: 'grep -r "texte" .',                desc: 'Chercher du texte dans les fichiers' },
          { cmd: 'cat <fichier>',                    desc: 'Afficher le contenu d\'un fichier' },
          { cmd: 'tail -f <fichier>',                desc: 'Suivre un fichier en temps réel (logs)' },
          { cmd: 'head -n 50 <fichier>',             desc: 'Afficher les 50 premières lignes' },
          { cmd: 'wc -l <fichier>',                  desc: 'Compter les lignes d\'un fichier' },
          { cmd: 'chmod +x <fichier>',               desc: 'Rendre un fichier exécutable' },
          { cmd: 'chown user:group <fichier>',       desc: 'Changer le propriétaire' },
        ]
      },
      {
        title: 'Processus & Système', entries: [
          { cmd: 'ps aux',                  desc: 'Lister tous les processus' },
          { cmd: 'top / htop',              desc: 'Moniteur de processus interactif' },
          { cmd: 'kill <PID>',              desc: 'Envoyer SIGTERM à un processus' },
          { cmd: 'kill -9 <PID>',           desc: 'Forcer la fin d\'un processus' },
          { cmd: 'pkill <nom>',             desc: 'Tuer un processus par nom' },
          { cmd: 'df -h',                   desc: 'Espace disque disponible (human-readable)' },
          { cmd: 'du -sh <dossier>',        desc: 'Taille d\'un dossier' },
          { cmd: 'free -h',                 desc: 'RAM disponible et utilisée' },
          { cmd: 'uname -a',                desc: 'Infos sur le système et le kernel' },
          { cmd: 'uptime',                  desc: 'Durée d\'uptime et charge système' },
          { cmd: 'whoami',                  desc: 'Utilisateur courant' },
          { cmd: 'sudo <commande>',         desc: 'Exécuter en super-utilisateur' },
          { cmd: 'crontab -e',              desc: 'Éditer les tâches cron de l\'utilisateur' },
          { cmd: 'systemctl status <svc>',  desc: 'État d\'un service systemd' },
          { cmd: 'systemctl restart <svc>', desc: 'Redémarrer un service' },
          { cmd: 'journalctl -u <svc> -f',  desc: 'Suivre les logs d\'un service systemd' },
        ]
      },
      {
        title: 'Réseau', entries: [
          { cmd: 'curl -X GET <url>',        desc: 'Faire une requête HTTP GET' },
          { cmd: 'curl -X POST -d \'{}\' <url>',desc: 'Requête POST avec données JSON' },
          { cmd: 'wget <url>',               desc: 'Télécharger un fichier depuis une URL' },
          { cmd: 'ss -tlnp',                 desc: 'Ports TCP en écoute avec PID' },
          { cmd: 'netstat -tlnp',            desc: 'Ancienne commande ports en écoute' },
          { cmd: 'ip addr',                  desc: 'Interfaces réseau et adresses IP' },
          { cmd: 'ping <host>',              desc: 'Tester la connectivité vers un hôte' },
          { cmd: 'ssh user@host',            desc: 'Connexion SSH distante' },
          { cmd: 'scp <src> user@host:<dst>',desc: 'Copier un fichier via SSH' },
          { cmd: 'rsync -avz <src> <dst>',   desc: 'Synchroniser des fichiers efficacement' },
        ]
      },
    ]
  },

  // ── Python ────────────────────────────────────────────────────────────────
  {
    id: 'python', name: 'Python', color: '#3776AB',
    sections: [
      {
        title: 'Environnement', entries: [
          { cmd: 'python3 -m venv venv',         desc: 'Créer un environnement virtuel' },
          { cmd: 'source venv/bin/activate',      desc: 'Activer l\'env virtuel (Linux/Mac)' },
          { cmd: 'venv\\Scripts\\activate',       desc: 'Activer l\'env virtuel (Windows)' },
          { cmd: 'pip install <pkg>',             desc: 'Installer un package' },
          { cmd: 'pip install -r requirements.txt',desc: 'Installer depuis un fichier requirements' },
          { cmd: 'pip freeze > requirements.txt', desc: 'Générer le fichier requirements' },
          { cmd: 'pip list',                      desc: 'Lister les packages installés' },
          { cmd: 'pip show <pkg>',                desc: 'Détails d\'un package' },
          { cmd: 'pip uninstall <pkg>',           desc: 'Désinstaller un package' },
        ]
      },
      {
        title: 'Django / FastAPI', entries: [
          { cmd: 'django-admin startproject nom',      desc: 'Créer un projet Django' },
          { cmd: 'python manage.py startapp nom',      desc: 'Créer une app Django' },
          { cmd: 'python manage.py runserver',         desc: 'Démarrer le serveur de dev Django' },
          { cmd: 'python manage.py makemigrations',    desc: 'Générer les migrations' },
          { cmd: 'python manage.py migrate',           desc: 'Appliquer les migrations' },
          { cmd: 'python manage.py createsuperuser',   desc: 'Créer un super-utilisateur' },
          { cmd: 'uvicorn main:app --reload',          desc: 'Démarrer FastAPI avec hot-reload' },
          { cmd: 'pip install fastapi uvicorn',        desc: 'Installer FastAPI' },
        ]
      },
    ]
  },
]

// ─── Copy button ──────────────────────────────────────────────────────────────

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  function handleCopy() {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <button className={styles.copyBtn} onClick={handleCopy} title="Copier">
      {copied ? <Check size={11} /> : <Copy size={11} />}
    </button>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function DocsPage() {
  const [activeTech, setActiveTech] = useState(DOCS[0].id)
  const [search,     setSearch]     = useState('')

  const tech = DOCS.find(d => d.id === activeTech) ?? DOCS[0]

  const filtered = search.trim()
    ? tech.sections.map(s => ({
        ...s,
        entries: s.entries.filter(e =>
          e.cmd.toLowerCase().includes(search.toLowerCase()) ||
          e.desc.toLowerCase().includes(search.toLowerCase())
        )
      })).filter(s => s.entries.length > 0)
    : tech.sections

  return (
    <div className={styles.page}>
      {/* Left sidebar */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarTitle}>Référence rapide</div>
        {DOCS.map(doc => (
          <button
            key={doc.id}
            className={`${styles.techBtn} ${activeTech === doc.id ? styles.techBtnActive : ''}`}
            style={{ '--tech-color': doc.color } as React.CSSProperties}
            onClick={() => { setActiveTech(doc.id); setSearch('') }}
          >
            <FrameworkIcon name={doc.id as any} size={14} style={{ color: doc.color, flexShrink: 0 }} />
            <span>{doc.name}</span>
          </button>
        ))}
      </aside>

      {/* Main panel */}
      <div className={styles.main}>
        {/* Header */}
        <div className={styles.mainHeader}>
          <div className={styles.mainTitle}>
            <FrameworkIcon name={tech.id as any} size={18} style={{ color: tech.color }} />
            <span style={{ color: tech.color }}>{tech.name}</span>
          </div>
          <div className={styles.searchWrap}>
            <Search size={13} className={styles.searchIcon} />
            <input
              className={styles.searchInput}
              placeholder={`Rechercher dans ${tech.name}…`}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Sections */}
        <div className={styles.sections}>
          {filtered.map(section => (
            <div key={section.title} className={styles.section}>
              <h3 className={styles.sectionTitle}>{section.title}</h3>
              <div className={styles.entries}>
                {section.entries.map((entry, i) => (
                  <div key={i} className={styles.entry}>
                    <div className={styles.entryTop}>
                      <code className={styles.entryCmd}>{entry.cmd}</code>
                      <CopyBtn text={entry.example ?? entry.cmd} />
                    </div>
                    <span className={styles.entryDesc}>{entry.desc}</span>
                    {entry.example && (
                      <div className={styles.entryExample}>
                        <code>{entry.example}</code>
                        <CopyBtn text={entry.example} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className={styles.noResults}>Aucun résultat pour « {search} »</div>
          )}
        </div>
      </div>
    </div>
  )
}
