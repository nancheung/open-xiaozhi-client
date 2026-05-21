import { describe, it, expect } from 'vitest'
import { handleToolCall, TOOL_DEFINITIONS } from '../tools'
import type { McpMockState } from '../tools'

const mockState: McpMockState = {
  volume: 70, brightness: 80, theme: 'dark',
  battery: { level: 85, charging: false },
  network: { connected: true, ssid: 'HomeWiFi', rssi: -55 },
  forceError: false,
}

describe('MCP 工具处理器', () => {
  it('TOOL_DEFINITIONS 包含 7 个工具', () => {
    expect(TOOL_DEFINITIONS).toHaveLength(7)
    const names = TOOL_DEFINITIONS.map(t => t.name)
    expect(names).toContain('self.get_device_status')
    expect(names).toContain('self.audio_speaker.set_volume')
    expect(names).toContain('self.screen.set_brightness')
    expect(names).toContain('self.screen.set_theme')
    expect(names).toContain('self.get_system_info')
    expect(names).toContain('self.reboot')
    expect(names).toContain('self.upgrade_firmware')
  })

  it('get_device_status 返回含 volume/brightness 的 JSON', () => {
    const r = handleToolCall('self.get_device_status', {}, mockState)
    expect(r.isError).toBe(false)
    const parsed = JSON.parse(r.content[0].text)
    expect(parsed.volume).toBe(70)
    expect(parsed.screen.brightness).toBe(80)
  })

  it('set_volume 更新状态返回 true', () => {
    const r = handleToolCall('self.audio_speaker.set_volume', { volume: 50 }, mockState)
    expect(r.isError).toBe(false)
    expect(r.content[0].text).toBe('true')
    expect(r.newState?.volume).toBe(50)
  })

  it('set_brightness 更新状态', () => {
    const r = handleToolCall('self.screen.set_brightness', { brightness: 30 }, mockState)
    expect(r.newState?.brightness).toBe(30)
  })

  it('set_theme 接受 light/dark', () => {
    const r = handleToolCall('self.screen.set_theme', { theme: 'light' }, mockState)
    expect(r.newState?.theme).toBe('light')
  })

  it('forceError=true 时返回错误', () => {
    const r = handleToolCall('self.audio_speaker.set_volume', { volume: 50 }, { ...mockState, forceError: true })
    expect(r.isError).toBe(true)
  })

  it('未知工具返回错误', () => {
    const r = handleToolCall('unknown.tool', {}, mockState)
    expect(r.isError).toBe(true)
  })
})
