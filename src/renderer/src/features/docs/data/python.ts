import type { DocTech } from './types'

const python: DocTech = {
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
}

export default python
