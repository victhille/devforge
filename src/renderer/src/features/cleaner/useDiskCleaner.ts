import { useCallback, useRef, useState } from 'react'
import type { CleanCandidate, CleanResult } from '@shared/types'

export interface CleanRow extends CleanCandidate {
  /** null while computing */
  size: number | null
}

const SIZE_CONCURRENCY = 4

/** Scan, progressive size computation and deletion of cleanable folders. */
export function useDiskCleaner() {
  const [rows, setRows] = useState<CleanRow[]>([])
  const [scanning, setScanning] = useState(false)
  const [sizing, setSizing] = useState(false)
  const scanId = useRef(0)

  const scan = useCallback(async (root: string) => {
    const id = ++scanId.current
    setScanning(true)
    try {
      const found = await window.devforge.cleaner.scan(root)
      if (id !== scanId.current) return
      setRows(found.map(c => ({ ...c, size: null })))
      setScanning(false)

      // Sizes arrive one by one, a few folders at a time
      setSizing(true)
      const queue = [...found]
      const worker = async () => {
        for (let c = queue.shift(); c; c = queue.shift()) {
          if (id !== scanId.current) return
          const size = await window.devforge.cleaner.size(c.path).catch(() => 0)
          setRows(prev => prev.map(r => (r.path === c.path ? { ...r, size } : r)))
        }
      }
      await Promise.all(Array.from({ length: SIZE_CONCURRENCY }, worker))
      if (id === scanId.current) setSizing(false)
    } finally {
      if (id === scanId.current) setScanning(false)
    }
  }, [])

  const remove = useCallback(async (paths: string[]): Promise<CleanResult> => {
    const result = await window.devforge.cleaner.remove(paths)
    const gone = new Set(result.removed)
    setRows(prev => prev.filter(r => !gone.has(r.path)))
    return result
  }, [])

  return { rows, scanning, sizing, scan, remove }
}
