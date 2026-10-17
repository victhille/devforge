import type { ReactNode } from 'react'
import styles from './Badge.module.css'

type Color = 'default' | 'accent' | 'success' | 'warning' | 'danger'

interface Props {
  color?: Color
  children: ReactNode
}

export default function Badge({ color = 'default', children }: Props) {
  return (
    <span className={`${styles.badge} ${styles[color]}`}>
      {children}
    </span>
  )
}
