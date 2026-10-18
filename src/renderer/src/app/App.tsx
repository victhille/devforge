import { lazy, Suspense, useEffect, type ComponentType } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { ConsoleProvider } from '@renderer/app/ConsoleContext'
import { ToastProvider } from '@renderer/app/ToastContext'
import { VPSProvider } from '@renderer/features/ssh/VPSContext'
import Layout from '@renderer/components/layout/Layout'
import HomePage from '@renderer/features/home/HomePage'
import { PAGES } from './navigation'
import ErrorBoundary from './ErrorBoundary'
import WhatsNew from './WhatsNew'
import { AssistantProvider } from '@renderer/features/assistant/AssistantContext'
import { useI18n } from '@renderer/i18n/I18nContext'

// Every page except Home is its own chunk: faster startup, heavy deps
// (xterm, docs content) only parsed when needed.
const ROUTES: { pattern: string; Component: ComponentType }[] = PAGES.map(p => ({
  pattern: p.route ?? p.path,
  Component: lazy(p.load)
}))

/** Preload all page chunks once the app is idle, so navigation stays instant. */
function usePrefetchPages() {
  useEffect(() => {
    const prefetch = () => PAGES.forEach(p => { p.load().catch(() => {}) })
    const id = window.requestIdleCallback ? window.requestIdleCallback(prefetch) : window.setTimeout(prefetch, 500)
    return () => { window.cancelIdleCallback?.(id); clearTimeout(id) }
  }, [])
}

export default function App() {
  usePrefetchPages()
  const location = useLocation()
  const { t } = useI18n()

  return (
    <ToastProvider>
      <WhatsNew />
      <ConsoleProvider>
        <VPSProvider>
          <AssistantProvider>
          <Layout>
            <ErrorBoundary resetKey={location.pathname} labels={{ title: t.common.crashTitle, retry: t.common.retry }}>
              <Suspense fallback={null}>
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  {ROUTES.map(({ pattern, Component }) => (
                    <Route key={pattern} path={pattern} element={<Component />} />
                  ))}
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Suspense>
            </ErrorBoundary>
          </Layout>
          </AssistantProvider>
        </VPSProvider>
      </ConsoleProvider>
    </ToastProvider>
  )
}
