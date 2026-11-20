import { useState } from 'react'
import { KeyRound } from 'lucide-react'
import type { VercelAccount } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { useToast } from '@renderer/app/ToastContext'
import { errorText } from '@renderer/lib/errors'
import Button from '@renderer/components/ui/Button'
import Card from '@renderer/components/ui/Card'
import { Input } from '@renderer/components/ui/Input'

/** No Vercel token yet: where to make one, and the field to paste it (the project tab and the Vercel page) */
export default function VercelConnect({ onConnected }: { onConnected: (acc: VercelAccount) => void }) {
  const { t } = useI18n()
  const v = t.vercel
  const toast = useToast()
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)

  async function connect() {
    setBusy(true)
    try {
      onConnected(await window.devforge.vercel.saveToken(token))
      setToken('')
    } catch (err) {
      const e = errorText(err)
      toast.show({ tone: 'error', title: e === 'BAD_TOKEN' ? v.badToken : e })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="flex max-w-xl flex-col gap-3 p-4.5">
      <h2 className="text-md font-semibold text-fg">{v.connectTitle}</h2>
      <p className="text-sm text-fg-secondary">{v.connectHint}</p>
      <div className="flex gap-2">
        <Input
          type="password"
          value={token}
          onChange={e => setToken(e.target.value)}
          placeholder={v.tokenPlaceholder}
          aria-label={v.tokenPlaceholder}
          className="font-mono"
          autoComplete="off"
        />
        <Button disabled={!token.trim()} loading={busy} onClick={connect}>
          {!busy && <KeyRound size={14} />} {v.connect}
        </Button>
      </div>
    </Card>
  )
}
