/// <reference types="vite/client" />

declare const __APP_VERSION__: string
declare const __APP_NPM_NAME__: string

interface Window {
  __OTA_URL__?: string
}
