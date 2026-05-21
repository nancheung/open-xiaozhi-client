import { useStore } from '../store'
import { useConnection } from '../hooks/useConnection'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Badge } from './ui/badge'
import { Label } from './ui/label'
import type { ConnectionStatus } from '../features/connection/connectionSlice'

const STATUS_LABELS: Record<ConnectionStatus, string> = {
  idle: '未连接',
  ota_fetching: 'OTA 获取中',
  ws_connecting: '连接中',
  handshaking: '握手中',
  mcp_init: 'MCP 初始化',
  ready: '就绪',
  listening: '监听中',
  playing: '播放中',
  error: '错误',
  activation_required: '待激活',
}

const CONNECTING_STATUSES: ConnectionStatus[] = [
  'ota_fetching', 'ws_connecting', 'handshaking', 'mcp_init',
]

const CONNECTED_STATUSES: ConnectionStatus[] = [
  'ready', 'listening', 'playing',
]

function statusVariant(s: ConnectionStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (s === 'error') return 'destructive'
  if (s === 'ready' || s === 'listening' || s === 'playing') return 'default'
  if (s === 'idle') return 'secondary'
  return 'outline'
}

export function ConnectionHeader() {
  const { otaUrl } = useStore(s => s.config)
  const deviceId = useStore(s => s.deviceId)
  const isEditing = useStore(s => s.isEditing)
  const editDraft = useStore(s => s.editDraft)
  const randomizeDeviceId = useStore(s => s.randomizeDeviceId)
  const startEdit = useStore(s => s.startEdit)
  const setEditDraft = useStore(s => s.setEditDraft)
  const saveEdit = useStore(s => s.saveEdit)
  const cancelEdit = useStore(s => s.cancelEdit)
  const clearActivation = useStore(s => s.clearActivation)
  const reset = useStore(s => s.reset)
  const status = useStore(s => s.status)
  const errorMessage = useStore(s => s.errorMessage)
  const updateConfig = useStore(s => s.updateConfig)
  const { connect, disconnect } = useConnection()

  const isConnected = CONNECTED_STATUSES.includes(status)
  const isConnecting = CONNECTING_STATUSES.includes(status)
  const canEditDevice = !isConnected && !isConnecting

  const handleRandomize = () => {
    randomizeDeviceId()
    clearActivation()
    reset()
  }

  const handleSave = () => {
    const success = saveEdit()
    if (success) {
      clearActivation()
      reset()
    }
  }

  return (
    <header className="flex items-center gap-3 px-4 py-2 border-b bg-card shrink-0">
      <div className="flex items-center gap-2 min-w-0">
        <Label htmlFor="ota-url" className="text-sm font-medium whitespace-nowrap">服务地址</Label>
        <Input
          id="ota-url"
          className="h-7 text-sm w-56"
          value={otaUrl}
          onChange={e => updateConfig({ otaUrl: e.target.value })}
          disabled={isConnected}
          placeholder="http://localhost:8003"
        />
      </div>

      <div className="flex items-center gap-1 min-w-0">
        <span className="text-xs text-muted-foreground shrink-0">设备 ID</span>
        {!isEditing ? (
          <>
            <code className="text-xs bg-muted px-1.5 py-0.5 rounded truncate max-w-36">{deviceId}</code>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-xs px-2"
              onClick={handleRandomize}
              disabled={!canEditDevice}
            >
              随机刷新
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-xs px-2"
              onClick={startEdit}
              disabled={!canEditDevice}
            >
              编辑
            </Button>
          </>
        ) : (
          <>
            <Input
              className="h-6 text-xs w-44"
              value={editDraft}
              onChange={e => setEditDraft(e.target.value)}
              placeholder="AA:BB:CC:DD:EE:FF"
            />
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-xs px-2"
              onClick={handleSave}
            >
              保存
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-xs px-2"
              onClick={cancelEdit}
            >
              取消
            </Button>
          </>
        )}
      </div>

      <div className="flex items-center gap-2 ml-auto">
        {errorMessage && (
          <span className="text-xs text-destructive max-w-48 truncate" title={errorMessage}>
            {errorMessage}
          </span>
        )}
        <Badge variant={statusVariant(status)}>{STATUS_LABELS[status]}</Badge>
        <Button
          size="sm"
          variant={isConnected ? 'outline' : 'default'}
          className="h-7 text-xs px-3"
          onClick={isConnected ? disconnect : connect}
          disabled={isConnecting && !isConnected}
        >
          {isConnected ? '断开' : isConnecting ? '连接中...' : '连接'}
        </Button>
      </div>
    </header>
  )
}
