import { useState, useEffect } from 'react'
import { Minus, Square, X, Maximize2 } from 'lucide-react'
import logo from '@renderer/assets/icon.png'
import styles from './TitleBar.module.css'


export default function TitleBar() {
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    window.devforge.windowIsMaximized().then(setMaximized)
    const unsub = window.devforge.onWindowMaximizedChange(setMaximized)
    return unsub
  }, [])

  return (
    <div className={styles.titlebar}>
      <div className={styles.appName}>
        <img src={logo} alt="" className={styles.appLogo} />
        <span>DevForge</span>
      </div>

      <div className={styles.controls}>
        <button
          className={styles.ctrl}
          onClick={() => window.devforge.windowMinimize()}
          title="Minimize"
        >
          <Minus size={12} />
        </button>

        <button
          className={styles.ctrl}
          onClick={() => window.devforge.windowMaximize()}
          title={maximized ? 'Restore' : 'Maximize'}
        >
          {maximized ? <Square size={11} /> : <Maximize2 size={11} />}
        </button>

        <button
          className={`${styles.ctrl} ${styles.closeBtn}`}
          onClick={() => window.devforge.windowClose()}
          title="Close"
        >
          <X size={12} />
        </button>
      </div>
    </div>
  )
}
