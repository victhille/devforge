---
title: Tests
description: "L'onglet Tests de la fiche projet : lancer Vitest, Jest, Playwright, PHPUnit, pytest, Go ou Cargo, voir chaque test, lire un échec, le relancer, le donner à Forgy."
---

L'onglet **Tests** de la [fiche projet](/devforge/dev/projects/) lance les tests du projet et montre chacun, réussi ou échoué. Il apparaît quand DevForge trouve un outil de test dans le projet.

## Les outils reconnus

| Outil | Reconnu par | Lancé avec |
|---|---|---|
| Vitest | `vitest` dans les dépendances du `package.json` | `npx vitest run` |
| Jest | `jest` dans les dépendances | `npx jest` |
| Playwright | `@playwright/test` dans les dépendances | `npx playwright test` |
| PHPUnit | `vendor/bin/phpunit` (ou `bin/phpunit` de Symfony) | `php vendor/bin/phpunit` |
| pytest | `pytest` dans `requirements*.txt` ou `pyproject.toml`, un `pytest.ini` ou un `conftest.py` | `python -m pytest`, avec le Python de l'environnement virtuel du projet |
| Go | un `go.mod` et des fichiers `*_test.go` | `go test ./...` |
| Cargo | un `Cargo.toml` | `cargo test --no-fail-fast` |

Avec plusieurs outils (Vitest et Playwright, par exemple), un menu choisit lequel lancer. Un outil qui manque (les dépendances pas installées, pas d'environnement virtuel, `go` ou `cargo` absents) est signalé avec la commande qui l'installe.

## Lancer les tests

**Lancer les tests** démarre l'outil dans le dossier du projet ; sa sortie défile en dessous pendant l'exécution, et **Arrêter** le coupe. Ensuite :

- les totaux en pastilles : **réussis**, **échecs**, **ignorés**, et la **durée** ;
- à gauche, les **fichiers de tests**, chacun avec son nombre de tests et d'échecs ; le premier fichier en échec est choisi d'office ;
- à droite, **les tests du fichier choisi**, chacun avec ✓, ✗ ou *ignoré* et son temps ;
- **Sortie de la commande**, repliée, garde ce que l'outil a écrit.

L'outil écrit son rapport dans les données de DevForge, jamais dans le projet. La dernière exécution complète est gardée : en revenant sur l'onglet, elle s'affiche avec son heure (*Dernière exécution il y a 5 min*).

## Les échecs

Dans le détail du fichier, le premier échec s'affiche en haut ; un clic sur un autre test échoué l'affiche à sa place :

- son **message** ;
- **Attendu** et **Reçu**, quand l'outil les donne (Jest, Vitest, PHPUnit, pytest, et `left` / `right` en Rust) ;
- **À** *fichier:ligne* : un clic (ou **Ouvrir le fichier**) l'ouvre dans l'onglet **Fichiers et Git**, à la ligne, surlignée ;
- **Message complet** pour la trace entière.

Puis :

- **Relancer ce test** : seulement ce test, quand son nom est fait de mots simples (lettres, chiffres, espaces et ponctuation courante) ; sinon, tout son fichier ;
- **Relancer ce fichier** (à côté du titre des tests du fichier) ;
- **Relancer les échecs** : seulement les fichiers qui ont échoué ;
- **Échecs seulement** cache tout ce qui passe ;
- **Expliquer avec Forgy** envoie le nom du test, son endroit et son message à [Forgy](/devforge/forgy/assistant/), qui explique l'échec et propose une correction.
