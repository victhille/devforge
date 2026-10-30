import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react'
import type { LogLine, CommandResult, ProjectCreationOptions, PackageManager } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { openInPreferredIde } from '@renderer/lib/ide'
import { errorText } from '@renderer/lib/errors'

interface ConsoleState {
  visible: boolean
  minimized: boolean
  label: string
  taskId: string | null
  logs: LogLine[]
  result: CommandResult | null
  projectPath: string | null
  isCreation: boolean
  /** Saved project of a finished creation */
  projectId: string | null
  /** A finished creation opens the project (which makes it the active one) */
  openOnDone: boolean
  /** v3.9: a creation started from the wizard, followed from any page (title bar, back to the wizard) */
  creation: CreationView | null
}

export interface CreationView {
  name: string
  /** The base project, then each setup step, as the progress lists them */
  planned: string[]
  /** The wizard's steps bar, as it was at the click */
  steps: string[]
  startedAt: number
}

export interface CreationAfter {
  /** The new project's page opens once saved, which makes it the active one (default) */
  openOnDone?: boolean
  /** A page shows the progress: the log waits one click away */
  minimized?: boolean
  view?: Omit<CreationView, 'startedAt' | 'name'>
}

export interface ConsoleContextValue extends ConsoleState {
  startCreation: (options: ProjectCreationOptions, after?: CreationAfter) => Promise<void>
  runScript: (projectPath: string, script: string, pm: PackageManager, projectName: string) => Promise<void>
  /** Any command of the main process that streams task-log: shows it here, resolves with its task id */
  runTask: (label: string, projectPath: string, start: () => Promise<string>) => Promise<string>
  cancelTask: () => void
  hide: () => void
  setMinimized: (v: boolean) => void
  openFolder: () => void
  openVSCode: () => void
}

/** Exported for the launcher window, which gives its own (it forwards to the main window) */
export const ConsoleContext = createContext<ConsoleContextValue | null>(null)

