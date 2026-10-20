import { useState } from 'react'
import Button from '@renderer/components/ui/Button'
import CopyButton from '@renderer/components/ui/CopyButton'
import { Select } from '@renderer/components/ui/Input'
import { IoGrid, IoPanel, IO_TEXTAREA, ToolActions, type ToolboxT } from '../IoPanel'

const ALGOS = ['SHA-1', 'SHA-256', 'SHA-384', 'SHA-512']

export default function HashTool({ t }: { t: ToolboxT }) {
  const [input, setInput]   = useState('')
  const [algo, setAlgo]     = useState('SHA-256')
  const [output, setOutput] = useState('')

  async function hash() {
    const buf = await crypto.subtle.digest(algo, new TextEncoder().encode(input))
    setOutput(Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join(''))
  }

  return (
    <>
      <ToolActions>
        <label className="flex items-center gap-2 text-sm text-fg-muted">
          {t.algorithm}
          <Select value={algo} onChange={e => setAlgo(e.target.value)} className="w-32">
            {ALGOS.map(a => <option key={a}>{a}</option>)}
          </Select>
        </label>
      </ToolActions>
      <IoGrid>
        <IoPanel label={t.input}>
          <textarea className={IO_TEXTAREA} value={input} onChange={e => setInput(e.target.value)} placeholder="Text to hash..." spellCheck={false} />
        </IoPanel>
        <IoPanel label={t.output} actions={output && <CopyButton text={output} />}>
          <textarea className={IO_TEXTAREA} value={output} readOnly aria-label={t.output} spellCheck={false} />
        </IoPanel>
      </IoGrid>
      <ToolActions>
        <Button onClick={hash}>{t.generate}</Button>
      </ToolActions>
    </>
  )
}
