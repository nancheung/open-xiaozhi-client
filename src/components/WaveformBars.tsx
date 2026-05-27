import { useEffect, useRef } from 'react'

const BAR_COUNT = 32
const BAR_GAP = 1

interface Props {
  analyser: AnalyserNode | null
}

export function WaveformBars({ analyser }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !analyser) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dataArray = new Uint8Array(analyser.fftSize)
    const hsl = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim()
    const primaryColor = hsl ? `hsl(${hsl})` : 'hsl(240 5.9% 10%)'

    function draw() {
      analyser!.getByteTimeDomainData(dataArray)

      const W = canvas!.clientWidth || 200
      const H = canvas!.clientHeight || 32
      if (canvas!.width !== W) canvas!.width = W
      if (canvas!.height !== H) canvas!.height = H
      ctx!.clearRect(0, 0, W, H)

      const barW = (W - BAR_GAP * (BAR_COUNT - 1)) / BAR_COUNT
      const step = Math.floor(dataArray.length / BAR_COUNT)

      ctx!.fillStyle = primaryColor
      ctx!.globalAlpha = 0.7

      for (let i = 0; i < BAR_COUNT; i++) {
        // 时域数据 128=静音，>128=正压，<128=负压，取偏移量做对称波形
        const sample = dataArray[i * step] / 128 - 1   // [-1, 1]
        const magnitude = Math.abs(sample)
        const barH = Math.max(2, magnitude * H)
        const x = i * (barW + BAR_GAP)
        const y = (H - barH) / 2

        ctx!.beginPath()
        ctx!.roundRect(x, y, barW, barH, 1)
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
      className="w-full h-8 rounded"
      aria-label="音频波形"
    />
  )
}
