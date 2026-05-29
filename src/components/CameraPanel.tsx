import { useEffect, useRef } from 'react'
import { Camera, CameraOff } from 'lucide-react'
import { useStore } from '@/store'
import { startCamera, stopCamera, getStream } from '@/features/camera/cameraCapture'
import { Button } from './ui/button'
import { Label } from './ui/label'

// 摄像头实时预览面板。
// 开启后申请 getUserMedia 权限并持续显示预览；当服务端通过 MCP 调用
// self.camera.take_photo 时，从同一视频流抓拍一帧上传到视觉端点。
export function CameraPanel() {
  const cameraActive = useStore((s) => s.cameraActive)
  const cameraError = useStore((s) => s.cameraError)
  const visionUrl = useStore((s) => s.visionUrl)
  const videoRef = useRef<HTMLVideoElement>(null)

  // 把当前 MediaStream 绑定到可见 <video> 上做预览
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const stream = getStream()
    video.srcObject = cameraActive ? stream : null
  }, [cameraActive])

  async function handleToggle() {
    if (cameraActive) {
      stopCamera()
    } else {
      await startCamera().catch(() => { /* 错误已写入 store.cameraError */ })
    }
  }

  return (
    <div className="p-4 space-y-3 max-w-xs">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">摄像头</Label>
        <Button
          variant={cameraActive ? 'secondary' : 'default'}
          size="sm"
          className="h-7 text-xs"
          onClick={handleToggle}
        >
          {cameraActive ? <CameraOff className="h-3.5 w-3.5 mr-1" /> : <Camera className="h-3.5 w-3.5 mr-1" />}
          {cameraActive ? '关闭预览' : '开启预览'}
        </Button>
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
          <span className="text-xs text-muted-foreground">预览未开启</span>
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
