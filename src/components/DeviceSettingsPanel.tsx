import { useStore } from '@/store'
import { applyVolume, applyBrightness, applyTheme, MIN_BRIGHTNESS } from '@/features/device/deviceSetters'
import { Slider } from './ui/slider'
import { Switch } from './ui/switch'
import { Label } from './ui/label'

export function DeviceSettingsPanel() {
  const volume = useStore((s) => s.volume)
  const brightness = useStore((s) => s.brightness)
  const theme = useStore((s) => s.theme)

  return (
    <div className="p-4 space-y-6 max-w-xs">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">音量</Label>
          <span className="text-sm tabular-nums text-muted-foreground">{volume}</span>
        </div>
        <Slider
          min={0}
          max={100}
          step={1}
          value={[volume]}
          onValueChange={([v]) => applyVolume(v)}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">亮度</Label>
          <span className="text-sm tabular-nums text-muted-foreground">{brightness}</span>
        </div>
        <Slider
          min={MIN_BRIGHTNESS}
          max={100}
          step={1}
          value={[brightness]}
          onValueChange={([v]) => applyBrightness(v)}
        />
        <p className="text-xs text-muted-foreground">
          最低亮度限制为 {MIN_BRIGHTNESS}%，以防止页面不可见
        </p>
      </div>

      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">主题</Label>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">浅色</span>
          <Switch
            checked={theme === 'dark'}
            onCheckedChange={(checked) => applyTheme(checked ? 'dark' : 'light')}
          />
          <span className="text-xs text-muted-foreground">深色</span>
        </div>
      </div>
    </div>
  )
}
