import { StateCreator } from 'zustand'
import { STORAGE_KEYS, getStorageString, setStorageString } from '../../lib/persistence'

// 相机 / 视觉能力状态
//
// visionUrl / visionToken 来自 MCP initialize 握手时服务端下发的
// capabilities.vision.{url, token}（参考 ESP32 ParseCapabilities）。
//
// cameraEnabled：用户意图 / 开关位置，持久化到 localStorage。
// cameraActive：实际运行态（已拿到权限且 MediaStream 在跑），不持久化。
// cameraError：一行提示小字（权限被拒/被撤销/不支持等）。
// capturedPhotoUrl：拍照后用于在 UI 上短暂展示照片的对象 URL（瞬时，不持久化）。
export interface CameraState {
  visionUrl: string | null
  visionToken: string | null
  cameraEnabled: boolean
  cameraActive: boolean
  cameraError: string | null
  capturedPhotoUrl: string | null
  // actions
  setVisionEndpoint: (url: string, token: string | null) => void
  clearVisionEndpoint: () => void
  setCameraEnabled: (enabled: boolean) => void
  setCameraActive: (active: boolean) => void
  setCameraError: (msg: string | null) => void
  setCapturedPhoto: (url: string | null) => void
}

function loadCameraEnabled(): boolean {
  return getStorageString(STORAGE_KEYS.CAMERA_ENABLED) === 'true'
}

export const createCameraSlice: StateCreator<CameraState> = (set) => ({
  visionUrl: null,
  visionToken: null,
  cameraEnabled: typeof localStorage !== 'undefined' ? loadCameraEnabled() : false,
  cameraActive: false,
  cameraError: null,
  capturedPhotoUrl: null,
  setVisionEndpoint: (visionUrl, visionToken) => set({ visionUrl, visionToken }),
  clearVisionEndpoint: () => set({ visionUrl: null, visionToken: null }),
  setCameraEnabled: (cameraEnabled) => {
    setStorageString(STORAGE_KEYS.CAMERA_ENABLED, cameraEnabled ? 'true' : 'false')
    set({ cameraEnabled })
  },
  setCameraActive: (cameraActive) => set({ cameraActive }),
  setCameraError: (cameraError) => set({ cameraError }),
  setCapturedPhoto: (capturedPhotoUrl) => set({ capturedPhotoUrl }),
})
