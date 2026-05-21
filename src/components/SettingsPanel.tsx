import { useStore } from '../store'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Switch } from './ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Separator } from './ui/separator'

const SAMPLE_RATES = [8000, 12000, 16000, 24000, 48000] as const

export function SettingsPanel() {
  const helloVersion = useStore(s => s.helloVersion)
  const helloFeatures = useStore(s => s.helloFeatures)
  const helloAudio = useStore(s => s.helloAudio)
  const handshakeTimeoutMs = useStore(s => s.handshakeTimeoutMs)
  const heartbeatIntervalMs = useStore(s => s.heartbeatIntervalMs)
  const maxLogEntries = useStore(s => s.maxLogEntries)
  const mergeBinaryFrames = useStore(s => s.mergeBinaryFrames)
  const updateSettings = useStore(s => s.updateSettings)
  const updateHelloFeatures = useStore(s => s.updateHelloFeatures)
  const updateHelloAudio = useStore(s => s.updateHelloAudio)

  return (
    <div className="p-4 space-y-5 overflow-auto">
      {/* Hello 参数 */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Hello 参数</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">协议版本</Label>
            <Input
              type="number"
              className="h-8 text-sm"
              value={helloVersion}
              onChange={e => updateSettings({ helloVersion: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">上行采样率 (Hz)</Label>
            <Select
              value={String(helloAudio.sample_rate)}
              onValueChange={v =>
                updateHelloAudio({ sample_rate: Number(v) as typeof SAMPLE_RATES[number] })
              }
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SAMPLE_RATES.map(r => (
                  <SelectItem key={r} value={String(r)}>{r.toLocaleString()} Hz</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">声道数</Label>
            <Input
              type="number"
              className="h-8 text-sm"
              value={helloAudio.channels}
              min={1} max={2}
              onChange={e => updateHelloAudio({ channels: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">帧时长 (ms)</Label>
            <Input
              type="number"
              className="h-8 text-sm"
              value={helloAudio.frame_duration}
              onChange={e => updateHelloAudio({ frame_duration: Number(e.target.value) })}
            />
          </div>
        </div>
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2">
            <Switch
              id="feat-mcp"
              checked={helloFeatures.mcp}
              onCheckedChange={v => updateHelloFeatures({ mcp: v })}
            />
            <Label htmlFor="feat-mcp" className="text-xs cursor-pointer">MCP</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="feat-emoji"
              checked={helloFeatures.emoji}
              onCheckedChange={v => updateHelloFeatures({ emoji: v })}
            />
            <Label htmlFor="feat-emoji" className="text-xs cursor-pointer">Emoji</Label>
          </div>
        </div>
      </div>

      <Separator />

      {/* 连接参数 */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">连接参数</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">握手超时 (ms)</Label>
            <Input
              type="number"
              className="h-8 text-sm"
              value={handshakeTimeoutMs}
              onChange={e => updateSettings({ handshakeTimeoutMs: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">心跳间隔 (ms, 0=关闭)</Label>
            <Input
              type="number"
              className="h-8 text-sm"
              value={heartbeatIntervalMs}
              onChange={e => updateSettings({ heartbeatIntervalMs: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">最大日志条数</Label>
            <Input
              type="number"
              className="h-8 text-sm"
              value={maxLogEntries}
              onChange={e => updateSettings({ maxLogEntries: Number(e.target.value) })}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id="merge-binary"
            checked={mergeBinaryFrames}
            onCheckedChange={v => updateSettings({ mergeBinaryFrames: v })}
          />
          <Label htmlFor="merge-binary" className="text-xs cursor-pointer">合并二进制帧</Label>
        </div>
      </div>
    </div>
  )
}
