import { useState } from 'react'
import { ExternalLink, GitBranch, Link2, ScrollText, Square, Upload } from 'lucide-react'
import type { Project, VercelAccountDeployment, VercelAccountDomain, VercelAccountProject } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { formatDate, formatRelative } from '@renderer/lib/format'
import Button from '@renderer/components/ui/Button'
import Card, { CardTitle } from '@renderer/components/ui/Card'
import Badge from '@renderer/components/ui/Badge'
import Modal from '@renderer/components/ui/Modal'
import StatusDot from '@renderer/components/ui/StatusDot'
import { Field, Select } from '@renderer/components/ui/Input'
import AskForgy from '@renderer/features/assistant/AskForgy'
import { STATE_DOT, isBuilding } from './states'

const ago = (ms: number, lang: string) => (ms ? formatRelative(new Date(ms).toISOString(), lang) : '')

/** A deployment state in words */
function useStateLabel() {
  const { t } = useI18n()
  return (state: string) => t.vercel.states[state as keyof typeof t.vercel.states] ?? state.toLowerCase()
}

/** One Vercel project: its address, its latest deployment, its DevForge project or the link button */
export function ProjectCard({ project, onLink, onOpenLocal }: { project: VercelAccountProject; onLink: () => void; onOpenLocal: (id: string) => void }) {
  const { t, lang } = useI18n()
  const p = t.vercelPage
  const label = useStateLabel()
  const d = project.latest
  return (
    <Card className="flex flex-col gap-2.5 p-4">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-control bg-elevated font-mono text-xs font-semibold text-fg-secondary" aria-hidden>
          {(project.framework ?? project.name).slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <CardTitle className="block truncate">{project.name}</CardTitle>
          {project.productionUrl && (
            <button
              type="button"
              className="block min-h-[24px] max-w-full truncate text-left font-mono text-xs text-accent hover:underline"
              onClick={() => window.devforge.openExternal(project.productionUrl!)}
            >
              {project.productionUrl.replace('https://', '')}
            </button>
          )}
        </div>
      </div>
      {d ? (
        <>
          <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-fg-secondary">
            <StatusDot state={STATE_DOT[d.state] ?? 'unknown'} live={isBuilding(d.state)} />
            <span className="font-semibold text-fg">{label(d.state)}</span>
            {d.branch && <span className="truncate font-mono">{d.branch}</span>}
            <span>· {ago(d.createdAt, lang)}</span>
          </div>
          {d.commitMessage && <p className="truncate text-xs text-fg-muted">{d.commitMessage}</p>}
        </>
      ) : (
        <p className="text-xs text-fg-muted">{p.neverDeployed}</p>
      )}
      <div className="mt-auto flex min-h-[26px] items-center gap-2 border-t border-line-subtle pt-2.5 text-xs">
        {project.local ? (
          <>
            <span className="text-fg-muted">{p.inDevForge}</span>
            <button type="button" className="min-h-[24px] truncate text-accent hover:underline" onClick={() => onOpenLocal(project.local!.id)}>
              {project.local.name}
            </button>
          </>
        ) : (
          <Button size="sm" variant="secondary" onClick={onLink}>
            <Link2 size={13} /> {p.link}
          </Button>
        )}
      </div>
    </Card>
  )
}

/** What can be done with a deployment: its log, cancel while building, promote a ready preview, ask Forgy when it failed */
export function DeploymentActions({
  d,
  busy,
  onLogs,
  onCancel,
  onPromote,
  readLogs
}: {
  d: VercelAccountDeployment
  busy: string | null
  onLogs: () => void
  onCancel: () => void
  onPromote: () => void
  /** The build log, for Forgy: it has no tool to read it itself */
  readLogs: () => Promise<string>
}) {
  const { t } = useI18n()
  const p = t.vercelPage
  const forgyQuestion = async () => {
    const log = await readLogs().catch(() => '')
    // The end of the log holds the error; Forgy gets no more than it needs
    // (already masked by the main process). Fenced, so that Forgy reads it as data, not as a request;
    // replaced by functions, so that a `$&` in the log stays as it is
    const tail = log.split('\n').slice(-80).join('\n').slice(-6000).replace(/```/g, "'''")
    return p.askForgyQuestion
      .replace('{id}', () => d.id)
      .replace('{name}', () => d.projectName)
      .replace('{log}', () => (tail ? '```\n' + tail + '\n```' : p.noLog))
  }
  return (
    <div className="flex flex-wrap items-center gap-1">
      <Button size="sm" variant="ghost" onClick={onLogs}>
        <ScrollText size={13} /> {t.vercel.buildLogs}
      </Button>
      {isBuilding(d.state) && (
        <Button size="sm" variant="ghost" className="text-danger" loading={busy === `cancel-${d.id}`} onClick={onCancel}>
          {busy !== `cancel-${d.id}` && <Square size={12} />} {p.cancel}
        </Button>
      )}
      {d.state === 'READY' && d.target !== 'production' && d.projectId && (
        <Button size="sm" variant="ghost" loading={busy === `promote-${d.id}`} onClick={onPromote}>
          {busy !== `promote-${d.id}` && <Upload size={13} />} {p.promote}
        </Button>
      )}
      {d.state === 'ERROR' && <AskForgy label={p.askForgy} question={forgyQuestion} className="h-7 px-2.5 text-xs" />}
      <Button size="sm" variant="ghost" aria-label={t.vercel.openSite} title={t.vercel.openSite} onClick={() => window.devforge.openExternal(d.url)}>
        <ExternalLink size={13} />
      </Button>
    </div>
  )
}

/** One line of the deployment lists: state, project, branch, commit, when */
export function DeploymentLine({ d, children }: { d: VercelAccountDeployment; children?: React.ReactNode }) {
  const { t, lang } = useI18n()
  const label = useStateLabel()
  return (
    <div data-deployment={d.id} className="flex gap-2.5 border-t border-line-subtle py-2.5 first:border-t-0">
      <StatusDot state={STATE_DOT[d.state] ?? 'unknown'} live={isBuilding(d.state)} className="mt-1.5" />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-baseline gap-1.5 text-xs">
          <span className="truncate font-semibold text-fg">{d.projectName}</span>
          {d.branch && (
            <span className="flex min-w-0 items-center gap-1 truncate font-mono text-fg-muted">
              <GitBranch size={11} aria-hidden /> {d.branch}
            </span>
          )}
          <span className="ml-auto shrink-0 text-fg-muted">{ago(d.createdAt, lang)}</span>
        </div>
        <p className="truncate text-xs text-fg-secondary">
          {label(d.state)} · {d.target === 'production' ? t.vercel.production : t.vercel.preview}
          {d.commitMessage && ` · ${d.commitMessage}`}
        </p>
        {children}
      </div>
    </div>
  )
}

export function DomainCard({ d }: { d: VercelAccountDomain }) {
  const { t, lang } = useI18n()
  const p = t.vercelPage
  const [state, text] = !d.verified
    ? (['warn', p.domainUnverified] as const)
    : d.misconfigured
      ? (['error', p.domainDns] as const)
      : (['on', p.domainOk] as const)
  return (
    <Card className="flex flex-col gap-1.5 p-4">
      <button
        type="button"
        className="min-h-[24px] truncate text-left font-mono text-base font-semibold text-fg hover:text-accent"
        onClick={() => window.devforge.openExternal(`https://${d.name}`)}
      >
        {d.name}
      </button>
      <div className="flex items-center gap-2 text-xs text-fg-secondary">
        <StatusDot state={state} /> {text}
      </div>
      <div className="flex flex-wrap items-center gap-1.5 text-xs text-fg-muted">
        <Badge>{d.boughtAtVercel ? p.boughtHere : p.external}</Badge>
        {d.expiresAt && <span>{p.expires.replace('{date}', formatDate(new Date(d.expiresAt).toISOString(), lang))}</span>}
      </div>
    </Card>
  )
}

/** Picks the DevForge project whose folder gets .vercel/project.json */
export function LinkDialog({
  project,
  free,
  busy,
  onLink,
  onClose
}: {
  project: VercelAccountProject
  free: Project[]
  busy: boolean
  onLink: (localId: string) => void
  onClose: () => void
}) {
  const { t } = useI18n()
  const p = t.vercelPage
  // The DevForge project named like the Vercel one, else the first
  const [pick, setPick] = useState(() => (free.find(x => x.name.toLowerCase() === project.name.toLowerCase()) ?? free[0])?.id ?? '')
  return (
    <Modal
      title={p.linkTitle.replace('{name}', project.name)}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button disabled={!pick} loading={busy} onClick={() => onLink(pick)}>
            {p.linkDo}
          </Button>
        </>
      }
    >
      <p className="text-sm text-fg-secondary">{p.linkHint}</p>
      {free.length ? (
        <Field label={p.linkPick}>
          <Select value={pick} onChange={e => setPick(e.target.value)}>
            {free.map(x => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </Select>
        </Field>
      ) : (
        <p className="text-sm text-fg-muted">{p.linkNone}</p>
      )}
    </Modal>
  )
}
