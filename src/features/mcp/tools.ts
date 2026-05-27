import {
  applyVolume, applyBrightness, applyTheme,
  getCurrentVolume, getCurrentBrightness, getCurrentTheme,
} from '../device/deviceSetters'

export interface ToolDefinition {
  name: string
  description: string
  inputSchema: {
    type: 'object'
    properties: Record<string, { type: string; description: string; minimum?: number; maximum?: number }>
    required: string[]
  }
}

export interface ToolResult {
  content: Array<{ type: 'text'; text: string }>
  isError: boolean
}

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'self.get_device_status',
    description: '获取设备当前状态，包括音量、屏幕、电池、网络连接等信息',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'self.audio_speaker.set_volume',
    description: '设置音量大小',
    inputSchema: {
      type: 'object',
      properties: { volume: { type: 'integer', description: '音量值，范围 0-100', minimum: 0, maximum: 100 } },
      required: ['volume'],
    },
  },
  {
    name: 'self.screen.set_brightness',
    description: '设置屏幕亮度',
    inputSchema: {
      type: 'object',
      properties: { brightness: { type: 'integer', description: '亮度值，范围 30-100（最低 30，防止页面不可见）', minimum: 30, maximum: 100 } },
      required: ['brightness'],
    },
  },
  {
    name: 'self.screen.set_theme',
    description: '设置屏幕主题',
    inputSchema: {
      type: 'object',
      properties: { theme: { type: 'string', description: '"light" 或 "dark"' } },
      required: ['theme'],
    },
  },
  {
    name: 'self.get_system_info',
    description: '获取系统信息（浏览器、语言、屏幕分辨率、运行时间等）',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'self.reboot',
    description: '重启设备（刷新页面）',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'self.upgrade_firmware',
    description: '升级固件（在新标签页打开下载链接）',
    inputSchema: {
      type: 'object',
      properties: { url: { type: 'string', description: '固件下载地址' } },
      required: ['url'],
    },
  },
]

type BatteryManager = { level: number; charging: boolean }
type NavigatorWithBattery = Navigator & { getBattery?(): Promise<BatteryManager> }

export async function handleToolCall(
  name: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  switch (name) {
    case 'self.get_device_status': {
      let battery: { level: number; charging: boolean } | undefined
      try {
        const nav = navigator as NavigatorWithBattery
        if (typeof nav.getBattery === 'function') {
          const bat = await nav.getBattery()
          battery = { level: Math.round(bat.level * 100), charging: bat.charging }
        }
      } catch { /* getBattery not available in this browser */ }

      return {
        isError: false,
        content: [{
          type: 'text',
          text: JSON.stringify({
            volume: getCurrentVolume(),
            screen: { brightness: getCurrentBrightness(), theme: getCurrentTheme() },
            ...(battery !== undefined ? { battery } : {}),
            network: { connected: navigator.onLine },
          }),
        }],
      }
    }

    case 'self.audio_speaker.set_volume': {
      applyVolume(args.volume as number)
      return { isError: false, content: [{ type: 'text', text: 'true' }] }
    }

    case 'self.screen.set_brightness': {
      applyBrightness(args.brightness as number)
      return { isError: false, content: [{ type: 'text', text: 'true' }] }
    }

    case 'self.screen.set_theme': {
      applyTheme(args.theme as 'light' | 'dark')
      return { isError: false, content: [{ type: 'text', text: 'true' }] }
    }

    case 'self.get_system_info': {
      return {
        isError: false,
        content: [{
          type: 'text',
          text: JSON.stringify({
            userAgent: navigator.userAgent,
            language: navigator.language,
            cores: navigator.hardwareConcurrency ?? null,
            screen: { width: screen.width, height: screen.height },
            uptime: Math.round(performance.now() / 1000),
          }),
        }],
      }
    }

    case 'self.reboot': {
      setTimeout(() => location.reload(), 300)
      return { isError: false, content: [{ type: 'text', text: '页面刷新中...' }] }
    }

    case 'self.upgrade_firmware': {
      const url = args.url as string
      window.open(url, '_blank', 'noopener,noreferrer')
      return { isError: false, content: [{ type: 'text', text: `已在新窗口打开: ${url}` }] }
    }

    default:
      return { isError: true, content: [{ type: 'text', text: `未知工具: ${name}` }] }
  }
}
