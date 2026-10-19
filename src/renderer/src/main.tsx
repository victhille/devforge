import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { I18nProvider } from './i18n/I18nContext'
import App from './app/App'
import './styles/index.css'

// Uncaught errors go to the local log (Settings → About → Copy report)
window.addEventListener('error', e => { window.devforge.logError('window', e.error?.stack ?? e.message).catch(() => {}) })
window.addEventListener('unhandledrejection', e => {
  const r = e.reason
  window.devforge.logError('promise', r instanceof Error ? r.stack ?? r.message : String(r)).catch(() => {})
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <I18nProvider>
        <App />
      </I18nProvider>
    </HashRouter>
  </React.StrictMode>
)
