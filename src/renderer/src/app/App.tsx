import { lazy, Suspense, useEffect, type ComponentType } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { ConsoleProvider } from '@renderer/app/ConsoleContext'
import { VPSProvider } from '@renderer/features/ssh/VPSContext'
import Layout from '@renderer/components/layout/Layout'
import HomePage from '@renderer/features/home/HomePage'

// Every page except Home is its own chunk: faster startup, heavy deps
// (xterm, docs content) only parsed when needed.
const pages = {
  projects:      () => import('@renderer/features/projects/ProjectsPage'),
  newProject:    () => import('@renderer/features/projects/new/NewProjectPage'),
  projectDetail: () => import('@renderer/features/projects/ProjectDetailPage'),
  ssh:           () => import('@renderer/features/ssh/SSHPage'),
  vps:           () => import('@renderer/features/ssh/vps/VPSDashboardPage'),
  environment:   () => import('@renderer/features/system/EnvironmentPage'),
  ports:         () => import('@renderer/features/system/PortsPage'),
  settings:      () => import('@renderer/features/settings/SettingsPage'),
  docs:          () => import('@renderer/features/docs/DocsPage'),
  toolbox:       () => import('@renderer/features/tools/toolbox/ToolboxPage'),
  apiTester:     () => import('@renderer/features/tools/api-tester/ApiTesterPage'),
  snippets:      () => import('@renderer/features/tools/snippets/SnippetsPage'),
  diff:          () => import('@renderer/features/tools/diff/DiffPage'),
  generator:     () => import('@renderer/features/tools/generator/GeneratorPage')
} satisfies Record<string, () => Promise<{ default: ComponentType }>>

const P = Object.fromEntries(
  Object.entries(pages).map(([k, load]) => [k, lazy(load)])
) as unknown as Record<keyof typeof pages, ComponentType>

/** Preload all page chunks once the app is idle, so navigation stays instant. */
function usePrefetchPages() {
  useEffect(() => {
    const prefetch = () => Object.values(pages).forEach(load => { load().catch(() => {}) })
    const id = window.requestIdleCallback ? window.requestIdleCallback(prefetch) : window.setTimeout(prefetch, 500)
    return () => { window.cancelIdleCallback?.(id); clearTimeout(id) }
  }, [])
}

export default function App() {
  usePrefetchPages()

  return (
    <ConsoleProvider>
      <VPSProvider>
        <Layout>
          <Suspense fallback={null}>
            <Routes>
              <Route path="/"                  element={<HomePage />} />
              <Route path="/projects"          element={<P.projects />} />
              <Route path="/new-project"       element={<P.newProject />} />
              <Route path="/project/:id"       element={<P.projectDetail />} />
              <Route path="/ssh"               element={<P.ssh />} />
              <Route path="/vps/:connectionId" element={<P.vps />} />
              <Route path="/environment"       element={<P.environment />} />
              <Route path="/ports"             element={<P.ports />} />
              <Route path="/settings"          element={<P.settings />} />
              <Route path="/docs"              element={<P.docs />} />
              <Route path="/toolbox"           element={<P.toolbox />} />
              <Route path="/api-tester"        element={<P.apiTester />} />
              <Route path="/snippets"          element={<P.snippets />} />
              <Route path="/diff"              element={<P.diff />} />
              <Route path="/generator"         element={<P.generator />} />
              <Route path="*"                  element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </Layout>
      </VPSProvider>
    </ConsoleProvider>
  )
}
