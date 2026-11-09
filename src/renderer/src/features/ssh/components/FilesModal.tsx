import { useCallback, useEffect, useState } from 'react'
import { LinesSkeleton } from '@renderer/components/ui/Skeleton'
import { ArrowUp, Download, File, Folder, FolderSymlink, RefreshCw } from 'lucide-react'
import type { SftpEntry } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { useToast } from '@renderer/app/ToastContext'
import { cn } from '@renderer/lib/cn'
import { formatSize } from '@renderer/lib/format'
import { errorText } from '@renderer/lib/errors'
import IconButton from '@renderer/components/ui/IconButton'
import Modal from '@renderer/components/ui/Modal'
import { Input } from '@renderer/components/ui/Input'
import { Table, Td, Th } from '@renderer/components/ui/Table'

const parentOf = (p: string) => p.replace(/\/[^/]+\/?$/, '') || '/'
const joinPath = (dir: string, name: string) => (dir.endsWith('/') ? dir : `${dir}/`) + name

/** The server's files over SFTP, through the session already open: folders to open, files to copy to this PC */
export default function FilesModal({ sessionId, name, onClose }: { sessionId: string; name: string; onClose: () => void }) {
  const { t, lang } = useI18n()
  const s = t.ssh
  const toast = useToast()
  const [path, setPath] = useState('')
  const [typed, setTyped] = useState('')
  const [entries, setEntries] = useState<SftpEntry[] | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // An empty path opens the home folder of the server's user
  const open = useCallback((dir: string) => {
    setLoading(true); setError('')
    window.devforge.sshSftpList(sessionId, dir)
      .then(r => { setPath(r.path); setTyped(r.path); setEntries(r.entries) })
      .catch(err => setError(errorText(err)))
      .finally(() => setLoading(false))
  }, [sessionId])
  useEffect(() => { open('') }, [open])

  async function download(e: SftpEntry) {
    try {
      const file = await window.devforge.sshSftpDownload(sessionId, joinPath(path, e.name))
      if (file) toast.show({ tone: 'success', title: s.downloaded.replace('{file}', file) })
    } catch (err) { toast.show({ tone: 'error', title: errorText(err) }) }
  }

  return (
    <Modal title={s.filesTitle.replace('{name}', name)} onClose={onClose} className="max-w-3xl">
      <form className="flex items-center gap-2" onSubmit={e => { e.preventDefault(); if (typed.trim()) open(typed.trim()) }}>
        <IconButton type="button" title={s.parentDir} disabled={!path || path === '/' || loading} onClick={() => open(parentOf(path))}><ArrowUp size={14} /></IconButton>
        <Input aria-label={s.path} value={typed} onChange={e => setTyped(e.target.value)} className="flex-1 font-mono text-sm" />
        <IconButton type="button" title={t.common.refresh} disabled={!path || loading} onClick={() => open(path)}>
          <RefreshCw size={14} className={cn(loading && 'animate-spin')} />
        </IconButton>
      </form>
      <p role="status" className="sr-only">{path}</p>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      {!entries ? (!error && <LinesSkeleton lines={6} />) : entries.length === 0 ? <p className="text-sm text-fg-muted">{s.emptyDir}</p> : (
        <div className="max-h-[50vh] overflow-y-auto rounded-control border border-line-subtle">
          <Table>
            <thead>
              <tr><Th>{s.colName}</Th><Th align="right">{s.colSize}</Th><Th>{s.colModified}</Th><Th><span className="sr-only">{s.download}</span></Th></tr>
            </thead>
            <tbody>
              {entries.map(e => {
                const Icon = e.kind === 'dir' ? Folder : e.kind === 'link' ? FolderSymlink : File
                return (
                  <tr key={e.name}>
                    <Td className="w-full max-w-0">
                      {e.kind === 'file' ? (
                        <span className="flex min-w-0 items-center gap-2 font-mono text-xs text-fg">
                          <Icon size={14} aria-hidden className="shrink-0 text-fg-muted" />
                          <span className="truncate" title={e.name}>{e.name}</span>
                        </span>
                      ) : (
                        <button type="button" onClick={() => open(joinPath(path, e.name))} className="flex max-w-full min-w-0 items-center gap-2 font-mono text-xs font-medium text-fg hover:text-accent">
                          <Icon size={14} aria-hidden className="shrink-0 text-accent" />
                          <span className="truncate" title={e.name}>{e.name}</span>
                        </button>
                      )}
                    </Td>
                    <Td align="right" className="font-mono text-xs whitespace-nowrap text-fg-muted">{e.kind === 'file' ? formatSize(e.size) : ''}</Td>
                    <Td className="text-xs whitespace-nowrap text-fg-muted">{new Date(e.mtime).toLocaleString(lang, { dateStyle: 'short', timeStyle: 'short' })}</Td>
                    <Td align="right">
                      {e.kind === 'file' && <IconButton title={s.downloadFile.replace('{name}', e.name)} onClick={() => download(e)}><Download size={14} /></IconButton>}
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </Table>
        </div>
      )}
    </Modal>
  )
}
