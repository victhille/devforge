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

- quatre chiffres : **réussis**, **échoués**, **ignorés**, et la **durée** ;
- les tests **par fichier**, chacun avec ✓, ✗ ou *ignoré* et son temps ; un fichier qui a un échec est ouvert, les autres sont repliés ;
- **Sortie de la commande**, repliée, garde ce que l'outil a écrit.

L'outil écrit son rapport dans les données de DevForge, jamais dans le projet. La dernière exécution complète est gardée : en revenant sur l'onglet, elle s'affiche avec son heure (*Dernière exécution il y a 5 min*).

## Les échecs

Un test échoué se déplie sous sa ligne :

- son **message** ;
- **Attendu** et **Reçu**, quand l'outil les donne (Jest, Vitest, PHPUnit, pytest, et `left` / `right` en Rust) ;
- **À** *fichier:ligne* : un clic ouvre le fichier dans l'onglet **Fichiers**, à la ligne, surlignée ;
- **Message complet** pour la trace entière.

Puis :

- **Relancer ce fichier** (sous l'échec, ou l'icône sur la ligne du fichier) ;
- **Relancer les échecs** : seulement les fichiers qui ont échoué ;
- **Échecs seulement** cache tout ce qui passe ;
- **Expliquer avec Forgy** envoie le nom du test, son endroit et son message à [Forgy](/devforge/forgy/assistant/), qui explique l'échec et propose une correction.
