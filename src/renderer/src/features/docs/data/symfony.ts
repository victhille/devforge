import type { DocTech } from './types'

const symfony: DocTech = {
  id: 'symfony', name: 'Symfony', color: '#A78BFA',
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
}

export default symfony
