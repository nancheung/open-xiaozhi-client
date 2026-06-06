export const STORAGE_KEYS = {
  SETTINGS: 'xiaozhi_settings',
  OTA_URL: 'xiaozhi_ota_url',
  DEVICE_ID: 'xiaozhi_device_id',
  CLIENT_ID: 'xiaozhi_client_id',
  DEVICE_SETTINGS: 'xiaozhi_device_settings',
  PANEL_LAYOUT: 'xiaozhi_panel_layout',
  LOG_PANEL_LAYOUT: 'xiaozhi_log_panel_layout',
  CAMERA_ENABLED: 'xiaozhi_camera_enabled',
} as const

export function getStorageString(key: string): string | null {
  if (typeof localStorage === 'undefined') return null
  return localStorage.getItem(key)
}

export function setStorageString(key: string, value: string): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(key, value)
}

export function getStorageJSON<T>(key: string): T | null {
  const raw = getStorageString(key)
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export function setStorageJSON<T>(key: string, value: T): void {
  setStorageString(key, JSON.stringify(value))
}
