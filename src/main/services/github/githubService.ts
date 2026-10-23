import { readFileSync } from 'fs'
import { join } from 'path'
import { app, safeStorage } from 'electron'
import type { GithubPull, GithubRelease, GithubRepo, GithubRun, GithubStatus } from '@shared/types'
import { writeJsonFile } from '../../lib/jsonFile'
import { log } from '../../lib/log'
import { runFile } from '../../lib/exec'
import { git } from '../git/gitRepo'
import { getProjectPaths } from '../projects/projectStorage'

/**
 * GitHub Actions, pull requests and releases of a project, from the REST
 * API. The token is the one of GitHub CLI (`gh auth token`) when it is signed
 * in, else one saved here, encrypted by the OS. It never reaches the window.
 */

const API = 'https://api.github.com'

/** "https://github.com/o/r(.git)", "git@github.com:o/r(.git)", "ssh://git@github.com/o/r" → { owner, repo } */
export function parseGithubUrl(url: string): GithubRepo | null {
  const m = /github\.com[:/]([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/.exec(url.trim())
  return m ? { owner: m[1]!, repo: m[2]! } : null
}

function assertProject(projectPath: string): void {
  if (!getProjectPaths().has(projectPath)) throw new Error('Unknown project')
}

export async function repoOf(projectPath: string): Promise<GithubRepo | null> {
  assertProject(projectPath)
  const r = await git(projectPath, ['remote', 'get-url', 'origin'])
  return r.ok ? parseGithubUrl(r.stdout) : null
}

// ─── Token ────────────────────────────────────────────────────────────────────

const storePath = () => join(app.getPath('userData'), 'github.json')
function savedToken(): string | null {
  try {
    const enc = (JSON.parse(readFileSync(storePath(), 'utf-8')) as { tokenEnc?: string }).tokenEnc
    return enc ? safeStorage.decryptString(Buffer.from(enc, 'base64')) : null
  } catch { return null }
}

export const hasToken = () => savedToken() !== null

/** Saved token first (the user chose it), else GitHub CLI's */
async function token(): Promise<{ value: string; auth: 'gh' | 'token' }> {
  const saved = savedToken()
  if (saved) return { value: saved, auth: 'token' }
  const r = await runFile('gh', ['auth', 'token'], { timeout: 8000 })
  const value = r.stdout.trim()
  if (r.ok && /^[\w-]{20,}$/.test(value)) return { value, auth: 'gh' }
  throw new Error('NO_TOKEN')
}

async function api<T>(path: string, init: { method?: string; token?: string } = {}): Promise<T> {
  const tok = init.token ?? (await token()).value
  const res = await fetch(`${API}${path}`, {
    method: init.method ?? 'GET',
    headers: { authorization: `Bearer ${tok}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28', 'user-agent': 'DevForge' },
    signal: AbortSignal.timeout(20_000)
  })
  if (res.status === 401) throw new Error('BAD_TOKEN')
  if (res.status === 404) throw new Error('NOT_FOUND')
  if (!res.ok) {
    let msg = ''
    try { msg = ((await res.json()) as { message?: string }).message ?? '' } catch { /* not JSON */ }
    throw new Error(`GitHub ${res.status}${msg ? `: ${msg}` : ''}`)
  }
  return (res.status === 204 || res.status === 201 ? {} : await res.json()) as T
}

export async function saveToken(value: string | null): Promise<{ login: string | null }> {
  if (!value?.trim()) {
    writeJsonFile(storePath(), {})
    return { login: null }
  }
  if (!safeStorage.isEncryptionAvailable()) throw new Error('OS encryption is not available')
  // Checked before it is kept
  const me = await api<{ login: string }>('/user', { token: value.trim() })
  writeJsonFile(storePath(), { tokenEnc: safeStorage.encryptString(value.trim()).toString('base64') })
  log('info', 'github', `Token saved for ${me.login}`)
  return { login: me.login }
}

// ─── Status ───────────────────────────────────────────────────────────────────

interface RawRun { id: number; name: string; display_title: string; head_branch: string; event: string; status: string; conclusion: string | null; run_number: number; created_at: string; html_url: string }
interface RawPull { number: number; title: string; user: { login: string } | null; head: { ref: string }; draft: boolean; created_at: string; html_url: string }
interface RawRelease { tag_name: string; name: string | null; published_at: string | null; prerelease: boolean; draft: boolean; html_url: string }

export const toRun = (r: RawRun): GithubRun => ({ id: r.id, name: r.name, title: r.display_title, branch: r.head_branch, event: r.event, status: r.status, conclusion: r.conclusion, number: r.run_number, createdAt: r.created_at, url: r.html_url })
export const toPull = (p: RawPull): GithubPull => ({ number: p.number, title: p.title, author: p.user?.login ?? '', branch: p.head.ref, draft: p.draft, createdAt: p.created_at, url: p.html_url })
export const toRelease = (r: RawRelease): GithubRelease => ({ tag: r.tag_name, name: r.name || r.tag_name, publishedAt: r.published_at, prerelease: r.prerelease, draft: r.draft, url: r.html_url })

export async function status(projectPath: string): Promise<GithubStatus> {
  const repo = await repoOf(projectPath)
  if (!repo) throw new Error('NOT_GITHUB')
  const tok = await token()
  const base = `/repos/${repo.owner}/${repo.repo}`
  const [runs, pulls, releases] = await Promise.all([
    api<{ workflow_runs: RawRun[] }>(`${base}/actions/runs?per_page=10`, { token: tok.value }),
    api<RawPull[]>(`${base}/pulls?state=open&per_page=10`, { token: tok.value }),
    api<RawRelease[]>(`${base}/releases?per_page=5`, { token: tok.value })
  ])
  return { repo, auth: tok.auth, runs: runs.workflow_runs.map(toRun), pulls: pulls.map(toPull), releases: releases.map(toRelease) }
}

export async function rerunFailed(projectPath: string, runId: number): Promise<void> {
  if (!Number.isInteger(runId) || runId <= 0) throw new Error('Invalid run')
  const repo = await repoOf(projectPath)
  if (!repo) throw new Error('NOT_GITHUB')
  await api(`/repos/${repo.owner}/${repo.repo}/actions/runs/${runId}/rerun-failed-jobs`, { method: 'POST' })
  log('info', 'github', `Re-run of failed jobs of ${repo.owner}/${repo.repo} run ${runId}`)
}
