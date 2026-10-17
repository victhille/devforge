import { useState } from 'react'
import Button from '@renderer/components/ui/Button'
import CopyButton from '@renderer/components/ui/CopyButton'
import { IoGrid, IoPanel, IO_TEXTAREA, ToolActions, type ToolboxT } from '../IoPanel'

// UTF-8 safe, without the deprecated escape/unescape
const encode = (s: string) => btoa(Array.from(new TextEncoder().encode(s), b => String.fromCharCode(b)).join(''))
const decode = (s: string) =>
  new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(atob(s.trim()), c => c.charCodeAt(0)))

export default function Base64Tool({ t }: { t: ToolboxT }) {
  const [input, setInput]   = useState('')
  const [output, setOutput] = useState('')

  return (
    <>
      <IoGrid>
        <IoPanel label={t.input}>
          <textarea className={IO_TEXTAREA} value={input} onChange={e => setInput(e.target.value)} placeholder="Text to encode / base64 to decode..." spellCheck={false} />
        </IoPanel>
        <IoPanel label={t.output} actions={output && <CopyButton text={output} />}>
          <textarea className={IO_TEXTAREA} value={output} readOnly spellCheck={false} />
        </IoPanel>
      </IoGrid>
      <ToolActions>
        <Button onClick={() => setOutput(encode(input))}>{t.encode}</Button>
        <Button variant="secondary" onClick={() => { try { setOutput(decode(input)) } catch { setOutput(t.invalid) } }}>
          {t.decode}
        </Button>
      </ToolActions>
    </>
  )
}
