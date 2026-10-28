import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { cn } from '@renderer/lib/cn'
import Button from '@renderer/components/ui/Button'
import CopyButton from '@renderer/components/ui/CopyButton'
import IconButton from '@renderer/components/ui/IconButton'
import { useI18n } from '@renderer/i18n/I18nContext'
import ToolHelp from '@renderer/components/ui/ToolHelp'
import { JSON_EXAMPLE } from '../../examples'
import { IoGrid, IoPanel, IO_TEXTAREA, ToolActions, type ToolboxT } from '../IoPanel'

export default function JsonTool({ t }: { t: ToolboxT }) {
  const [input, setInput]   = useState('')
  const [output, setOutput] = useState('')
  const [error, setError]   = useState('')
  const h = useI18n().t.toolHelp

  function run(indent?: number) {
    try { setOutput(JSON.stringify(JSON.parse(input), null, indent)); setError('') }
    catch { setError(t.invalid); setOutput('') }
  }

  return (
    <>
      <ToolHelp id="json" what={h.json.what} how={h.json.how}
        examples={[{ label: h.json.sample, onPick: () => { setInput(JSON_EXAMPLE); setOutput(''); setError('') } }]} />
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
