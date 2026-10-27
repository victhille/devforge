// Texts of the landing page, in the two languages of the app
export type Lang = 'fr' | 'en'

const fr = {
  title: "DevForge · L'atelier de dev sur Windows",
  description: "Projets, Git, Docker, serveurs SSH, bases de données, déploiements et Forgy, un assistant IA, dans une seule application de bureau gratuite et open source pour Windows.",
  nav: { features: 'Fonctions', forgy: 'Forgy', servers: 'Serveurs', docs: 'Documentation', download: 'Télécharger', other: 'English', otherShort: 'EN' },
  hero: {
    eyebrow: 'Gratuit · open source · Windows 10 et 11',
    title: ['Tout ton atelier de dev,', 'dans une seule fenêtre.'],
    lead: "Projets, Git, Docker, serveurs SSH, bases de données, déploiements et un assistant IA qui connaît ton code. DevForge réunit les outils que tu ouvres tous les jours, sans compte et sans rien envoyer ailleurs.",
    secondary: 'Prise en main',
    note: "Installeur non signé : Windows peut afficher une alerte SmartScreen.",
    noteLink: 'Pourquoi ?'
  },
  shots: [
    { id: 'home', label: 'Accueil', caption: "L'accueil : le projet actif, l'état Git de tous tes dépôts et ton activité." },
    { id: 'project', label: 'Projet', caption: 'Une fiche par projet : Git, Docker, variables, base, logs, ports, déploiement, scripts.' },
    { id: 'git', label: 'Git', caption: 'Tous tes dépôts : ce qui est modifié, à pousser ou à récupérer, et le commit guidé.' },
    { id: 'database', label: 'Base de données', caption: 'PostgreSQL, MySQL / MariaDB et SQLite, en direct ou par tunnel SSH.' },
    { id: 'env-files', label: 'Variables', caption: 'Les .env de tes projets comparés au modèle, valeurs masquées.' },
    { id: 'palette', label: 'Palette', caption: 'Ctrl K : une page, un projet, un script ou une action en quelques lettres.' },
    { id: 'toolbox', label: 'Outils', caption: 'JSON, Base64, JWT, regex, hash, cron, timestamp, URL : tout tourne sur ton PC.' }
  ],
  stats: [
    { value: '28', label: 'pages, rangées en 6 groupes' },
    { value: '0', label: 'compte à créer' },
    { value: 'FR · EN', label: "l'interface et l'assistant" },
    { value: 'MIT', label: 'licence libre' }
  ],
  featuresTitle: 'Le quotidien du dev, au même endroit',
  featuresLead: "Fini les dix fenêtres ouvertes. Chaque projet a sa fiche, chaque outil sa page, et tout se retrouve avec Ctrl K.",
  features: [
    {
      shot: 'project', kicker: 'Projets',
      title: 'Une fiche par projet, tout ce qui le concerne',
      text: "DevForge repère les projets de ton dossier et leur donne une page : état Git, conteneurs Compose, fichiers .env, base liée, logs suivis en direct, ports, cible de déploiement et scripts à lancer.",
      points: ['Création guidée : React, Next.js, Vue, Node.js, Symfony, Laravel', 'Ateliers Symfony, Next.js et Laravel : entités, migrations, API, fausses données', 'Terminal intégré où chaque commande devient un bloc'],
      link: 'dev/projects/'
    },
    {
      shot: 'git', kicker: 'Git et GitHub',
      title: "L'état de tous tes dépôts d'un coup d'œil",
      text: "Ce qui est modifié, à pousser ou à récupérer, sur tous tes projets. Fetch, pull, push et commit au format Conventional Commits, avec une suggestion de message.",
      points: ['GitHub Actions, pull requests et releases de chaque dépôt', 'Relancer les jobs en échec sans quitter DevForge', 'Tout fetch en un clic'],
      link: 'dev/git/'
    },
    {
      shot: 'database', kicker: 'Données et API',
      title: 'Tes bases, tes API et tes logs, sans autre outil',
      text: "Un client PostgreSQL, MySQL / MariaDB et SQLite qui trouve tout seul les bases de tes projets et de tes serveurs. À côté : un testeur d'API, un capteur de webhooks et un lecteur de logs en direct.",
      points: ['Parcourir, structure, relations, SQL', 'Tunnel SSH : rien à ouvrir sur le serveur', 'Logs colorés par niveau : Laravel, Symfony, nginx, pm2, JSON'],
      link: 'data/database/'
    }
  ],
  serversTitle: 'Ton serveur, piloté depuis ton PC',
  serversLead: "Ajoute un VPS en SSH : DevForge le surveille, le sauvegarde, et installe pour toi ce dont tu as besoin. Sans serveur, ces pages restent simplement de côté.",
  servers: [
    { icon: 'terminal', title: 'SSH et tableau de bord', text: 'Terminal à onglets, CPU, mémoire, disques, processus et conteneurs en direct.', link: 'servers/ssh/' },
    { icon: 'heart', title: 'Santé', text: 'Mises à jour, disque, ports ouverts, sécurité SSH, fail2ban, avec les corrections en un clic.', link: 'servers/health/' },
    { icon: 'backup', title: 'Sauvegardes de nuit', text: 'Faites par le serveur lui-même, copiées sur ton PC, restaurables en un clic.', link: 'servers/backups/' },
    { icon: 'deploy', title: 'Déploiement', text: 'Un serveur, un dossier, un script : déployer en un clic. Et Vercel, avec ses aperçus.', link: 'online/deploy/' },
    { icon: 'workflow', title: 'n8n', text: 'Installé sur ton VPS en HTTPS, tenu à jour, workflows et exécutions suivis.', link: 'online/n8n/' },
    { icon: 'shield', title: 'VPN WireGuard', text: 'Les clients wg-easy, leurs QR codes et leurs configurations.', link: 'online/vpn/' },
    { icon: 'radio', title: 'Page de statut', text: 'Une page publique surveillée 24 h/24 depuis le serveur, avec incidents et alertes.', link: 'online/status-page/' },
    { icon: 'activity', title: 'Monitoring', text: 'Tes sites et API vérifiés en arrière-plan, notification quand l’un tombe.', link: 'servers/monitoring/' }
  ],
  forgy: {
    kicker: "L'assistant",
    title: 'Forgy connaît ton code. Il agit seulement si tu valides.',
    text: "Forgy lit tes projets, tes logs, tes bases et la page que tu regardes pour répondre. Quand il propose d'agir (un commit, un conteneur à relancer, une requête SQL), une carte te montre exactement quoi : rien ne part avant ton clic.",
    points: [
      'Ta propre clé Anthropic, un budget mensuel que tu fixes',
      'Le modèle le moins cher qui fait la tâche, choisi tout seul',
      'Jamais de lecture des .env, des clés ni des mots de passe',
      'Sur le bureau avec Ctrl Alt Espace, et la dictée qui reste sur ton PC'
    ],
    link: 'Découvrir Forgy',
    mock: {
      name: 'Forgy', status: 'disponible · Haiku 5.5',
      question: 'Committe mes changements du panier',
      answer: "4 fichiers modifiés dans boutique-en-ligne, tous dans app/cart. Je propose ce commit :",
      cardTitle: 'Commit · boutique-en-ligne',
      cardMessage: 'feat(panier): total et frais de port',
      cardNote: 'Rien ne se passe avant ton clic. Annulable ensuite depuis le journal.',
      approve: 'Valider', refuse: 'Refuser',
      cost: '0,002 $ · 0,41 $ / 5 $'
    }
  },
  palette: {
    kicker: 'Au clavier',
    title: 'Ctrl K, et tu y es',
    text: "La palette trouve une page, un projet, un script, une stack ou une action. Le lanceur global fait pareil par-dessus n'importe quelle application, même DevForge réduit.",
    keys: [['Ctrl', 'K', 'Palette de commandes'], ['Ctrl', 'J', 'Forgy'], ['Ctrl', '`', 'Terminal intégré'], ['Ctrl', 'Alt', 'Espace', 'Lanceur global']]
  },
  privacy: {
    title: 'Rien de configuré d’avance. Rien qui sorte de ton PC.',
    items: [
      { title: 'Tes comptes, pas les nôtres', text: 'GitHub, serveurs, Vercel, bases, clé Anthropic : tu branches seulement ce dont tu te sers, dans Paramètres › Connexions.' },
      { title: 'Secrets chiffrés par Windows', text: 'Clés, jetons et mots de passe sont chiffrés sur ton PC et ne se réaffichent jamais. L’export de ta configuration n’en contient aucun.' },
      { title: 'Open source', text: 'Le code est sur GitHub, sous licence MIT. Chaque version est construite par GitHub Actions depuis le dépôt.' }
    ]
  },
  allTitle: 'Toutes les pages du logiciel',
  allLead: 'Chacune est expliquée en détail dans la documentation.',
  groups: [
    { name: 'Développement', pages: [['Projets', 'dev/projects/'], ['Nouveau projet', 'dev/new-project/'], ['Git', 'dev/git/'], ['Lanceur', 'dev/stacks/'], ['Docker', 'dev/docker/']] },
    { name: 'Serveurs', pages: [['SSH / VPS', 'servers/ssh/'], ['Santé', 'servers/health/'], ['Services', 'servers/services/'], ['Sauvegardes', 'servers/backups/'], ['Monitoring', 'servers/monitoring/']] },
    { name: 'Mise en ligne', pages: [['Déploiement', 'online/deploy/'], ['n8n', 'online/n8n/'], ['VPN', 'online/vpn/'], ['Page de statut', 'online/status-page/']] },
    { name: 'Données & API', pages: [['Base de données', 'data/database/'], ['API Tester', 'data/api-tester/'], ['Webhooks', 'data/webhooks/'], ['Logs', 'data/logs/']] },
    { name: 'Système', pages: [['Environnement', 'system/environment/'], ['Ports', 'system/ports/'], ['Variables .env', 'system/env-files/'], ['Domaines locaux', 'system/domains/'], ['Nettoyage disque', 'system/cleaner/']] },
    { name: 'Outils', pages: [['Boîte à outils', 'tools/utilities/'], ['Snippets', 'tools/utilities/#snippets'], ['Diff texte', 'tools/utilities/#diff-texte'], ['Générateur', 'tools/utilities/#générateur'], ['Docs', 'tools/utilities/#docs']] }
  ],
  cta: { title: 'Prêt à forger ?', text: 'Trois minutes pour l’installer et le régler. Il se met ensuite à jour tout seul.', docs: 'Lire la prise en main' },
  footer: { docs: 'Documentation', developers: 'Développeurs', releases: 'Versions', license: 'Licence MIT', privacy: 'Ce site n’utilise ni cookie ni mesure d’audience.' }
}

