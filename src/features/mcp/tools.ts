import {
  applyVolume, applyBrightness, applyTheme,
  getCurrentVolume, getCurrentBrightness, getCurrentTheme,
} from '../device/deviceSetters'
import { useStore } from '@/store'
import { startCamera, captureJpeg } from '../camera/cameraCapture'

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
  {
    name: 'self.camera.take_photo',
    description: '请记住你有一个摄像头。当用户让你看某样东西时，使用此工具拍照并解释。\n参数 `question`：你想就这张照片提出的问题。\n返回：包含照片解析信息的文本。',
    inputSchema: {
      type: 'object',
      properties: { question: { type: 'string', description: '你想就这张照片提出的问题' } },
      required: ['question'],
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

    case 'self.camera.take_photo': {
      const { visionUrl, visionToken, deviceId, config } = useStore.getState()
      if (!visionUrl) {
        return { isError: true, content: [{ type: 'text', text: '服务端未提供视觉分析端点' }] }
      }
      const question = (args.question as string) ?? ''
      try {
        // 摄像头未开启时尝试自动开启再抓拍（参考 ESP32 Capture()）
        await startCamera()
        const blob = await captureJpeg()

        const fd = new FormData()
        fd.append('question', question)
        fd.append('file', blob, 'camera.jpg')

        // 不手动设置 Content-Type，由浏览器自动带 multipart boundary
        const headers: Record<string, string> = { 'Device-Id': deviceId }
        if (config.clientId) headers['Client-Id'] = config.clientId
        if (visionToken) headers['Authorization'] = `Bearer ${visionToken}`

        const res = await fetch(visionUrl, { method: 'POST', headers, body: fd })
        if (!res.ok) {
          return { isError: true, content: [{ type: 'text', text: `视觉接口请求失败: HTTP ${res.status}` }] }
        }
        const data = await res.json() as { success?: boolean; response?: string; message?: string }
        if (data.success) {
          return { isError: false, content: [{ type: 'text', text: data.response ?? '' }] }
        }
        return { isError: true, content: [{ type: 'text', text: data.message ?? '视觉分析失败' }] }
      } catch (e) {
        return { isError: true, content: [{ type: 'text', text: `拍照失败: ${(e as Error).message}` }] }
      }
    }

    default:
      return { isError: true, content: [{ type: 'text', text: `未知工具: ${name}` }] }
  }
}
