---
title: Page de statut
description: Une page publique qui montre si tes services marchent, surveillée 24 h/24 depuis ton VPS, avec incidents et alertes.
---

La **Page de statut** installe sur ton serveur une page publique qui montre si tes services marchent. La surveillance tourne **sur le serveur, 24 h/24, même PC éteint**.

## Installer

Un petit service (Node, sans dépendance) teste tes sites chaque minute, garde **90 jours** d'historique, ouvre les incidents et t'alerte. Il faut Docker et Docker Compose sur le serveur. Tout va dans `~/devforge/status` ; rien d'autre n'est touché.

**Mise en ligne** : DevForge regarde ce qui tourne déjà et conseille un mode.

| Mode | Quand |
|---|---|
| Son propre Caddy (HTTPS) | les ports 80 et 443 sont libres : un certificat est pris tout seul |
| Avec le Caddy de n8n (HTTPS) | [n8n](/devforge/online/n8n/) installé par DevForge tient 80 et 443 : la page s'ajoute à son Caddy |
| Port 3901 (HTTP) | un autre outil tient 80 et 443 : la page répond sur `http://203.0.113.10:3901` |

Si le pare-feu du serveur (ufw) ferme 80 et 443, DevForge propose **Ouvrir 80 et 443**.

**Adresse de la page** : une adresse prête sans réglage DNS (`sslip.io`), ou **Mon sous-domaine** (par exemple `status.example.com`, avec **Vérifier le DNS**). L'e-mail pour le certificat est facultatif.

## Ce qui est surveillé

Ajoute des services :

| Type | Adresse |
|---|---|
| Site (HTTP) | `https://example.com` |
| Port (TCP) | `hôte:port`, par exemple `127.0.0.1:5432` |

Chaque service a un **nom public**. Ce qui est coché **Publique** s'affiche sur la page ; le reste ne se voit que dans DevForge. Chaque service montre sa disponibilité des 90 derniers jours.

**Tester une panne** ajoute un service de test qui échoue : l'incident et l'alerte arrivent à la vérification suivante. **Retirer le test** le ferme.

## Alertes

Quand un service tombe puis revient, le serveur prévient lui-même :

- **Notification sur le téléphone (ntfy)** : installe l'appli [ntfy](https://ntfy.sh) et abonne-toi au sujet. Garde-le secret : qui le connaît reçoit les alertes.
- **Webhook** : un POST JSON à chaque panne et retour, par exemple vers un webhook n8n ou Discord.

**Envoyer une alerte de test** vérifie le réglage. Les alertes ntfy se règlent, se testent et se retirent aussi dans [Paramètres › Connexions](/devforge/getting-started/connections/#n8n-et-alertes).

## La page

- **Titre** de la page.
- **Vérification** toutes les N secondes.
- **Échecs avant « en panne »** : plusieurs échecs de suite évitent les fausses alertes sur une coupure d'une seconde.

Les réglages modifiés partent au serveur avec **Enregistrer**.

## Incidents

Les incidents sont ouverts et fermés tout seuls par la surveillance (*automatique*). Tu peux aussi en **écrire** un (maintenance, explication) : un titre, un message facultatif, **Publier** ; il s'affiche sur la page publique. **Marquer résolu** ou **Supprimer**.

## Désinstaller

**Désinstaller** arrête le service et supprime `~/devforge/status` sur le serveur, historique compris.
