import { useStore } from '@/store'
import { getAppVolume, setAppVolume } from '../mcp/audioControl'

export const MIN_BRIGHTNESS = 30

export function applyVolume(volume: number): void {
  const clamped = Math.max(0, Math.min(100, volume))
  setAppVolume(clamped)
  useStore.getState().setVolume(clamped)
}

export function applyBrightness(brightness: number): void {
  const clamped = Math.max(MIN_BRIGHTNESS, Math.min(100, brightness))
  document.documentElement.style.filter = clamped < 100 ? `brightness(${clamped}%)` : ''
  useStore.getState().setBrightness(clamped)
}

export function applyTheme(theme: 'light' | 'dark'): void {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  useStore.getState().setTheme(theme)
}

export function getCurrentVolume(): number {
  return getAppVolume()
}

export function getCurrentBrightness(): number {
  const filter = document.documentElement.style.filter
  const match = filter.match(/brightness\(([\d.]+)%?\)/)
  return match ? Math.round(parseFloat(match[1])) : 100
}

export function getCurrentTheme(): 'light' | 'dark' {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}
