import type { DocTech } from './types'

const docker: DocTech = {
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
}

export default docker
