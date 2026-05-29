// cameraCapture.ts — 浏览器摄像头采集
//
// 参考 ESP32 固件 esp32_camera.cc 的 Capture()/Explain() 逻辑：
// 在 Web 端，用 getUserMedia 取得视频流，需要拍照时从当前帧抓拍一张 JPEG。
//
// 模块级持有 MediaStream 和一个内部隐藏 <video>，保证即便预览面板未挂载，
// 也能可靠地抓帧（预览面板只是把同一个 stream 绑定到可见 <video> 上）。

import { useStore } from '@/store'

let stream: MediaStream | null = null
let hiddenVideo: HTMLVideoElement | null = null

function store() {
  return useStore.getState()
}

function ensureHiddenVideo(): HTMLVideoElement {
  if (!hiddenVideo) {
    const v = document.createElement('video')
    v.muted = true
    v.playsInline = true
    v.setAttribute('playsinline', '')
    v.style.position = 'fixed'
    v.style.left = '-9999px'
    v.style.top = '0'
    v.style.width = '1px'
    v.style.height = '1px'
    document.body.appendChild(v)
    hiddenVideo = v
  }
  return hiddenVideo
}

export async function startCamera(): Promise<void> {
  if (stream) return
  if (!navigator.mediaDevices?.getUserMedia) {
    const msg = '当前环境不支持摄像头（需要 https 或 localhost）'
    store().setCameraError(msg)
    throw new Error(msg)
  }
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
    const video = ensureHiddenVideo()
    video.srcObject = stream
    await video.play().catch(() => { /* autoplay 限制下忽略，抓帧仍可用 */ })
    store().setCameraError(null)
    store().setCameraActive(true)
  } catch (e) {
    stream = null
    const msg = `无法打开摄像头: ${(e as Error).message}`
    store().setCameraError(msg)
    store().setCameraActive(false)
    throw new Error(msg)
  }
}

export function stopCamera(): void {
  if (stream) {
    stream.getTracks().forEach(t => t.stop())
    stream = null
  }
  if (hiddenVideo) {
    hiddenVideo.srcObject = null
  }
  store().setCameraActive(false)
}

export function getStream(): MediaStream | null {
  return stream
}

// 从当前视频帧抓拍一张 JPEG（质量 0.8，对齐 ESP32 固件的 JPEG quality 80）
export async function captureJpeg(): Promise<Blob> {
  if (!stream) {
    throw new Error('摄像头未开启')
  }
  const video = ensureHiddenVideo()
  const width = video.videoWidth
  const height = video.videoHeight
  if (!width || !height) {
    throw new Error('摄像头画面尚未就绪')
  }
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('无法创建 canvas 上下文')
  }
  ctx.drawImage(video, 0, 0, width, height)

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error('JPEG 编码失败'))
      },
      'image/jpeg',
      0.8,
    )
  })
}
