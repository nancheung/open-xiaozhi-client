import { useState } from 'react'
import { useStore } from '../store'
import { Button } from './ui/button'
import { Textarea } from './ui/textarea'
import { sendJson } from '../ws/wsManager'

export function ProtocolControls() {
  const [rawJson, setRawJson] = useState('')
  const [error, setError] = useState<string | null>(null)
  const status = useStore(s => s.status)

  const isConnected = !['idle', 'error'].includes(status)

  function handleSend() {
    try {
      const msg = JSON.parse(rawJson)
      sendJson(msg)
      useStore.getState().addLog('out', msg)
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
      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">发送自定义消息 (Ctrl+Enter)</p>
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
