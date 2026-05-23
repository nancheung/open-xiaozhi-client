import { useEffect, useState } from 'react'

const RELEASES_API = 'https://api.github.com/repos/nancheung/open-xiaozhi-client/releases/latest'

function isNewer(latest: string, current: string): boolean {
  const parse = (v: string) => v.replace(/^v/, '').split('.').map(Number)
  const [lMaj, lMin, lPat] = parse(latest)
  const [cMaj, cMin, cPat] = parse(current)
  if (lMaj !== cMaj) return lMaj > cMaj
  if (lMin !== cMin) return lMin > cMin
  return lPat > cPat
}

export function useUpdateCheck() {
  const [hasUpdate, setHasUpdate] = useState(false)
  const [latestVersion, setLatestVersion] = useState('')

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch(RELEASES_API)
        if (!res.ok) return
        const data = await res.json()
        const tag: string = data?.tag_name ?? ''
        if (!tag) return
        setLatestVersion(tag)
        if (isNewer(tag, __APP_VERSION__)) {
          setHasUpdate(true)
        }
      } catch {
        // 静默失败
      }
    })()
  }, [])

  return { hasUpdate, latestVersion }
}
