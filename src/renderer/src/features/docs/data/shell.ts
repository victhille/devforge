import type { DocTech } from './types'

const shell: DocTech = {
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
}

export default shell
