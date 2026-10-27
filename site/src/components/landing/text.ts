// Texts of the landing page, in the two languages of the app
export type Lang = 'fr' | 'en'

const fr = {
  title: "DevForge, l'atelier de dev pour Windows",
  description: "Projets, Git, Docker, serveurs SSH, bases de données et déploiements dans une seule application de bureau, gratuite et open source, pour Windows.",
  nav: { tour: 'Visite', servers: 'Serveurs', forgy: 'Forgy', faq: 'Questions', docs: 'Documentation', download: 'Télécharger', other: 'English', otherShort: 'EN' },
  hero: {
    title: 'Tes projets, tes serveurs et tes bases, au même endroit.',
    lead: "DevForge est une application de bureau pour Windows qui regroupe ce qu'on ouvre toute la journée quand on développe : l'état Git de chaque projet, Docker, un terminal, un client SQL, le SSH vers ton serveur, tes fichiers .env. Gratuite, open source, sans compte.",
    download: 'Télécharger pour Windows',
    requirements: 'Windows 10 ou 11, 64 bits · gratuit',
    secondary: 'Lire la prise en main'
  },
  heroCaption: "L'accueil de DevForge, avec le projet actif et l'état Git de tous les dépôts.",
  why: {
    title: 'Pourquoi DevForge',
    paragraphs: [
      "Une journée de dev sur Windows, c'est souvent un terminal par projet, Docker Desktop, un client de base de données, un outil pour tester une API, PuTTY pour le serveur, et un fichier texte pour se souvenir des commandes. Chaque outil est bien, mais aucun ne sait sur quel projet tu travailles.",
      "DevForge part de tes projets. Il repère ceux de ton dossier, et pour chacun il montre ce qui compte : les fichiers modifiés, les conteneurs, les variables, la base, les logs, les ports, où il est déployé. Tout ce qu'il ne sait pas faire, il te laisse l'ouvrir dans ton éditeur ou ton terminal habituels."
    ]
  },
  tour: [
    {
      shot: 'project',
      title: 'Une fiche par projet',
      text: "Ouvre un projet : son état Git, son projet Compose, ses fichiers .env, sa base, ses logs, ses ports et sa cible de déploiement sont sur la même page, avec un terminal intégré. Pour Symfony, Next.js et Laravel, un atelier écrit les entités, les migrations et l'API pour toi.",
      link: 'dev/projects/'
    },
    {
      shot: 'git',
      title: 'Tous tes dépôts Git sur un écran',
      text: "Ce qui est modifié, ce qui reste à pousser, ce qu'il faut récupérer, sur tous tes projets à la fois. Le commit propose un message au format Conventional Commits d'après les fichiers touchés. Avec GitHub branché, tu vois aussi les Actions, les pull requests et les releases.",
      link: 'dev/git/'
    },
    {
      shot: 'database',
      title: 'Un client SQL qui connaît tes projets',
      text: "PostgreSQL, MySQL, MariaDB et SQLite. DevForge trouve les bases déclarées dans tes .env et celles qui tournent dans les conteneurs de ton serveur, puis s'y connecte par un tunnel SSH : rien à ouvrir côté serveur.",
      link: 'data/database/'
    }
  ],
  small: [
    { shot: 'env-files', title: 'Variables .env', text: 'Compare tes .env au modèle, complète les clés manquantes, garde une copie chiffrée.', link: 'system/env-files/' },
    { shot: 'palette', title: 'Ctrl K', text: 'Une page, un projet, un script ou une action en trois lettres.', link: 'getting-started/interface/' },
    { shot: 'toolbox', title: 'Boîte à outils', text: 'JSON, Base64, JWT, regex, hash, cron : sur ton PC, rien ne part en ligne.', link: 'tools/utilities/' }
  ],
  servers: {
    title: 'Et ton serveur',
    lead: "Ajoute un VPS en SSH et DevForge s'en occupe depuis ton PC. Si tu n'as pas de serveur, ces pages restent simplement cachées.",
    items: [
      ['Terminal et tableau de bord', 'SSH à onglets, CPU, mémoire, disques, processus et conteneurs en direct.', 'servers/ssh/'],
      ['Santé', 'Mises à jour en attente, disque, ports ouverts, sécurité SSH, fail2ban. Les corrections montrent la commande avant de la lancer.', 'servers/health/'],
      ['Sauvegardes de nuit', 'Faites par le serveur lui-même, même PC éteint, avec une copie sur ton PC et la restauration en un clic.', 'servers/backups/'],
      ['Déploiement', 'Un serveur, un dossier, un script. Et le suivi de tes projets Vercel.', 'online/deploy/'],
      ['n8n', 'Installé en HTTPS sur ton VPS, mis à jour, workflows et exécutions suivis.', 'online/n8n/'],
      ['VPN', 'Les clients WireGuard de wg-easy, avec leur QR code.', 'online/vpn/'],
      ['Page de statut', 'Une page publique surveillée 24 h/24 depuis le serveur, avec incidents et alertes sur ton téléphone.', 'online/status-page/'],
      ['Monitoring', 'Tes sites vérifiés en arrière-plan, une notification Windows quand l’un tombe.', 'servers/monitoring/']
    ] as [string, string, string][]
  },
  forgy: {
    title: 'Forgy, si tu veux',
    paragraphs: [
      "Forgy est l'assistant de DevForge. Il lit ton code, tes logs, la structure de tes bases et la page ouverte pour répondre à tes questions. Quand il propose d'agir (un commit, relancer un conteneur, une requête SQL), une carte te montre exactement quoi, et rien ne se passe avant ton clic.",
      "Il fonctionne avec ta propre clé Anthropic et un budget mensuel que tu fixes. Il ne lit jamais tes fichiers .env ni tes clés. Et il est facultatif : sans clé, tout le reste de DevForge marche."
    ],
    link: 'Tout sur Forgy',
    mock: {
      status: 'disponible · Haiku 5.5',
      question: 'Committe mes changements du panier',
      answer: '4 fichiers modifiés dans boutique-en-ligne, tous dans app/cart. Je propose ce commit :',
      cardTitle: 'Commit · boutique-en-ligne',
      cardMessage: 'feat(panier): total et frais de port',
      cardNote: 'Rien ne se passe avant ton clic. Annulable ensuite depuis le journal.',
      approve: 'Valider', refuse: 'Refuser'
    }
  },
  keys: {
    title: 'Au clavier',
    items: [['Ctrl K', 'palette de commandes'], ['Ctrl J', 'ouvrir Forgy'], ['Ctrl `', 'terminal intégré'], ['Ctrl B', 'replier le menu'], ['Ctrl Alt Espace', 'lanceur, depuis n’importe quelle application']] as [string, string][]
  },
  faq: {
    title: 'Questions',
    items: [
      ['C’est vraiment gratuit ?', 'Oui. DevForge est open source sous licence MIT, sans version payante ni compte. Seul Forgy, facultatif, consomme ta propre clé Anthropic, que tu paies directement à Anthropic.'],
      ['Pourquoi Windows affiche une alerte à l’installation ?', 'L’installeur n’est pas signé : un certificat de signature est payant. SmartScreen affiche alors « Windows a protégé votre ordinateur ». Clique sur « Informations complémentaires », puis « Exécuter quand même ». Chaque version est construite par GitHub Actions depuis le code public.'],
      ['Où vont mes données ?', 'Nulle part. Tout reste dans le dossier de DevForge sur ton PC. Les clés, jetons et mots de passe sont chiffrés par Windows et ne se réaffichent jamais. DevForge ne contient aucune mesure d’audience.'],
      ['Il me faut un serveur ?', 'Non. Projets, Git, Docker, bases, outils : tout marche en local. Les pages serveur n’apparaissent qu’une fois un serveur ajouté.'],
      ['Et sur Mac ou Linux ?', 'Pas pour l’instant : DevForge est fait pour Windows. Un portage est à l’étude dans la feuille de route.'],
      ['Comment il se met à jour ?', 'Tout seul : il regarde les nouvelles versions au démarrage puis toutes les 6 heures, les télécharge en arrière-plan et les installe au prochain redémarrage.']
    ] as [string, string][]
  },
  end: {
    title: 'Essaie-le sur tes projets',
    text: 'L’installation prend une minute, le premier lancement trois de plus. Tu peux tout passer et revenir plus tard.',
    docs: 'Documentation'
  },
  footer: { docs: 'Documentation', developers: 'Développeurs', releases: 'Versions', license: 'Licence MIT', privacy: 'Ce site n’utilise ni cookie ni mesure d’audience.', made: 'Un projet open source, sur GitHub.' }
}

