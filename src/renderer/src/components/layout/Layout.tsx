import type { ReactNode } from 'react'
import Sidebar from './Sidebar'
import TitleBar from './TitleBar'
import BottomPanel from './BottomPanel'
import styles from './Layout.module.css'

interface Props {
  children: ReactNode
}

export default function Layout({ children }: Props) {
  return (
    <div className={styles.root}>
      <TitleBar />
      <div className={styles.body}>
        <Sidebar />
        <div className={styles.contentArea}>
          <main className={styles.main}>
            {children}
          </main>
          <BottomPanel />
        </div>
      </div>
    </div>
  )
}
