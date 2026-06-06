// 设备控制端口：音量/亮度/主题/系统信息/重启/固件。MCP 工具执行只依赖此端口，
// 不直接碰 DOM / store / fetch，从而可注入假端口进行单元测试。

export interface DeviceStatus {
  volume: number
  screen: { brightness: number; theme: 'light' | 'dark' }
  battery?: { level: number; charging: boolean }
  network: { connected: boolean }
}

export interface SystemInfo {
  userAgent: string
  language: string
  cores: number | null
  screen: { width: number; height: number }
  uptime: number
}

export interface DeviceControlPort {
  getStatus(): Promise<DeviceStatus>
  setVolume(value: number): void
  setBrightness(value: number): void
  setTheme(theme: 'light' | 'dark'): void
  getSystemInfo(): SystemInfo
  reboot(): void
  openFirmware(url: string): void
}
