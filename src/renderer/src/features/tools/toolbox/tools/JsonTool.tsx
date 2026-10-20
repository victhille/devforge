import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { cn } from '@renderer/lib/cn'
import Button from '@renderer/components/ui/Button'
import CopyButton from '@renderer/components/ui/CopyButton'
import IconButton from '@renderer/components/ui/IconButton'
import { IoGrid, IoPanel, IO_TEXTAREA, ToolActions, type ToolboxT } from '../IoPanel'

export default function JsonTool({ t }: { t: ToolboxT }) {
  const [input, setInput]   = useState('')
  const [output, setOutput] = useState('')
  const [error, setError]   = useState('')

  function run(indent?: number) {
    try { setOutput(JSON.stringify(JSON.parse(input), null, indent)); setError('') }
    catch { setError(t.invalid); setOutput('') }
  }

  return (
    <>
      <IoGrid>
        <IoPanel
          label={t.input}
          actions={
            <IconButton size="sm" title="Clear" onClick={() => { setInput(''); setOutput(''); setError('') }}>
              <Trash2 size={13} />
            </IconButton>
          }
        >
          <textarea className={IO_TEXTAREA} value={input} onChange={e => setInput(e.target.value)} placeholder='{"key": "value"}' spellCheck={false} />
        </IoPanel>
        <IoPanel label={t.output} actions={output && <CopyButton text={output} />}>
          <textarea className={cn(IO_TEXTAREA, error && 'text-danger')} value={error || output} readOnly aria-label={t.output} spellCheck={false} />
        </IoPanel>
      </IoGrid>
      <ToolActions>
        <Button onClick={() => run(2)}>{t.format}</Button>
        <Button variant="secondary" onClick={() => run()}>{t.minify}</Button>
      </ToolActions>
    </>
  )
}