type Text = typeof fr

const en: Text = {
  title: 'DevForge, the dev workshop for Windows',
  description: 'Projects, Git, Docker, SSH servers, databases and deployments in one desktop app, free and open source, for Windows.',
  nav: { tour: 'Tour', servers: 'Servers', forgy: 'Forgy', faq: 'FAQ', docs: 'Docs', download: 'Download', other: 'Français', otherShort: 'FR' },
  hero: {
    title: 'Your projects, servers and databases, in one place.',
    lead: 'DevForge is a desktop app for Windows that gathers what you keep open all day when you code: the Git state of each project, Docker, a terminal, an SQL client, SSH to your server, your .env files. Free, open source, no account.',
    download: 'Download for Windows',
    requirements: 'Windows 10 or 11, 64-bit · free',
    secondary: 'Read the getting started'
  },
  heroCaption: "DevForge's home screen, with the active project and the Git state of every repository.",
  why: {
    title: 'Why DevForge',
    paragraphs: [
      'A dev day on Windows often means a terminal per project, Docker Desktop, a database client, a tool to test an API, PuTTY for the server, and a text file to remember the commands. Each tool is fine, but none of them knows which project you are working on.',
      "DevForge starts from your projects. It finds the ones in your folder and, for each one, shows what matters: changed files, containers, variables, database, logs, ports, where it is deployed. Whatever it does not do, it lets you open in your usual editor or terminal."
    ]
  },
  tour: [
    {
      shot: 'project',
      title: 'One page per project',
      text: 'Open a project: its Git state, Compose project, .env files, database, logs, ports and deploy target are on the same page, with a built-in terminal. For Symfony, Next.js and Laravel, a workshop writes the entities, migrations and API for you.',
      link: 'dev/projects/'
    },
    {
      shot: 'git',
      title: 'All your Git repositories on one screen',
      text: 'What changed, what is left to push, what to pull, across all your projects at once. The commit suggests a Conventional Commits message from the files touched. With GitHub plugged in, you also see Actions, pull requests and releases.',
      link: 'dev/git/'
    },
    {
      shot: 'database',
      title: 'An SQL client that knows your projects',
      text: 'PostgreSQL, MySQL, MariaDB and SQLite. DevForge finds the databases declared in your .env files and those running in your server’s containers, then connects through an SSH tunnel: nothing to open on the server.',
      link: 'data/database/'
    }
  ],
  small: [
    { shot: 'env-files', title: 'Env variables', text: 'Compare your .env files with the template, fill the missing keys, keep an encrypted copy.', link: 'system/env-files/' },
    { shot: 'palette', title: 'Ctrl K', text: 'A page, a project, a script or an action in three letters.', link: 'getting-started/interface/' },
    { shot: 'toolbox', title: 'Toolbox', text: 'JSON, Base64, JWT, regex, hash, cron: on your PC, nothing goes online.', link: 'tools/utilities/' }
  ],
  servers: {
    title: 'And your server',
    lead: 'Add a VPS over SSH and DevForge takes care of it from your PC. If you have no server, these pages simply stay hidden.',
    items: [
      ['Terminal and dashboard', 'Tabbed SSH, CPU, memory, disks, processes and containers, live.', 'servers/ssh/'],
      ['Health', 'Pending updates, disk, open ports, SSH security, fail2ban. Fixes show the command before running it.', 'servers/health/'],
      ['Nightly backups', 'Made by the server itself, even with the PC off, with a copy on your PC and one-click restore.', 'servers/backups/'],
      ['Deploy', 'A server, a folder, a script. And your Vercel projects followed.', 'online/deploy/'],
      ['n8n', 'Installed over HTTPS on your VPS, updated, workflows and executions followed.', 'online/n8n/'],
      ['VPN', 'The WireGuard clients of wg-easy, with their QR code.', 'online/vpn/'],
      ['Status page', 'A public page watched 24/7 from the server, with incidents and alerts on your phone.', 'online/status-page/'],
      ['Monitoring', 'Your sites checked in the background, a Windows notification when one goes down.', 'servers/monitoring/']
    ]
  },
  forgy: {
    title: 'Forgy, if you want',
    paragraphs: [
      'Forgy is DevForge’s assistant. It reads your code, logs, database structure and the open page to answer your questions. When it proposes to act (a commit, restarting a container, an SQL query), a card shows you exactly what, and nothing happens before your click.',
      'It works with your own Anthropic key and a monthly budget you set. It never reads your .env files or keys. And it is optional: without a key, all the rest of DevForge works.'
    ],
    link: 'All about Forgy',
    mock: {
      status: 'available · Haiku 5.5',
      question: 'Commit my cart changes',
      answer: '4 changed files in boutique-en-ligne, all in app/cart. I propose this commit:',
      cardTitle: 'Commit · boutique-en-ligne',
      cardMessage: 'feat(cart): total and shipping',
      cardNote: 'Nothing happens before your click. Can be undone from the journal.',
      approve: 'Approve', refuse: 'Refuse'
    }
  },
  keys: {
    title: 'From the keyboard',
    items: [['Ctrl K', 'command palette'], ['Ctrl J', 'open Forgy'], ['Ctrl `', 'built-in terminal'], ['Ctrl B', 'fold the menu'], ['Ctrl Alt Space', 'launcher, from any application']]
  },
  faq: {
    title: 'Questions',
    items: [
      ['Is it really free?', 'Yes. DevForge is open source under the MIT license, with no paid version and no account. Only Forgy, which is optional, uses your own Anthropic key, paid directly to Anthropic.'],
      ['Why does Windows show a warning when installing?', 'The installer is not signed: a code-signing certificate costs money. SmartScreen then shows "Windows protected your PC". Click "More info", then "Run anyway". Every release is built by GitHub Actions from the public code.'],
      ['Where does my data go?', 'Nowhere. Everything stays in DevForge’s folder on your PC. Keys, tokens and passwords are encrypted by Windows and never shown again. DevForge has no analytics.'],
      ['Do I need a server?', 'No. Projects, Git, Docker, databases, tools: everything works locally. Server pages only show up once a server is added.'],
      ['What about Mac or Linux?', 'Not for now: DevForge is made for Windows. A port is being studied in the roadmap.'],
      ['How does it update?', 'On its own: it looks for new versions at startup and then every 6 hours, downloads them in the background and installs them on the next restart.']
    ]
  },
  end: {
    title: 'Try it on your projects',
    text: 'Installing takes a minute, the first launch three more. You can skip everything and come back later.',
    docs: 'Docs'
  },
  footer: { docs: 'Docs', developers: 'Developers', releases: 'Releases', license: 'MIT license', privacy: 'This site uses no cookies and no analytics.', made: 'An open-source project, on GitHub.' }
}

export const TEXT: Record<Lang, Text> = { fr, en }
