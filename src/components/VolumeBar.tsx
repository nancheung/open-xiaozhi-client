import { useEffect, useRef } from 'react'

const BAR_COUNT = 10
const BAR_GAP = 2

interface Props {
  analyser: AnalyserNode | null
}

export function VolumeBar({ analyser }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !analyser) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dataArray = new Uint8Array(analyser.frequencyBinCount)
    // --primary 值为 "H S% L%"，构造 hsl() 供 Canvas 使用
    const hsl = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim()
    const primaryColor = hsl ? `hsl(${hsl})` : 'hsl(240 5.9% 10%)'

    function draw() {
      analyser!.getByteFrequencyData(dataArray)

      const W = canvas!.clientWidth || 80
      const H = canvas!.clientHeight || 24
      if (canvas!.width !== W) canvas!.width = W
      if (canvas!.height !== H) canvas!.height = H
      ctx!.clearRect(0, 0, W, H)

      const barW = (W - BAR_GAP * (BAR_COUNT - 1)) / BAR_COUNT
      // 取频谱前 BAR_COUNT 个 bin 的平均能量（低频段，更符合人声）
      const binStep = Math.floor(dataArray.length / 4 / BAR_COUNT)

      for (let i = 0; i < BAR_COUNT; i++) {
        let sum = 0
        for (let j = 0; j < binStep; j++) {
          sum += dataArray[i * binStep + j]
        }
        const avg = sum / binStep / 255
        // 最小高度 2px，避免全消音时视觉空白
        const barH = Math.max(2, avg * H)
        const x = i * (barW + BAR_GAP)
        const y = H - barH

        ctx!.fillStyle = primaryColor
        ctx!.globalAlpha = 0.5 + avg * 0.5
        ctx!.beginPath()
        ctx!.roundRect(x, y, barW, barH, 2)
        ctx!.fill()
      }
      ctx!.globalAlpha = 1

      rafRef.current = requestAnimationFrame(draw)
    }

    rafRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafRef.current)
  }, [analyser])

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-6 rounded"
      aria-label="麦克风音量"
    />
  )
}
