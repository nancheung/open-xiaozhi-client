import { StateCreator } from 'zustand'

// 相机 / 视觉能力状态
//
// visionUrl / visionToken 来自 MCP initialize 握手时服务端下发的
// capabilities.vision.{url, token}（参考 ESP32 ParseCapabilities）。
// cameraActive / cameraError 描述本地摄像头预览的运行状态。
export interface CameraState {
  visionUrl: string | null
  visionToken: string | null
  cameraActive: boolean
  cameraError: string | null
  // actions
  setVisionEndpoint: (url: string, token: string | null) => void
  clearVisionEndpoint: () => void
  setCameraActive: (active: boolean) => void
  setCameraError: (msg: string | null) => void
}

export const createCameraSlice: StateCreator<CameraState> = (set) => ({
  visionUrl: null,
  visionToken: null,
  cameraActive: false,
  cameraError: null,
  setVisionEndpoint: (visionUrl, visionToken) => set({ visionUrl, visionToken }),
  clearVisionEndpoint: () => set({ visionUrl: null, visionToken: null }),
  setCameraActive: (cameraActive) => set({ cameraActive }),
  setCameraError: (cameraError) => set({ cameraError }),
})
