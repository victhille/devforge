import { useState } from 'react'
import { Check, Eye, EyeOff, Pencil, RefreshCw, Trash2, X } from 'lucide-react'
import type { EnvProject } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { cn } from '@renderer/lib/cn'
import Badge from '@renderer/components/ui/Badge'
import IconButton from '@renderer/components/ui/IconButton'
import { Input } from '@renderer/components/ui/Input'

const isExample = (name: string) => /example|sample|dist|template/i.test(name)

/**
 * Keys holding a secret the app draws itself, by their exact name: never one a service gives
 * (GITHUB_CLIENT_SECRET, STRIPE_WEBHOOK_SECRET…) nor an encryption key whose data would be lost
 */
export const isRegenerable = (key: string) => /^(APP_KEY|APP_SECRET|SECRET_KEY|SESSION_SECRET|JWT_SECRET|AUTH_SECRET|NEXTAUTH_SECRET|BETTER_AUTH_SECRET|COOKIE_SECRET|CSRF_SECRET)$/i.test(key)


interface Props {
  env: EnvProject
  onChange: (fileName: string, key: string, value: string | null) => Promise<void>
  /** Draw a new random value for a secret key */
  onRegenerate?: (fileName: string, key: string) => void
}

/** Keys × files table: spot missing variables and edit values in place. */
export default function EnvMatrix({ env, onChange, onRegenerate }: Props) {
  const { t } = useI18n()
  const e = t.envFiles
  const [revealed, setRevealed] = useState(false)
  const [editing, setEditing] = useState<{ file: string; key: string; value: string } | null>(null)

  const keys = Array.from(new Set(env.files.flatMap(f => Object.keys(f.values))))
  const example = env.files.find(f => isExample(f.name))

  async function commit() {
    if (!editing) return
    await onChange(editing.file, editing.key, editing.value)
    setEditing(null)
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-line-subtle bg-surface">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-line-subtle">
            <th className="sticky left-0 h-8.5 bg-surface px-3.5 text-left text-xs font-semibold whitespace-nowrap text-fg-muted">
              <span className="flex items-center gap-2">
                {e.key} ({keys.length})
                <IconButton size="sm" title={revealed ? e.hide : e.reveal} onClick={() => setRevealed(r => !r)}>
                  {revealed ? <EyeOff size={13} /> : <Eye size={13} />}
                </IconButton>
              </span>
            </th>
            {env.files.map(f => (
              <th key={f.name} className="h-8.5 px-3.5 text-left font-mono text-xs font-semibold whitespace-nowrap text-fg-muted">
                {f.name} {isExample(f.name) && <Badge className="ml-1 font-sans">{e.template}</Badge>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {keys.map(key => (
            <tr key={key} className="group border-b border-line-subtle last:border-0 hover:bg-elevated/60">
              <td className="sticky left-0 bg-surface px-3.5 py-2 font-mono text-xs font-medium text-fg group-hover:bg-elevated">{key}</td>
              {env.files.map(f => {
                const has = key in f.values
                // Only .env must contain every template key; .env.local etc. are overrides
                const missing = !has && f.name === '.env' && !!example && key in example.values
                const isEditing = editing?.file === f.name && editing.key === key
                return (
                  <td key={f.name} className="px-3.5 py-1.5 align-middle">
                    {isEditing ? (
                      <div className="flex items-center gap-1">
                        <Input
                          autoFocus
                          value={editing.value}
                          onChange={ev => setEditing({ ...editing, value: ev.target.value })}
                          onKeyDown={ev => { if (ev.key === 'Enter') commit(); if (ev.key === 'Escape') setEditing(null) }}
                          className="h-7 font-mono text-xs"
                        />
                        <IconButton size="sm" title={t.common.save} onClick={commit}><Check size={13} /></IconButton>
                        <IconButton size="sm" title={t.common.cancel} onClick={() => setEditing(null)}><X size={13} /></IconButton>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        {has ? (
                          <span className={cn('max-w-64 truncate font-mono text-xs', f.values[key] ? 'text-fg-secondary' : 'italic text-fg-muted')}>
                            {f.values[key] ? (revealed ? f.values[key] : '••••••••') : e.empty}
                          </span>
                        ) : missing ? (
                          <Badge color="danger">{e.missing}</Badge>
                        ) : (
                          <span className="text-fg-disabled">—</span>
                        )}
                        <span className="ml-auto flex opacity-0 group-hover:opacity-100 group-focus-within:opacity-100">
                          <IconButton
                            size="sm"
                            title={e.edit}
                            onClick={() => setEditing({ file: f.name, key, value: f.values[key] ?? example?.values[key] ?? '' })}
                          >
                            <Pencil size={12} />
                          </IconButton>
                          {has && onRegenerate && !isExample(f.name) && isRegenerable(key) && (
                            <IconButton size="sm" title={e.regenerate} onClick={() => onRegenerate(f.name, key)}>
                              <RefreshCw size={12} />
                            </IconButton>
                          )}
                          {has && (
                            <IconButton size="sm" tone="danger" title={t.common.delete} onClick={() => onChange(f.name, key, null)}>
                              <Trash2 size={12} />
                            </IconButton>
                          )}
                        </span>
                      </div>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
