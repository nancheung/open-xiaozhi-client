import { describe, it, expect, vi, beforeEach } from 'vitest'
import { handleToolCall, TOOL_DEFINITIONS } from '../tools'
import { useStore } from '@/store'
import * as cameraCapture from '../../camera/cameraCapture'

beforeEach(() => {
  document.documentElement.className = 'dark'
  document.documentElement.style.filter = ''
})

describe('MCP 工具处理器', () => {
  it('TOOL_DEFINITIONS 包含 8 个工具', () => {
    expect(TOOL_DEFINITIONS).toHaveLength(8)
    const names = TOOL_DEFINITIONS.map(t => t.name)
    expect(names).toContain('self.get_device_status')
    expect(names).toContain('self.audio_speaker.set_volume')
    expect(names).toContain('self.screen.set_brightness')
    expect(names).toContain('self.screen.set_theme')
    expect(names).toContain('self.get_system_info')
    expect(names).toContain('self.reboot')
    expect(names).toContain('self.upgrade_firmware')
    expect(names).toContain('self.camera.take_photo')
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

describe('self.camera.take_photo', () => {
  beforeEach(() => {
    useStore.getState().clearVisionEndpoint()
    useStore.getState().setCameraEnabled(false)
    useStore.getState().setCameraActive(false)
    useStore.getState().setCapturedPhoto(null)
    vi.restoreAllMocks()
    // jsdom 无 createObjectURL/revokeObjectURL，提供桩
    if (!URL.createObjectURL) {
      Object.defineProperty(URL, 'createObjectURL', { value: () => 'blob:mock', writable: true })
    }
    if (!URL.revokeObjectURL) {
      Object.defineProperty(URL, 'revokeObjectURL', { value: () => {}, writable: true })
    }
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-photo')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  })

  it('缺少视觉端点时返回错误', async () => {
    const r = await handleToolCall('self.camera.take_photo', { question: '这是什么' })
    expect(r.isError).toBe(true)
    expect(r.content[0].text).toContain('视觉')
  })

  it('摄像头开关关闭时返回错误', async () => {
    useStore.getState().setVisionEndpoint('http://host/mcp/vision/explain', 'tok')
    useStore.getState().setCameraEnabled(false)
    const r = await handleToolCall('self.camera.take_photo', { question: '看看' })
    expect(r.isError).toBe(true)
    expect(r.content[0].text).toContain('摄像头已关闭')
  })

  it('开关为开但无法访问摄像头时返回错误', async () => {
    useStore.getState().setVisionEndpoint('http://host/mcp/vision/explain', 'tok')
    useStore.getState().setCameraEnabled(true)
    useStore.getState().setCameraActive(false)
    vi.spyOn(cameraCapture, 'startCamera').mockRejectedValue(new Error('无法访问摄像头: denied'))

    const r = await handleToolCall('self.camera.take_photo', { question: '看看' })
    expect(r.isError).toBe(true)
    expect(r.content[0].text).toContain('摄像头')
  })

  it('成功路径返回视觉分析的 response 文本并设置 capturedPhotoUrl', async () => {
    vi.useFakeTimers()
    useStore.getState().setVisionEndpoint('http://host/mcp/vision/explain', 'tok')
    useStore.getState().setCameraEnabled(true)
    useStore.getState().setCameraActive(true)
    vi.spyOn(cameraCapture, 'startCamera').mockResolvedValue()
    const blob = new Blob(['jpegdata'], { type: 'image/jpeg' })
    vi.spyOn(cameraCapture, 'captureJpeg').mockResolvedValue(blob)

    let captured: { url: string; init: RequestInit } | null = null
    const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
      captured = { url, init }
      return {
        ok: true,
        json: async () => ({ success: true, response: '图片中是一只猫' }),
      } as Response
    })
    vi.stubGlobal('fetch', fetchMock)

    const r = await handleToolCall('self.camera.take_photo', { question: '这是什么' })
    expect(r.isError).toBe(false)
    expect(r.content[0].text).toBe('图片中是一只猫')

    // 拍照后照片 URL 被设置用于 UI 短暂展示
    expect(useStore.getState().capturedPhotoUrl).toBe('blob:mock-photo')

    // 校验请求：POST、Authorization、FormData 含 question 与 file
    expect(captured!.url).toBe('http://host/mcp/vision/explain')
    expect(captured!.init.method).toBe('POST')
    const headers = captured!.init.headers as Record<string, string>
    expect(headers['Authorization']).toBe('Bearer tok')
    const fd = captured!.init.body as FormData
    expect(fd.get('question')).toBe('这是什么')
    expect(fd.get('file')).toBeInstanceOf(Blob)

    // 2 秒后照片自动清除
    vi.advanceTimersByTime(2000)
    expect(useStore.getState().capturedPhotoUrl).toBe(null)

    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('视觉接口业务失败时返回错误信息', async () => {
    useStore.getState().setVisionEndpoint('http://host/mcp/vision/explain', null)
    useStore.getState().setCameraEnabled(true)
    useStore.getState().setCameraActive(true)
    vi.spyOn(cameraCapture, 'startCamera').mockResolvedValue()
    vi.spyOn(cameraCapture, 'captureJpeg').mockResolvedValue(new Blob(['x'], { type: 'image/jpeg' }))
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ success: false, message: '您还未设置默认的视觉分析模块' }),
    } as Response)))

    const r = await handleToolCall('self.camera.take_photo', { question: '看看' })
    expect(r.isError).toBe(true)
    expect(r.content[0].text).toBe('您还未设置默认的视觉分析模块')
    vi.unstubAllGlobals()
  })
})