export function ConsoleProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ConsoleState>({
    visible:     false,
    minimized:   false,
    label:       '',
    taskId:      null,
    logs:        [],
    result:      null,
    projectPath: null,
    isCreation:  false,
    projectId:   null,
    openOnDone:  true,
    creation:    null
  })
  const saveProjUnsubRef = useRef<(() => void) | null>(null)
  const { t } = useI18n()

  // Always-on listeners — capture logs and results for active task
  useEffect(() => {
    // An install writes hundreds of lines a second: they reach the screen in batches, not one render each
    let pending: LogLine[] = []
    let timer: ReturnType<typeof setTimeout> | null = null
    const flush = () => {
      if (timer) { clearTimeout(timer); timer = null }
      if (!pending.length) return
      const batch = pending
      pending = []
      // A creation is followed even with the console closed: its page and the title bar show it
      setState(prev => prev.visible || prev.isCreation ? { ...prev, logs: prev.logs.concat(batch) } : prev)
    }
    const unsubLog = window.devforge.onTaskLog(log => {
      pending.push(log)
      if (!timer) timer = setTimeout(flush, 100)
    })

    const unsubResult = window.devforge.onTaskResult(result => {
      // The last lines first, then the end
      flush()
      setState(prev => {
        if (!prev.visible && !prev.isCreation) return prev
        // Native notification
        try {
          if ('Notification' in window) {
            if (result.status === 'success') {
              new Notification('DevForge', { body: `✓ ${prev.label} — done!`, silent: false })
            } else if (result.status === 'failed') {
              new Notification('DevForge', { body: `✗ ${prev.label} — failed`, silent: false })
            }
          }
        } catch { /* ignore */ }
        return { ...prev, result }
      })
    })

    return () => { unsubLog(); unsubResult(); if (timer) clearTimeout(timer) }
  }, [])

  const startCreation = useCallback(async (options: ProjectCreationOptions, after?: CreationAfter) => {
    const sep      = options.destination.includes('/') ? '/' : '\\'
    const projPath = options.destination.replace(/[/\\]$/, '') + sep + options.name

    setState({
      visible:     true,
      minimized:   after?.minimized ?? false,
      label:       t.console.creating.replace('{name}', options.name),
      taskId:      null,
      logs:        [],
      result:      null,
      projectPath: projPath,
      isCreation:  true,
      projectId:   null,
      openOnDone:  after?.openOnDone ?? true,
      creation:    after?.view ? { ...after.view, name: options.name, startedAt: Date.now() } : null
    })

    const taskId = await window.devforge.createProject(options)
    setState(prev => ({ ...prev, taskId }))

    // Clean up any leftover listener from a previous aborted creation
    saveProjUnsubRef.current?.()

    // One-shot listener to save the project when creation succeeds
    const unsub = window.devforge.onTaskResult(async result => {
      if (result.status === 'success') {
        const id = crypto.randomUUID()
        await window.devforge.saveProject({
          id,
          name:          options.name,
          path:          projPath,
          framework:     options.framework,
          packageManager:options.packageManager,
          createdAt:     new Date().toISOString(),
          lastOpenedAt:  null,
          favorite:      false
        })
        // The console opens the project's page once it is saved (unless asked not to)
        setState(prev => ({ ...prev, projectId: id }))
      }
      saveProjUnsubRef.current = null
      unsub()
    })
    saveProjUnsubRef.current = unsub
  }, [t])

  const runScript = useCallback(async (
    projectPath: string,
    script: string,
    pm: PackageManager,
    projectName: string
  ) => {
    const base = { visible: true, minimized: false, taskId: null, result: null, projectPath, isCreation: false, projectId: null, openOnDone: false, creation: null }
    // No node_modules: offer to install first, then the script follows in the same console
    let installed = false
    if (await window.devforge.scriptNeedsInstall(projectPath) && window.confirm(t.hub.installFirst)) {
      setState({ ...base, label: `${pm} install (${projectName})`, logs: [] })
      const installId = await window.devforge.installProjectDeps(projectPath, pm)
      setState(prev => ({ ...prev, taskId: installId }))
      const ok = await new Promise<boolean>(resolve => {
        const unsub = window.devforge.onTaskResult(r => {
          if (r.taskId !== installId) return
          unsub()
          resolve(r.status === 'success')
        })
      })
      if (!ok) return
      installed = true
    }
    setState(prev => ({ ...base, label: `${pm} run ${script} (${projectName})`, logs: installed ? prev.logs : [] }))
    const taskId = await window.devforge.runProjectScript(projectPath, script, pm)
    setState(prev => ({ ...prev, taskId }))
  }, [t])

  const runTask = useCallback(async (label: string, projectPath: string, start: () => Promise<string>) => {
    setState({ visible: true, minimized: false, label, taskId: null, logs: [], result: null, projectPath, isCreation: false, projectId: null, openOnDone: false, creation: null })
    try {
      const taskId = await start()
      setState(prev => ({ ...prev, taskId }))
      return taskId
    } catch (err) {
      const text = errorText(err)
      setState(prev => ({
        ...prev,
        logs: [...prev.logs, { taskId: '', type: 'error', text, timestamp: new Date().toISOString() }],
        result: { taskId: '', exitCode: 1, status: 'failed' }
      }))
      throw err
    }
  }, [])

  const cancelTask = useCallback(() => {
    setState(prev => {
      if (prev.taskId) window.devforge.cancelTask(prev.taskId)
      return prev
    })
  }, [])

  const hide = useCallback(() => {
    setState(prev => ({ ...prev, visible: false }))
  }, [])

  const setMinimized = useCallback((v: boolean) => {
    setState(prev => ({ ...prev, minimized: v }))
  }, [])

  const openFolder = useCallback(() => {
    setState(prev => {
      if (prev.projectPath) window.devforge.openDirectory(prev.projectPath)
      return prev
    })
  }, [])

  const openVSCode = useCallback(() => {
    setState(prev => {
      if (prev.projectPath) void openInPreferredIde(prev.projectPath)
      return prev
    })
  }, [])

  return (
    <ConsoleContext.Provider value={{
      ...state,
      startCreation, runScript, runTask, cancelTask, hide, setMinimized, openFolder, openVSCode
    }}>
      {children}
    </ConsoleContext.Provider>
  )
}

export function useConsole() {
  const ctx = useContext(ConsoleContext)
  if (!ctx) throw new Error('useConsole must be used within ConsoleProvider')
  return ctx
}
