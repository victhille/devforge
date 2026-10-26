// Where DevForge is published, read from package.json (build.publish and
// repository): the updater and the "About" links use it, so a fork points to
// its own repository by changing package.json only.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function publishConfig(root) {
  const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf-8'))
  const publish = (pkg.build?.publish ?? []).find(p => p.provider === 'github') ?? {}
  const repoUrl = String(pkg.repository?.url ?? pkg.repository ?? (publish.owner ? `https://github.com/${publish.owner}/${publish.repo}` : ''))
    .replace(/^git\+/, '').replace(/\.git$/, '')
  return { owner: publish.owner ?? '', repo: publish.repo ?? '', private: publish.private === true, url: repoUrl }
}
