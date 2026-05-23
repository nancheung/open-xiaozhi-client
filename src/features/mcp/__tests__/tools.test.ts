import { describe, it, expect, vi, beforeEach } from 'vitest'
import { handleToolCall, TOOL_DEFINITIONS } from '../tools'

beforeEach(() => {
  document.documentElement.className = 'dark'
  document.documentElement.style.filter = ''
})

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

  it('get_device_status 返回含 volume/screen/network 的 JSON', async () => {
    const r = await handleToolCall('self.get_device_status', {})
    expect(r.isError).toBe(false)
    const parsed = JSON.parse(r.content[0].text)
    expect(typeof parsed.volume).toBe('number')
    expect(parsed.screen).toBeDefined()
    expect(typeof parsed.network.connected).toBe('boolean')
  })

  it('set_volume 返回 true', async () => {
    const r = await handleToolCall('self.audio_speaker.set_volume', { volume: 50 })
    expect(r.isError).toBe(false)
    expect(r.content[0].text).toBe('true')
  })

  it('set_brightness 应用 CSS filter 并返回 true', async () => {
    const r = await handleToolCall('self.screen.set_brightness', { brightness: 50 })
    expect(r.isError).toBe(false)
    expect(r.content[0].text).toBe('true')
    expect(document.documentElement.style.filter).toContain('brightness(50%)')
  })

  it('set_brightness 100 时清除 filter', async () => {
    document.documentElement.style.filter = 'brightness(50%)'
    await handleToolCall('self.screen.set_brightness', { brightness: 100 })
    expect(document.documentElement.style.filter).toBe('')
  })

  it('set_theme dark 添加 dark 类', async () => {
    document.documentElement.classList.remove('dark')
    const r = await handleToolCall('self.screen.set_theme', { theme: 'dark' })
    expect(r.isError).toBe(false)
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('set_theme light 移除 dark 类', async () => {
    const r = await handleToolCall('self.screen.set_theme', { theme: 'light' })
    expect(r.isError).toBe(false)
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('get_system_info 返回 userAgent 和 uptime', async () => {
    const r = await handleToolCall('self.get_system_info', {})
    expect(r.isError).toBe(false)
    const parsed = JSON.parse(r.content[0].text)
    expect(typeof parsed.userAgent).toBe('string')
    expect(typeof parsed.uptime).toBe('number')
  })

  it('reboot 返回刷新提示', async () => {
    vi.useFakeTimers()
    const r = await handleToolCall('self.reboot', {})
    expect(r.isError).toBe(false)
    expect(r.content[0].text).toContain('刷新')
    vi.useRealTimers()
  })

  it('upgrade_firmware 返回 URL 确认', async () => {
    window.open = vi.fn()
    const r = await handleToolCall('self.upgrade_firmware', { url: 'https://example.com/fw.bin' })
    expect(r.isError).toBe(false)
    expect(r.content[0].text).toContain('https://example.com/fw.bin')
    expect(window.open).toHaveBeenCalledWith('https://example.com/fw.bin', '_blank', 'noopener,noreferrer')
  })

  it('未知工具返回错误', async () => {
    const r = await handleToolCall('unknown.tool', {})
    expect(r.isError).toBe(true)
  })
})
