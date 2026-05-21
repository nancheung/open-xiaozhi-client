export interface IotProperty {
  description: string
  type: 'number' | 'boolean' | 'string'
  access?: 'read_only' | 'read_write' | 'write_only'
}

export interface IotMethod {
  description: string
  parameters?: Record<string, { type: string; description: string }>
}

export interface IotDescriptor {
  name: string
  description: string
  properties?: Record<string, IotProperty>
  methods?: Record<string, IotMethod>
}

export interface IotStateDevice {
  name: string
  state: Record<string, number | boolean | string>
}

export const DEFAULT_DESCRIPTORS: IotDescriptor[] = [
  {
    name: 'Speaker',
    description: '音频播放设备',
    properties: {
      volume: { description: '当前音量 0-100', type: 'number', access: 'read_write' },
      is_muted: { description: '是否静音', type: 'boolean', access: 'read_write' },
    },
    methods: {
      SetVolume: {
        description: '设置音量',
        parameters: { volume: { type: 'number', description: '目标音量 0-100' } },
      },
    },
  },
  {
    name: 'Screen',
    description: '屏幕显示设备',
    properties: {
      brightness: { description: '亮度 0-100', type: 'number', access: 'read_write' },
      theme: { description: '主题 light/dark', type: 'string', access: 'read_write' },
    },
    methods: {
      SetBrightness: {
        description: '设置亮度',
        parameters: { brightness: { type: 'number', description: '亮度值 0-100' } },
      },
    },
  },
]

export const DEFAULT_STATES: IotStateDevice[] = [
  { name: 'Speaker', state: { volume: 80, is_muted: false } },
  { name: 'Screen', state: { brightness: 80, theme: 'dark' } },
]
