# Sécurité · Security

## Signaler une faille · Reporting a vulnerability

**Jamais dans une issue publique.** Utilise le signalement privé de GitHub : onglet **Security** du dépôt, puis **Report a vulnerability** ([lien direct](https://github.com/victhille/devforge/security/advisories/new)). Seuls les mainteneurs le voient.

**Never in a public issue.** Use GitHub's private reporting: the repository's **Security** tab, then **Report a vulnerability** ([direct link](https://github.com/victhille/devforge/security/advisories/new)). Only the maintainers can see it.

Indique ce que tu as trouvé, comment le reproduire, et la version de DevForge concernée. Une réponse arrive dès que possible ; le correctif sort dans une version, et le signalement est rendu public une fois les installations mises à jour.

Say what you found, how to reproduce it and which DevForge version is affected. You will get an answer as soon as possible; the fix ships in a release, and the report is made public once installs have updated.

## Versions suivies · Supported versions

Seule la dernière version reçoit les correctifs ; DevForge se met à jour tout seul. · Only the latest version gets fixes; DevForge updates itself.

## Ce que DevForge protège · What DevForge protects

- Clés, jetons et mots de passe : chiffrés par Windows (`safeStorage`), jamais renvoyés à l'interface ni écrits dans le journal. · Keys, tokens and passwords: encrypted by Windows, never sent to the interface nor written to the log.
- Rien n'est envoyé ailleurs que vers les services que tu configures (GitHub, Anthropic, Vercel, tes serveurs). Pas de télémétrie. · Nothing is sent anywhere but to the services you set up. No telemetry.
- Forgy, l'assistant, ne lit jamais les fichiers de secrets (`.env`, clés) et n'agit qu'après ton clic. · Forgy never reads secret files and acts only after your click.

Voir aussi [docs/dev/architecture.md](docs/dev/architecture.md#secrets). · See also the architecture notes.
