// 摄像头/视觉端口：封装拍照 + 视觉分析 HTTP 调用与照片预览生命周期。

export interface VisionResult {
  ok: boolean
  text: string
}

export interface CameraVisionPort {
  isEnabled(): boolean
  isActive(): boolean
  /** 开关为开但流未运行时的兜底启动。 */
  ensureStarted(): Promise<void>
  enable(): Promise<void>
  disable(): void
  /** 拍照并请求视觉端点分析；内部负责照片预览的短暂展示。 */
  captureAndAnalyse(question: string): Promise<VisionResult>
}
