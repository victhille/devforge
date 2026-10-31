// Texts of the landing page, in the two languages of the app
export type Lang = 'fr' | 'en'

const fr = {
  title: "DevForge, l'atelier de dev pour Windows",
  description: 'Git, Docker, un terminal, un client SQL, le SSH vers ton serveur et tes .env, regroupés autour de tes projets dans une application de bureau gratuite et open source pour Windows.',
  nav: { features: 'Fonctions', servers: 'Serveurs', forgy: 'Forgy', docs: 'Documentation', releases: 'Versions', download: 'Télécharger', other: 'English', otherShort: 'EN', search: 'Rechercher dans la doc', searchLabel: 'Rechercher dans la documentation', searchClose: 'Fermer' },
  hero: {
    eyebrow: 'Pour Windows 10 et 11 · gratuit · open source',
    title: ["L'atelier où tes projets ", 'tournent', '.'],
    lead: 'Git, Docker, un terminal, un client SQL, le SSH vers ton serveur et tes .env, regroupés autour de tes projets dans une seule application de bureau.',
    download: 'Télécharger pour Windows',
    tour: 'Voir la vidéo (1 min)',
    homeAlt: "L'accueil de DevForge",
    projectAlt: "La fiche d'un projet",
    card: { title: 'Forgy propose · Commit', message: 'feat(panier): total arrondi', approve: 'Valider', refuse: 'Refuser' }
  },
  video: {
    title: 'DevForge en une minute',
    lead: "L'app telle quelle, sur des projets d'exemple : l'accueil, la palette, une fiche projet, Git, la base, Forgy et les connexions. Commentée et sous-titrée ; l'ouverture et la fin sont des plans générés par IA.",
    label: 'Vidéo de présentation de DevForge, commentée et sous-titrée en français'
  },
  replaces: { before: "Au lieu d'ouvrir", items: ['un terminal par projet', 'Docker Desktop', 'un client SQL', "un testeur d'API", 'PuTTY', 'le bloc-notes des commandes'], after: '→ une fenêtre.' },
  day: {
    title: 'Une journée avec DevForge',
    lead: 'Pas de nouvelle façon de travailler à apprendre : les mêmes gestes, sans changer de fenêtre.',
    steps: [
      { time: '09:02', shot: 'palette', pos: 'center', title: 'Ctrl K, « bou »', text: "Le projet s'ouvre, son serveur de dev démarre depuis la palette.", alt: 'La palette de commandes' },
      { time: '11:40', shot: 'git', pos: 'left top', title: 'Commit & push', text: "Le message est suggéré d'après les fichiers touchés.", alt: 'Le tableau de bord Git' },
      { time: '15:15', shot: 'database', pos: 'right top', title: "Un coup d'œil à la base", text: 'La base Docker du projet, déjà connectée.', alt: 'Une table dans le client SQL' }
    ],
    deploy: { time: '18:05', title: 'Déployer', text: 'Un clic : le script tourne sur ton serveur en SSH.', path: 'mon-serveur · /var/www/boutique', done: '✓ boutique déployé' }
  },
  projects: {
    title: 'Tout part de tes projets',
    lead: 'DevForge repère les projets de ton dossier. Chacun a sa fiche avec ce qui le concerne.',
    tabs: [
      { id: 'project', title: 'Fiche projet', text: 'Git, Compose, variables, base, logs, ports, déploiement et scripts sur une page. Pour Symfony, Next.js et Laravel, un atelier écrit aussi entités, migrations et API.' },
      { id: 'env-files', title: 'Variables .env', text: 'Tes .env comparés au modèle, les clés manquantes ajoutées en un clic, une copie chiffrée.' },
      { id: 'palette', title: 'Palette Ctrl K', text: "Une page, un projet, un script ou une action en quelques lettres." },
      { id: 'toolbox', title: 'Boîte à outils', text: 'JSON, Base64, JWT, regex, hash, cron, timestamp, URL, sans rien envoyer en ligne.' }
    ]
  },
  servers: {
    title: 'Ton VPS, sans y passer tes soirées',
    lead: 'Ajoute un serveur en SSH. Sans serveur, ces pages restent cachées.',
    items: [
      ['Santé', 'Mises à jour, disque, ports, SSH, fail2ban.', 'servers/health/'],
      ['Sauvegardes de nuit', 'Faites par le serveur, copiées sur ton PC.', 'servers/backups/'],
      ['Déploiement', 'Un dossier, un script, un clic. Et Vercel.', 'online/deploy/'],
      ['n8n', 'Installé en HTTPS, tenu à jour.', 'online/n8n/'],
      ['VPN WireGuard', 'Les clients wg-easy et leur QR code.', 'online/vpn/'],
      ['Page de statut', 'Publique, surveillée 24 h/24.', 'online/status-page/']
    ] as [string, string, string][],
    health: {
      title: 'Santé · mon-serveur', badge: 'Tout va bien',
      rows: [['Mises à jour', 'Le système est à jour.'], ['Disque', '41 % utilisé'], ['Mots de passe SSH', 'Clé uniquement'], ['fail2ban', 'actif'], ['Sauvegarde', 'cette nuit, 03:00']] as [string, string][],
      note: "Illustration, valeurs d'exemple."
    }
  },
  forgy: {
    title: 'Forgy lit ton code. Tu gardes la main.',
    text: 'Il répond avec le contexte de ton projet et de la page ouverte. Pour agir, il te montre une carte : rien ne part avant ton clic. Ta propre clé Anthropic, ton budget, et facultatif.',
    link: 'Tout sur Forgy',
    mock: {
      status: 'disponible · Haiku 5.5',
      question: 'Pourquoi le conteneur db redémarre ?',
      answer: "Le log montre « password authentication failed » : la base vient d'un ancien volume. Je propose de la redémarrer :",
      cardTitle: 'Compose · boutique-en-ligne', cardCode: 'restart db', approve: 'Valider', refuse: 'Refuser'
    }
  },
  faq: {
    title: 'Questions',
    items: [
      ["C'est vraiment gratuit ?", 'Oui, open source sous licence GPL-3.0, sans compte. Seul Forgy, facultatif, utilise ta propre clé Anthropic.'],
      ["Pourquoi l'alerte SmartScreen ?", "L'installeur n'est pas signé (un certificat est payant). Clique sur « Informations complémentaires », puis « Exécuter quand même ». Chaque version est construite par GitHub Actions depuis le code public."],
      ['Où vont mes données ?', 'Nulle part : tout reste sur ton PC, et clés, jetons et mots de passe sont chiffrés par Windows.'],
      ['Il me faut un serveur ?', "Non. Projets, Git, Docker, bases et outils marchent en local ; les pages serveur n'apparaissent qu'une fois un serveur ajouté."],
      ['Mac ou Linux ?', "Pas encore : DevForge est fait pour Windows, un portage est à l'étude."]
    ] as [string, string][]
  },
  get: { title: 'Télécharger DevForge', text: 'Windows 10 ou 11, 64 bits. Mises à jour automatiques.', button: 'Télécharger', notes: 'Notes de version' },
  footer: { made: 'DevForge · open source, sur GitHub', docs: 'Documentation', developers: 'Développeurs', license: 'Licence GPL-3.0', privacy: "Ce site n'utilise ni cookie ni mesure d'audience." }
}

