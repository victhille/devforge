import type { DocTech } from './types'

const git: DocTech = {
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
}

export default git
