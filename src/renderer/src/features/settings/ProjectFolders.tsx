import { useState } from 'react'
import { ArrowDown, ArrowUp, FolderOpen, FolderPlus, X } from 'lucide-react'
import type { AppSettings } from '@shared/types'
import { projectFolders, withProjectFolders } from '@shared/lib/projectFolders'
import { useI18n } from '@renderer/i18n/I18nContext'
import Button from '@renderer/components/ui/Button'
import IconButton from '@renderer/components/ui/IconButton'
import { Input } from '@renderer/components/ui/Input'

/**
 * v3.5: the projects folders, in order; the first one is the default for new
 * projects. Its page keys it on the saved list, so a save starts it afresh.
 */
export default function ProjectFolders({ settings, update }: { settings: AppSettings; update: (patch: Partial<AppSettings>) => Promise<void> }) {
  const { t } = useI18n()
  const s = t.settings
  const saved = projectFolders(settings)
  // The fields as typed: saved when one loses focus
  const [draft, setDraft] = useState<string[]>(saved.length ? saved : [''])

  const save = (list: string[]) => {
    const next = withProjectFolders(list)
    if (projectFolders(next).join('\n') !== saved.join('\n')) void update(next)
    else setDraft(saved.length ? saved : [''])
  }
  const move = (i: number, by: number) => {
    const list = [...draft]
    ;[list[i], list[i + by]] = [list[i + by], list[i]]
    save(list)
  }

  async function add() {
    const dir = await window.devforge.selectDirectory()
    if (dir) save([...draft, dir])
  }

  async function browse(i: number) {
    const dir = await window.devforge.selectDirectory()
    if (dir) save(draft.map((d, j) => (j === i ? dir : d)))
  }

  return (
    <div className="flex flex-[1_1_360px] flex-col gap-2">
      {draft.map((dir, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <Input value={dir} aria-label={`${s.defaultDir} ${i + 1}`} className="font-mono text-[12.5px]" spellCheck={false}
            onChange={e => setDraft(draft.map((d, j) => (j === i ? e.target.value : d)))}
            onBlur={() => save(draft)} />
          <IconButton size="sm" title={s.browse} onClick={() => browse(i)}><FolderOpen size={13} /></IconButton>
          {i === 0 && draft.length > 1 && <span className="shrink-0 rounded-md bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent">{s.folderDefault}</span>}
          {draft.length > 1 && (
            <>
              <IconButton size="sm" title={s.folderUp} disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp size={13} /></IconButton>
              <IconButton size="sm" title={s.folderDown} disabled={i === draft.length - 1} onClick={() => move(i, 1)}><ArrowDown size={13} /></IconButton>
              <IconButton size="sm" tone="danger" title={s.folderRemove} onClick={() => save(draft.filter((_, j) => j !== i))}><X size={13} /></IconButton>
            </>
          )}
        </div>
      ))}
      <Button variant="secondary" className="self-start" onClick={add}><FolderPlus size={14} /> {s.folderAdd}</Button>
    </div>
  )
}
