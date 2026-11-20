import { useEffect, useRef, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import type { GithubDeviceCode } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { errorText } from '@renderer/lib/errors'
import Button from '@renderer/components/ui/Button'
import CopyButton from '@renderer/components/ui/CopyButton'
import Spinner from '@renderer/components/ui/Spinner'

/**
 * « Se connecter » without a token, under the service's row. GitHub: the code to type on its page,
 * then the wait. Vercel: the browser opens, DevForge waits for its answer. Closing cancels it.
 */
export default function SignInPanel({
  service,
  onDone,
  onClose
}: {
  service: 'github' | 'vercel'
  onDone: (name: string | null) => void
  onClose: () => void
}) {
  const { t } = useI18n()
  const c = t.settings.connections
  const [code, setCode] = useState<GithubDeviceCode | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const panel = useRef<HTMLDivElement>(null)
  // The focus goes into the panel as it opens: its first button
  useEffect(() => {
    panel.current?.querySelector<HTMLButtonElement>('button')?.focus()
  }, [code, error])
  // The latest callbacks, without starting the sign-in again when the page draws itself
  const done = useRef(onDone)
  done.current = onDone

  useEffect(() => {
    let live = true
    const api = window.devforge.connections
    setError('')
    setCode(null)
    const run = async () => {
      if (service === 'github') {
        const d = await api.githubSignIn()
        if (!live) return
        setCode(d)
        const r = await api.githubWait()
        if (live) done.current(r.login)
      } else {
        const r = await api.vercelSignIn()
        if (live) done.current(r.username)
      }
    }
    run().catch(err => {
      const msg = errorText(err)
      if (live && msg !== 'CANCELLED') setError((c.errors as Record<string, string>)[msg] ?? msg)
    })
    return () => {
      live = false
      void api.cancelSignIn()
    }
  }, [service, attempt, c.errors])

  if (error)
    return (
      <div ref={panel} role="group" aria-label={c.signIn} className="flex w-full flex-wrap items-center gap-2">
        <p role="alert" className="flex-1 text-sm text-danger">
          {error}
        </p>
        <Button size="sm" variant="secondary" onClick={() => setAttempt(n => n + 1)}>
          {t.common.retry}
        </Button>
        <Button size="sm" variant="ghost" onClick={onClose}>
          {t.common.cancel}
        </Button>
      </div>
    )

  return (
    <div ref={panel} role="group" aria-label={c.signIn} className="flex w-full flex-col gap-3 rounded-card border border-line bg-surface px-4 py-3">
      {service === 'github' && code ? (
        <>
          <p className="text-sm text-fg-secondary">{c.signInGithubStep}</p>
          <div className="flex flex-wrap items-center gap-3">
            <span
              role="img"
              className="rounded-control border border-line-strong bg-elevated px-3 py-1.5 font-mono text-lg tracking-[0.2em] text-fg"
              aria-label={c.signInCode.replace('{code}', code.userCode.split('').join(' '))}
            >
              {code.userCode}
            </span>
            <CopyButton text={code.userCode} title={c.signInCopy} />
            <Button size="sm" variant="secondary" onClick={() => void window.devforge.connections.githubOpenPage()}>
              <ExternalLink size={13} /> {c.signInOpenGithub}
            </Button>
          </div>
        </>
      ) : (
        service === 'vercel' && <p className="text-sm text-fg-secondary">{c.signInVercelStep}</p>
      )}
      <div className="flex items-center gap-2">
        <Spinner />
        <span role="status" className="flex-1 text-sm text-fg-secondary">
          {code || service === 'vercel' ? c.signInWaiting : t.common.loading}
        </span>
        <Button size="sm" variant="ghost" onClick={onClose}>
          {t.common.cancel}
        </Button>
      </div>
    </div>
  )
}
