import { useEffect, useRef } from 'react'
import { useStore } from '@/store'
import { enableCamera, disableCamera, getStream } from '@/features/camera/cameraCapture'
import { Label } from './ui/label'
import { Switch } from './ui/switch'

// 摄像头开关 + 实时预览面板。
//
// 开关（cameraEnabled）是持久化的用户意图；预览/拍照能否真正工作取决于运行态
// cameraActive（是否拿到权限且流在跑）。当服务端通过 MCP 调用
// self.camera.take_photo 时，从同一视频流抓拍一帧上传到视觉端点。
export function CameraPanel() {
  const cameraEnabled = useStore((s) => s.cameraEnabled)
  const cameraActive = useStore((s) => s.cameraActive)
  const cameraError = useStore((s) => s.cameraError)
  const visionUrl = useStore((s) => s.visionUrl)
  const videoRef = useRef<HTMLVideoElement>(null)

  // 仅在实际运行态时把 MediaStream 绑定到可见 <video> 做预览
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.srcObject = cameraActive ? getStream() : null
  }, [cameraActive])

  function handleToggle(checked: boolean) {
    if (checked) {
      void enableCamera()
    } else {
      disableCamera()
    }
  }

  return (
    <div className="p-4 space-y-3 max-w-xs">
      <div className="flex items-center justify-between">
        <Label htmlFor="camera-switch" className="text-sm font-medium cursor-pointer">摄像头</Label>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{cameraEnabled ? '开' : '关'}</span>
          <Switch id="camera-switch" checked={cameraEnabled} onCheckedChange={handleToggle} />
        </div>
      </div>

      <div className="relative aspect-video w-full rounded-lg overflow-hidden bg-muted flex items-center justify-center">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className={cameraActive ? 'w-full h-full object-cover' : 'hidden'}
        />
        {!cameraActive && (
          <span className="text-xs text-muted-foreground">
            {cameraEnabled ? '摄像头不可用' : '摄像头已关闭'}
          </span>
        )}
      </div>

      {cameraError && (
        <p className="text-xs text-destructive">{cameraError}</p>
      )}

      <p className="text-xs text-muted-foreground">
        {visionUrl
          ? '已连接视觉端点，AI 可调用拍照功能。'
          : '连接到支持视觉能力的服务端后，AI 即可调用拍照功能。'}
      </p>
    </div>
  )
}
