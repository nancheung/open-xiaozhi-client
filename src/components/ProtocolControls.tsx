import { useState } from 'react'
import { useStore } from '../store'
import { Button } from './ui/button'
import { Textarea } from './ui/textarea'
import { useDispatch } from '../ui/runtime/RuntimeContext'
import { STORAGE_KEYS, getStorageString, setStorageString } from '../lib/persistence'

function loadAutoFill(): boolean {
  const v = getStorageString(STORAGE_KEYS.AUTO_FILL_SESSION_ID)
  return v === null ? true : v === 'true'
}

export function ProtocolControls() {
  const [rawJson, setRawJson] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [autoFillSessionId, setAutoFillSessionId] = useState(loadAutoFill)
  const status = useStore(s => s.status)
  const sessionId = useStore(s => s.sessionId)
  const dispatch = useDispatch()

  function handleAutoFillChange(checked: boolean) {
    setAutoFillSessionId(checked)
    setStorageString(STORAGE_KEYS.AUTO_FILL_SESSION_ID, String(checked))
  }

  const isConnected = !['idle', 'error'].includes(status)

  function handleSend() {
    try {
      const msg = JSON.parse(rawJson)
      if (autoFillSessionId && sessionId) {
        msg.session_id = sessionId
      }
      dispatch({ type: 'SendRawJson', payload: msg })
      setError(null)
      setRawJson('')
    } catch (e) {
      setError((e as Error).message)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="shrink-0 border-t p-3 space-y-2 bg-muted/20">
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">发送自定义消息 (Ctrl+Enter)</p>
        <label className="flex items-center gap-1 text-[10px] text-muted-foreground cursor-pointer select-none">
          <input
            type="checkbox"
            className="h-3 w-3"
            checked={autoFillSessionId}
            onChange={e => handleAutoFillChange(e.target.checked)}
          />
          自动填充session_id
        </label>
      </div>
      <Textarea
        className="text-xs font-mono h-16 resize-none"
        placeholder='{"type": "ping", "session_id": "..."}'
        value={rawJson}
        onChange={e => { setRawJson(e.target.value); setError(null) }}
        onKeyDown={handleKeyDown}
        disabled={!isConnected}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Button
        size="sm"
        className="h-7 text-xs"
        onClick={handleSend}
        disabled={!isConnected || !rawJson.trim()}
      >
        发送
      </Button>
    </div>
  )
}