type Text = typeof fr

const en: Text = {
  title: 'DevForge, the dev workshop for Windows',
  description: 'Git, Docker, a terminal, an SQL client, SSH to your server and your .env files, gathered around your projects in one free and open-source desktop app for Windows.',
  nav: { features: 'Features', servers: 'Servers', forgy: 'Forgy', docs: 'Docs', releases: 'Releases', download: 'Download', other: 'Français', otherShort: 'FR', search: 'Search the docs', searchLabel: 'Search the documentation', searchClose: 'Close' },
  hero: {
    eyebrow: 'For Windows 10 and 11 · free · open source',
    title: ['The workshop where your projects ', 'run', '.'],
    lead: 'Git, Docker, a terminal, an SQL client, SSH to your server and your .env files, gathered around your projects in one desktop app.',
    download: 'Download for Windows',
    tour: 'Watch the video (1 min)',
    homeAlt: "DevForge's home screen",
    projectAlt: "A project's page",
    card: { title: 'Forgy proposes · Commit', message: 'fix(cart): rounded total', approve: 'Approve', refuse: 'Refuse' }
  },
  video: {
    title: 'DevForge in one minute',
    lead: 'The app as it is, on sample projects: home, the palette, a project page, Git, the database, Forgy and connections. No sound, with captions.',
    label: 'DevForge presentation video, with English captions, no sound'
  },
  replaces: { before: 'Instead of opening', items: ['a terminal per project', 'Docker Desktop', 'an SQL client', 'an API tester', 'PuTTY', 'the notepad of commands'], after: '→ one window.' },
  day: {
    title: 'A day with DevForge',
    lead: 'No new way of working to learn: the same moves, without switching windows.',
    steps: [
      { time: '09:02', shot: 'palette', pos: 'center', title: 'Ctrl K, "bou"', text: 'The project opens, its dev server starts from the palette.', alt: 'The command palette' },
      { time: '11:40', shot: 'git', pos: 'left top', title: 'Commit & push', text: 'The message is suggested from the files touched.', alt: 'The Git dashboard' },
      { time: '15:15', shot: 'database', pos: 'right top', title: 'A look at the database', text: "The project's Docker database, already connected.", alt: 'A table in the SQL client' }
    ],
    deploy: { time: '18:05', title: 'Deploy', text: 'One click: the script runs on your server over SSH.', path: 'my-server · /var/www/shop', done: '✓ shop deployed' }
  },
  projects: {
    title: 'It all starts from your projects',
    lead: 'DevForge finds the projects in your folder. Each one has its page with everything about it.',
    tabs: [
      { id: 'project', title: 'Project page', text: 'Git, Compose, variables, database, logs, ports, deploy and scripts on one page. For Symfony, Next.js and Laravel, a workshop also writes entities, migrations and API.' },
      { id: 'env-files', title: 'Env variables', text: 'Your .env files compared with the template, missing keys added in one click, an encrypted copy.' },
      { id: 'palette', title: 'Ctrl K palette', text: 'A page, a project, a script or an action in a few letters.' },
      { id: 'toolbox', title: 'Toolbox', text: 'JSON, Base64, JWT, regex, hash, cron, timestamp, URL, with nothing sent online.' }
    ]
  },
  servers: {
    title: 'Your VPS, without spending your evenings on it',
    lead: 'Add a server over SSH. Without a server, these pages stay hidden.',
    items: [
      ['Health', 'Updates, disk, ports, SSH, fail2ban.', 'servers/health/'],
      ['Nightly backups', 'Made by the server, copied to your PC.', 'servers/backups/'],
      ['Deploy', 'A folder, a script, one click. And Vercel.', 'online/deploy/'],
      ['n8n', 'Installed over HTTPS, kept up to date.', 'online/n8n/'],
      ['WireGuard VPN', 'The wg-easy clients and their QR code.', 'online/vpn/'],
      ['Status page', 'Public, watched 24/7.', 'online/status-page/']
    ],
    health: {
      title: 'Health · my-server', badge: 'All good',
      rows: [['Updates', 'The system is up to date.'], ['Disk', '41 % used'], ['SSH passwords', 'Key login only'], ['fail2ban', 'running'], ['Backup', 'tonight, 03:00']],
      note: 'Illustration, sample values.'
    }
  },
  forgy: {
    title: 'Forgy reads your code. You stay in charge.',
    text: 'It answers with the context of your project and the open page. To act, it shows you a card: nothing runs before your click. Your own Anthropic key, your budget, and optional.',
    link: 'All about Forgy',
    mock: {
      status: 'available · Haiku 5.5',
      question: 'Why does the db container keep restarting?',
      answer: 'The log says "password authentication failed": the database comes from an old volume. I propose to restart it:',
      cardTitle: 'Compose · boutique-en-ligne', cardCode: 'restart db', approve: 'Approve', refuse: 'Refuse'
    }
  },
  faq: {
    title: 'Questions',
    items: [
      ['Is it really free?', 'Yes, open source under the GPL-3.0 license, no account. Only Forgy, which is optional, uses your own Anthropic key.'],
      ['Why the SmartScreen warning?', 'The installer is not signed (a certificate costs money). Click "More info", then "Run anyway". Every release is built by GitHub Actions from the public code.'],
      ['Where does my data go?', 'Nowhere: everything stays on your PC, and keys, tokens and passwords are encrypted by Windows.'],
      ['Do I need a server?', 'No. Projects, Git, Docker, databases and tools work locally; server pages only show up once a server is added.'],
      ['Mac or Linux?', 'Not yet: DevForge is made for Windows, a port is being studied.']
    ]
  },
  get: { title: 'Download DevForge', text: 'Windows 10 or 11, 64-bit. Automatic updates.', button: 'Download', notes: 'Release notes' },
  footer: { made: 'DevForge · open source, on GitHub', docs: 'Docs', developers: 'Developers', license: 'GPL-3.0 license', privacy: 'This site uses no cookies and no analytics.' }
}

export const TEXT: Record<Lang, Text> = { fr, en }
