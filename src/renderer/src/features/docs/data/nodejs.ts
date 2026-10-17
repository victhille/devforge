import type { DocTech } from './types'

const nodejs: DocTech = {
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
}

export default nodejs