type Text = typeof fr

const en: Text = {
  title: 'DevForge · The dev workshop for Windows',
  description: 'Projects, Git, Docker, SSH servers, databases, deployments and Forgy, an AI assistant, in one free and open-source desktop app for Windows.',
  nav: { features: 'Features', forgy: 'Forgy', servers: 'Servers', docs: 'Docs', download: 'Download', other: 'Français', otherShort: 'FR' },
  hero: {
    eyebrow: 'Free · open source · Windows 10 and 11',
    title: ['Your whole dev workshop,', 'in a single window.'],
    lead: 'Projects, Git, Docker, SSH servers, databases, deployments and an AI assistant that knows your code. DevForge brings together the tools you open every day, with no account and nothing sent elsewhere.',
    secondary: 'Getting started',
    note: 'Unsigned installer: Windows may show a SmartScreen warning.',
    noteLink: 'Why?'
  },
  shots: [
    { id: 'home', label: 'Home', caption: 'Home: the active project, the Git state of every repository and your activity.' },
    { id: 'project', label: 'Project', caption: 'One page per project: Git, Docker, variables, database, logs, ports, deploy, scripts.' },
    { id: 'git', label: 'Git', caption: 'All your repositories: what changed, what to push or pull, and the guided commit.' },
    { id: 'database', label: 'Database', caption: 'PostgreSQL, MySQL / MariaDB and SQLite, direct or through an SSH tunnel.' },
    { id: 'env-files', label: 'Variables', caption: "Your projects' .env files compared with the template, values hidden." },
    { id: 'palette', label: 'Palette', caption: 'Ctrl K: a page, a project, a script or an action in a few letters.' },
    { id: 'toolbox', label: 'Tools', caption: 'JSON, Base64, JWT, regex, hash, cron, timestamp, URL: everything runs on your PC.' }
  ],
  stats: [
    { value: '28', label: 'pages, in 6 groups' },
    { value: '0', label: 'account to create' },
    { value: 'FR · EN', label: 'interface and assistant' },
    { value: 'MIT', label: 'free license' }
  ],
  featuresTitle: 'Everyday dev work, in one place',
  featuresLead: 'No more ten open windows. Every project has its page, every tool its own, and everything is one Ctrl K away.',
  features: [
    {
      shot: 'project', kicker: 'Projects',
      title: 'One page per project, with everything about it',
      text: 'DevForge spots the projects in your folder and gives each one a page: Git state, Compose containers, .env files, linked database, live logs, ports, deploy target and scripts to run.',
      points: ['Guided creation: React, Next.js, Vue, Node.js, Symfony, Laravel', 'Symfony, Next.js and Laravel workshops: entities, migrations, API, fake data', 'A built-in terminal where each command becomes a block'],
      link: 'dev/projects/'
    },
    {
      shot: 'git', kicker: 'Git and GitHub',
      title: 'The state of every repository at a glance',
      text: 'What changed, what to push or pull, across all your projects. Fetch, pull, push and commit in the Conventional Commits format, with a suggested message.',
      points: ['GitHub Actions, pull requests and releases of each repository', 'Re-run failed jobs without leaving DevForge', 'Fetch everything in one click'],
      link: 'dev/git/'
    },
    {
      shot: 'database', kicker: 'Data and APIs',
      title: 'Your databases, APIs and logs, no other tool needed',
      text: 'A PostgreSQL, MySQL / MariaDB and SQLite client that finds the databases of your projects and servers on its own. Next to it: an API tester, a webhook catcher and a live log viewer.',
      points: ['Browse, structure, relations, SQL', 'SSH tunnel: nothing to open on the server', 'Logs colored by level: Laravel, Symfony, nginx, pm2, JSON'],
      link: 'data/database/'
    }
  ],
  serversTitle: 'Your server, driven from your PC',
  serversLead: 'Add a VPS over SSH: DevForge watches it, backs it up and installs what you need. Without a server, these pages simply stay aside.',
  servers: [
    { icon: 'terminal', title: 'SSH and dashboard', text: 'Tabbed terminal, CPU, memory, disks, processes and containers, live.', link: 'servers/ssh/' },
    { icon: 'heart', title: 'Health', text: 'Updates, disk, open ports, SSH security, fail2ban, with one-click fixes.', link: 'servers/health/' },
    { icon: 'backup', title: 'Nightly backups', text: 'Made by the server itself, copied to your PC, restored in one click.', link: 'servers/backups/' },
    { icon: 'deploy', title: 'Deploy', text: 'A server, a folder, a script: ship in one click. And Vercel, with its previews.', link: 'online/deploy/' },
    { icon: 'workflow', title: 'n8n', text: 'Installed on your VPS over HTTPS, kept up to date, workflows and executions followed.', link: 'online/n8n/' },
    { icon: 'shield', title: 'WireGuard VPN', text: 'The wg-easy clients, their QR codes and their configurations.', link: 'online/vpn/' },
    { icon: 'radio', title: 'Status page', text: 'A public page watched 24/7 from the server, with incidents and alerts.', link: 'online/status-page/' },
    { icon: 'activity', title: 'Monitoring', text: 'Your sites and APIs checked in the background, notified when one goes down.', link: 'servers/monitoring/' }
  ],
  forgy: {
    kicker: 'The assistant',
    title: 'Forgy knows your code. It only acts when you approve.',
    text: 'Forgy reads your projects, logs, databases and the page you are looking at to answer. When it proposes to act (a commit, a container to restart, an SQL query), a card shows you exactly what: nothing runs before your click.',
    points: [
      'Your own Anthropic key, a monthly budget you set',
      'The cheapest model that does the task, picked on its own',
      'Never reads .env files, keys or passwords',
      'On the desktop with Ctrl Alt Space, and dictation that stays on your PC'
    ],
    link: 'Discover Forgy',
    mock: {
      name: 'Forgy', status: 'available · Haiku 5.5',
      question: 'Commit my cart changes',
      answer: '4 changed files in boutique-en-ligne, all in app/cart. I propose this commit:',
      cardTitle: 'Commit · boutique-en-ligne',
      cardMessage: 'feat(cart): total and shipping',
      cardNote: 'Nothing happens before your click. Can be undone from the journal.',
      approve: 'Approve', refuse: 'Refuse',
      cost: '$0.002 · $0.41 / $5'
    }
  },
  palette: {
    kicker: 'From the keyboard',
    title: "Ctrl K, and you're there",
    text: 'The palette finds a page, a project, a script, a stack or an action. The global launcher does the same over any application, even with DevForge minimized.',
    keys: [['Ctrl', 'K', 'Command palette'], ['Ctrl', 'J', 'Forgy'], ['Ctrl', '`', 'Built-in terminal'], ['Ctrl', 'Alt', 'Space', 'Global launcher']]
  },
  privacy: {
    title: 'Nothing set up in advance. Nothing leaves your PC.',
    items: [
      { title: 'Your accounts, not ours', text: 'GitHub, servers, Vercel, databases, Anthropic key: plug in only what you use, in Settings › Connections.' },
      { title: 'Secrets encrypted by Windows', text: 'Keys, tokens and passwords are encrypted on your PC and never shown again. Exporting your setup includes none of them.' },
      { title: 'Open source', text: 'The code is on GitHub, under the MIT license. Every release is built by GitHub Actions from the repository.' }
    ]
  },
  allTitle: 'Every page of the app',
  allLead: 'Each one is explained in detail in the docs.',
  groups: [
    { name: 'Development', pages: [['Projects', 'dev/projects/'], ['New Project', 'dev/new-project/'], ['Git', 'dev/git/'], ['Launcher', 'dev/stacks/'], ['Docker', 'dev/docker/']] },
    { name: 'Servers', pages: [['SSH / VPS', 'servers/ssh/'], ['Health', 'servers/health/'], ['Services', 'servers/services/'], ['Backups', 'servers/backups/'], ['Monitoring', 'servers/monitoring/']] },
    { name: 'Going live', pages: [['Deploy', 'online/deploy/'], ['n8n', 'online/n8n/'], ['VPN', 'online/vpn/'], ['Status page', 'online/status-page/']] },
    { name: 'Data & API', pages: [['Database', 'data/database/'], ['API Tester', 'data/api-tester/'], ['Webhooks', 'data/webhooks/'], ['Log viewer', 'data/logs/']] },
    { name: 'System', pages: [['Environment', 'system/environment/'], ['Ports', 'system/ports/'], ['Env variables', 'system/env-files/'], ['Local domains', 'system/domains/'], ['Disk cleaner', 'system/cleaner/']] },
    { name: 'Tools', pages: [['Toolbox', 'tools/utilities/'], ['Snippets', 'tools/utilities/#snippets'], ['Text Diff', 'tools/utilities/#text-diff'], ['Generator', 'tools/utilities/#generator'], ['Docs', 'tools/utilities/#docs']] }
  ],
  cta: { title: 'Ready to forge?', text: 'Three minutes to install and set up. It then updates itself.', docs: 'Read the getting started' },
  footer: { docs: 'Docs', developers: 'Developers', releases: 'Releases', license: 'MIT license', privacy: 'This site uses no cookies and no analytics.' }
}

export const TEXT: Record<Lang, Text> = { fr, en }
