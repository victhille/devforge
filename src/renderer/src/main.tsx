import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { I18nProvider } from './i18n/I18nContext'
import App from './App'
import './styles/global.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <I18nProvider>
        <App />
      </I18nProvider>
    </HashRouter>
  </React.StrictMode>
)
