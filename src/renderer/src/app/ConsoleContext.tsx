import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react'
import type { LogLine, CommandResult, ProjectCreationOptions, PackageManager } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'

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
}

export interface ConsoleContextValue extends ConsoleState {
  startCreation: (options: ProjectCreationOptions) => Promise<void>
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
    projectId:   null
  })
  const saveProjUnsubRef = useRef<(() => void) | null>(null)
  const { t } = useI18n()

  // Always-on listeners — capture logs and results for active task
  useEffect(() => {
    const unsubLog = window.devforge.onTaskLog(log => {
      setState(prev => prev.visible ? { ...prev, logs: [...prev.logs, log] } : prev)
    })

    const unsubResult = window.devforge.onTaskResult(result => {
      setState(prev => {
        if (!prev.visible) return prev
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

    return () => { unsubLog(); unsubResult() }
  }, [])

  const startCreation = useCallback(async (options: ProjectCreationOptions) => {
    const sep      = options.destination.includes('/') ? '/' : '\\'
    const projPath = options.destination.replace(/[/\\]$/, '') + sep + options.name

    setState({
      visible:     true,
      minimized:   false,
      label:       `Creating ${options.name}`,
      taskId:      null,
      logs:        [],
      result:      null,
      projectPath: projPath,
      isCreation:  true,
      projectId:   null
    })

    const taskId = await window.devforge.createProject(options)
    setState(prev => ({ ...prev, taskId }))

    // Clean up any leftover listener from a previous aborted creation
    saveProjUnsubRef.current?.()

    // One-shot listener to save the project when creation succeeds
    const unsub = window.devforge.onTaskResult(result => {
      if (result.status === 'success') {
        const id = crypto.randomUUID()
        setState(prev => ({ ...prev, projectId: id }))
        window.devforge.saveProject({
          id,
          name:          options.name,
          path:          projPath,
          framework:     options.framework,
          packageManager:options.packageManager,
          createdAt:     new Date().toISOString(),
          lastOpenedAt:  null,
          favorite:      false
        })
      }
      saveProjUnsubRef.current = null
      unsub()
    })
    saveProjUnsubRef.current = unsub
  }, [])

  const runScript = useCallback(async (
    projectPath: string,
    script: string,
    pm: PackageManager,
    projectName: string
  ) => {
    const base = { visible: true, minimized: false, taskId: null, result: null, projectPath, isCreation: false, projectId: null }
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
    setState({ visible: true, minimized: false, label, taskId: null, logs: [], result: null, projectPath, isCreation: false, projectId: null })
    try {
      const taskId = await start()
      setState(prev => ({ ...prev, taskId }))
      return taskId
    } catch (err) {
      const text = String(err instanceof Error ? err.message : err).replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
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
      if (prev.projectPath) window.devforge.openInIDE(prev.projectPath, 'vscode')
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
