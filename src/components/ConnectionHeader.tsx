import { Bell, BellRing } from 'lucide-react'
import { useStore } from '../store'
import { useConnection } from '../hooks/useConnection'
import { useUpdateCheck } from '../hooks/useUpdateCheck'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Badge } from './ui/badge'
import { Label } from './ui/label'
import type { ConnectionStatus } from '../features/connection/connectionSlice'

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M12 0C5.37 0 0 5.373 0 12c0 5.303 3.438 9.8 8.205 11.387.6.111.82-.261.82-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.09-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.108-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23a11.51 11.51 0 0 1 3.003-.404c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
    </svg>
  )
}

const STATUS_LABELS: Record<ConnectionStatus, string> = {
  idle: '未连接',
  ota_fetching: 'OTA 获取中',
  activating: '激活中',
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
  'ota_fetching', 'activating', 'ws_connecting', 'handshaking', 'mcp_init',
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

  const { hasUpdate, latestVersion } = useUpdateCheck()

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
          className="h-7 text-sm w-80"
          value={otaUrl}
          onChange={e => updateConfig({ otaUrl: e.target.value })}
          disabled={isConnected}
          placeholder="https://2662r3426b.vicp.fun/xiaozhi/ota/"
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
        <a
          href="https://github.com/nancheung/open-xiaozhi-client"
          target="_blank"
          rel="noopener noreferrer"
          title="GitHub 仓库"
        >
          <Button size="sm" variant="ghost" className={latestVersion ? 'h-7 px-2 gap-1.5' : 'h-7 w-7 p-0'} asChild>
            <span>
              <GithubIcon className="h-4 w-4 shrink-0" />
              {latestVersion && <span className="text-xs">{latestVersion}</span>}
            </span>
          </Button>
        </a>
        <a
          href="https://github.com/nancheung/open-xiaozhi-client/releases"
          target="_blank"
          rel="noopener noreferrer"
          title={hasUpdate ? `发现新版本 ${latestVersion}，点击查看` : '查看版本历史'}
        >
          <Button size="sm" variant="ghost" className="relative h-7 w-7 p-0" asChild>
            <span>
              {hasUpdate
                ? <BellRing className="h-4 w-4 text-yellow-500" />
                : <Bell className="h-4 w-4" />}
              {hasUpdate && (
                <span className="absolute top-0.5 right-0.5 h-2 w-2 rounded-full bg-red-500" />
              )}
            </span>
          </Button>
        </a>
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
