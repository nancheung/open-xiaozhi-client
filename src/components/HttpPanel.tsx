import { useState } from 'react'
import { useStore } from '../store'
import { useConnection } from '../hooks/useConnection'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Separator } from './ui/separator'

export function HttpPanel() {
  const [secret, setSecret] = useState('')
  const status = useStore(s => s.status)
  const sessionId = useStore(s => s.sessionId)
  const { sendUpdate, sendRestart } = useConnection()

  const canSend = ['ready', 'listening', 'playing'].includes(status) && !!secret

  return (
    <div className="p-4 space-y-5">
      <div>
        <h3 className="text-sm font-medium mb-1">服务端操作</h3>
        <p className="text-xs text-muted-foreground">
          通过 WebSocket 向服务端发送管理指令（需要管理密钥）。
        </p>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">当前 Session ID</Label>
        <code className="block text-xs bg-muted px-2 py-1 rounded text-muted-foreground truncate">
          {sessionId ?? '—'}
        </code>
      </div>

      <Separator />

      <div className="space-y-2">
        <Label htmlFor="admin-secret" className="text-xs">Admin Secret</Label>
        <Input
          id="admin-secret"
          type="password"
          className="h-8 text-sm"
          placeholder="服务端管理密钥"
          value={secret}
          onChange={e => setSecret(e.target.value)}
        />
      </div>

      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs"
          disabled={!canSend}
          onClick={() => sendUpdate(secret)}
        >
          更新配置
        </Button>
        <Button
          variant="destructive"
          size="sm"
          className="h-8 text-xs"
          disabled={!canSend}
          onClick={() => sendRestart(secret)}
        >
          重启服务
        </Button>
      </div>

      <p className="text-[10px] text-muted-foreground">
        * 操作需要在连接就绪（ready）状态下执行。
      </p>
    </div>
  )
}
