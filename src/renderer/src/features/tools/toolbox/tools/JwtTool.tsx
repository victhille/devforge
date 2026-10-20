import { useState } from 'react'
import Button from '@renderer/components/ui/Button'
import CopyButton from '@renderer/components/ui/CopyButton'
import { IoGrid, IoPanel, IO_TEXTAREA, ToolActions, type ToolboxT } from '../IoPanel'

function decodePart(part: string): unknown {
  const b64 = part.replace(/-/g, '+').replace(/_/g, '/')
  const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0))
  return JSON.parse(new TextDecoder().decode(bytes))
}

export default function JwtTool({ t }: { t: ToolboxT }) {
  const [input, setInput]   = useState('')
  const [output, setOutput] = useState('')

  function decode() {
    try {
      const parts = input.trim().split('.')
      if (parts.length !== 3) throw new Error('Invalid JWT')
      setOutput(JSON.stringify({ header: decodePart(parts[0]), payload: decodePart(parts[1]) }, null, 2))
    } catch {
      setOutput(t.invalid)
    }
  }

  return (
    <>
      <IoGrid>
        <IoPanel label="JWT Token">
          <textarea className={IO_TEXTAREA} value={input} onChange={e => setInput(e.target.value)} placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." spellCheck={false} />
        </IoPanel>
        <IoPanel label="Decoded" actions={output && <CopyButton text={output} />}>
          <textarea className={IO_TEXTAREA} value={output} readOnly aria-label={t.output} spellCheck={false} />
        </IoPanel>
      </IoGrid>
      <ToolActions>
        <Button onClick={decode}>{t.decode}</Button>
      </ToolActions>
    </>
  )
}
