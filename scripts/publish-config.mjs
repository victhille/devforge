// Where DevForge is published, read from package.json (build.publish,
// repository and homepage): the updater, the "About" links and the help links
// use it, so a fork points to its own repository and site by changing package.json only.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function publishConfig(root) {
  const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf-8'))
  const publish = (pkg.build?.publish ?? []).find(p => p.provider === 'github') ?? {}
  const repoUrl = String(pkg.repository?.url ?? pkg.repository ?? (publish.owner ? `https://github.com/${publish.owner}/${publish.repo}` : ''))
    .replace(/^git\+/, '').replace(/\.git$/, '')
  const docs = String(pkg.homepage ?? '').replace(/\/?$/, '/').replace(/^\/$/, '')
  return { owner: publish.owner ?? '', repo: publish.repo ?? '', private: publish.private === true, url: repoUrl, docs }
}
