import { Folder, Plus, Star, X } from 'lucide-react'
import type { AppSettings } from '@shared/types'
import { projectFolders, withProjectFolders } from '@shared/lib/projectFolders'
import { useI18n } from '@renderer/i18n/I18nContext'
import Badge from '@renderer/components/ui/Badge'
import Button from '@renderer/components/ui/Button'
import IconButton from '@renderer/components/ui/IconButton'

/**
 * The projects folders, as in the mock-up: the first one (a star, « par défaut ») gets the new projects;
 * another one's folder turns into a star to put it first; × takes one out of the list (nothing is deleted).
 */
export default function ProjectFolders({ settings, update }: { settings: AppSettings; update: (patch: Partial<AppSettings>) => Promise<void> }) {
  const { t } = useI18n()
  const s = t.settings
  const list = projectFolders(settings)
  const save = (next: string[]) => { void update(withProjectFolders(next)) }

  async function add() {
    const dir = await window.devforge.selectDirectory()
    if (dir && !list.includes(dir)) save([...list, dir])
  }

  return (
    <div className="flex flex-[1_1_360px] flex-col gap-2">
      {list.length > 0 && (
        <ul aria-label={s.defaultDir} className="flex flex-col gap-2">
          {list.map((dir, i) => (
            <li key={dir} className="flex min-h-9 items-center gap-2 rounded-control border border-line bg-canvas py-1 pr-1 pl-2.5">
              {i === 0 ? (
                <Star size={14} className="shrink-0 text-accent" aria-hidden />
              ) : (
                <IconButton size="sm" title={`${s.folderMakeDefault} · ${dir}`} className="group -ml-1.5 shrink-0" onClick={() => save([dir, ...list.filter(d => d !== dir)])}>
                  <Folder size={14} className="group-hover:hidden group-focus-visible:hidden" />
                  <Star size={14} className="hidden text-accent group-hover:block group-focus-visible:block" />
                </IconButton>
              )}
              <span className="min-w-0 flex-1 truncate font-mono text-sm font-medium text-fg" title={dir}>{dir}</span>
              {i === 0 && <Badge color="accent">{s.folderDefault}</Badge>}
              {list.length > 1 && (
                <IconButton size="sm" title={`${s.folderRemove} · ${dir}`} onClick={() => save(list.filter(d => d !== dir))}><X size={13} /></IconButton>
              )}
            </li>
          ))}
        </ul>
      )}
      <Button size="sm" variant="ghost" className="self-start" onClick={add}><Plus size={13} /> {s.folderAdd}</Button>
    </div>
  )
}
