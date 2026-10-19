import React from 'react'
import ReactDOM from 'react-dom/client'
import { I18nProvider } from './i18n/I18nContext'
import Widget from './features/widget/Widget'
import './styles/index.css'
import './features/widget/widget.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <I18nProvider>
      <Widget />
    </I18nProvider>
  </React.StrictMode>
)
