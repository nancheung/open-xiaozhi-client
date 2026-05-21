export interface ToolDefinition {
  name: string
  description: string
  inputSchema: {
    type: 'object'
    properties: Record<string, { type: string; description: string; minimum?: number; maximum?: number }>
    required: string[]
  }
}

export interface McpMockState {
  volume: number
  brightness: number
  theme: 'light' | 'dark'
  battery: { level: number; charging: boolean }
  network: { connected: boolean; ssid: string; rssi: number }
  forceError: boolean
}

export interface ToolResult {
  content: Array<{ type: 'text'; text: string }>
  isError: boolean
  newState?: Partial<McpMockState>  // 需要更新的状态
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
      properties: { brightness: { type: 'integer', description: '亮度值，范围 0-100', minimum: 0, maximum: 100 } },
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
    description: '获取系统信息（固件版本、运行时间等）',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'self.reboot',
    description: '重启设备',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'self.upgrade_firmware',
    description: '升级固件',
    inputSchema: {
      type: 'object',
      properties: { url: { type: 'string', description: '固件下载地址' } },
      required: ['url'],
    },
  },
]

export function handleToolCall(
  name: string,
  args: Record<string, unknown>,
  state: McpMockState
): ToolResult {
  if (state.forceError) {
    return { content: [{ type: 'text', text: '设备返回强制错误（测试模式）' }], isError: true }
  }

  switch (name) {
    case 'self.get_device_status':
      return {
        isError: false,
        content: [{
          type: 'text',
          text: JSON.stringify({
            volume: state.volume,
            screen: { brightness: state.brightness, theme: state.theme },
            battery: state.battery,
            network: state.network,
          }),
        }],
      }
    case 'self.audio_speaker.set_volume':
      return { isError: false, content: [{ type: 'text', text: 'true' }], newState: { volume: args.volume as number } }
    case 'self.screen.set_brightness':
      return { isError: false, content: [{ type: 'text', text: 'true' }], newState: { brightness: args.brightness as number } }
    case 'self.screen.set_theme':
      return { isError: false, content: [{ type: 'text', text: 'true' }], newState: { theme: args.theme as 'light' | 'dark' } }
    case 'self.get_system_info':
      return { isError: false, content: [{ type: 'text', text: JSON.stringify({ firmware: '1.0.0', uptime: 3600 }) }] }
    case 'self.reboot':
      return { isError: false, content: [{ type: 'text', text: '设备重启中...' }] }
    case 'self.upgrade_firmware':
      return { isError: false, content: [{ type: 'text', text: `固件升级已启动: ${args.url}` }] }
    default:
      return { isError: true, content: [{ type: 'text', text: `未知工具: ${name}` }] }
  }
}
