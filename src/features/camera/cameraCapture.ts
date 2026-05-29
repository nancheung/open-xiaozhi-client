// cameraCapture.ts — 浏览器摄像头采集
//
// 参考 ESP32 固件 esp32_camera.cc 的 Capture()/Explain() 逻辑：
// 在 Web 端，用 getUserMedia 取得视频流，需要拍照时从当前帧抓拍一张 JPEG。
//
// 模块级持有 MediaStream 和一个内部隐藏 <video>，保证即便预览面板未挂载，
// 也能可靠地抓帧（预览面板只是把同一个 stream 绑定到可见 <video> 上）。
//
// 状态区分：
//   cameraEnabled（store，持久化）= 用户意图 / 开关位置
//   cameraActive （store，运行态）  = 已拿到权限且流在跑
// 本模块负责真正的硬件操作并同步 cameraActive；cameraEnabled 由编排函数维护。

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

// 低层：申请权限并启动流。成功置 cameraActive=true，失败抛错。
// 不修改 cameraEnabled —— 由编排函数（enableCamera/disableCamera）负责。
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

    // 监听权限被手动撤销 / 设备拔出：流结束时仅置运行态为 false 并提示，
    // 不改 cameraEnabled（持久化的开关保持"开"）。
    stream.getTracks().forEach((track) => {
      track.addEventListener('ended', () => {
        stream = null
        if (hiddenVideo) hiddenVideo.srcObject = null
        store().setCameraActive(false)
        store().setCameraError('摄像头已停止（权限被撤销或设备断开）')
      })
    })

    store().setCameraError(null)
    store().setCameraActive(true)
  } catch (e) {
    stream = null
    const msg = `无法访问摄像头: ${(e as Error).message}`
    store().setCameraError(msg)
    store().setCameraActive(false)
    throw new Error(msg)
  }
}

// 低层：停止流、释放硬件。不修改 cameraEnabled。
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

// 编排：用户点开开关。成功才把开关持久化为开；被拒绝则开关回弹为关。
export async function enableCamera(): Promise<void> {
  try {
    await startCamera()
    store().setCameraEnabled(true)
  } catch {
    // startCamera 已设置 cameraError / cameraActive=false
    store().setCameraEnabled(false)
  }
}

// 编排：用户点关开关。持久化为关并释放硬件。
export function disableCamera(): void {
  store().setCameraEnabled(false)
  store().setCameraError(null)
  stopCamera()
}

// 编排：页面加载时，若持久化开关为开，仅在浏览器已授权时自动开启（不弹权限框）。
export async function autoStartIfGranted(): Promise<void> {
  if (!store().cameraEnabled) return
  try {
    const perms = navigator.permissions as
      { query?: (d: { name: PermissionName }) => Promise<PermissionStatus> } | undefined
    if (!perms?.query) return // Permissions API 不可用：不自动开启，避免弹框
    const status = await perms.query({ name: 'camera' as PermissionName })
    if (status.state === 'granted') {
      await startCamera().catch(() => { /* 提示已写入 store */ })
    }
  } catch {
    // 某些浏览器不支持 'camera' 查询：保持关闭，不弹框
  }
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
