import { useEffect, useRef, useState } from 'react'
import type { TurnTiming } from '../features/latency/latencySlice'
import { formatMs, formatTime, turnDeltas, turnTag } from '../features/latency/format'

// 像素制内边距（左侧留给 y 轴刻度，底部留给 x 轴时间标签）
const PAD_L = 36
const PAD_R = 8
const PAD_T = 10
const PAD_B = 20

interface Point {
  turn: TurnTiming
  v: number          // 用户等待 ms
  cx: number
  cy: number
}

interface Hover {
  turn: TurnTiming
  idx: number
  left: number
  top: number
}

/**
 * 「用户说完话 → 服务器开始说话」毫秒值折线图。
 * 每个节点 = 一轮对话；仅绘制有该指标的轮（问候/未完成轮跳过）。
 * 采用真实像素坐标系，配合 ResizeObserver 自适应容器，避免比例失真。
 */
export function LatencyChart({ turns }: { turns: TurnTiming[] }) {
  const sizeRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [hover, setHover] = useState<Hover | null>(null)

  useEffect(() => {
    const el = sizeRef.current
    if (!el) return
    const update = () => setSize({ w: el.clientWidth, h: el.clientHeight })
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // 收集有「用户等待」值的轮
  const valued = turns
    .map((turn) => ({ turn, v: turnDeltas(turn).userWait }))
    .filter((p): p is { turn: TurnTiming; v: number } => p.v != null)

  const { w, h } = size

  if (valued.length === 0) {
    return (
      <div className="flex-1 min-h-0 flex items-center justify-center">
        <p className="text-xs text-muted-foreground/40 italic">暂无可绘制的数据</p>
      </div>
    )
  }

  const vals = valued.map((p) => p.v)
  const rawMax = Math.max(...vals)
  const minV = Math.min(...vals)
  const niceMax = Math.max(100, Math.ceil(rawMax / 100) * 100)
  const avg = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)

  const innerW = w - PAD_L - PAD_R
  const innerH = h - PAD_T - PAD_B
  const n = valued.length
  const xOf = (k: number) => PAD_L + (n === 1 ? innerW / 2 : (k / (n - 1)) * innerW)
  const yOf = (v: number) => PAD_T + innerH - (v / niceMax) * innerH

  const points: Point[] = valued.map((p, k) => ({
    turn: p.turn, v: p.v, cx: xOf(k), cy: yOf(p.v),
  }))

  const linePts = points.map((p) => `${p.cx.toFixed(1)},${p.cy.toFixed(1)}`).join(' ')
  const baseY = PAD_T + innerH
  const areaPts = `${PAD_L},${baseY} ${linePts} ${xOf(n - 1).toFixed(1)},${baseY}`

  const yTicks = [0, niceMax / 2, niceMax]
  const avgY = yOf(avg)

  // x 轴标签：首 / 中 / 尾
  const xIdx = [...new Set(n <= 1 ? [0] : [0, Math.floor((n - 1) / 2), n - 1])]

  function showTip(idx: number, el: SVGCircleElement) {
    const wrap = sizeRef.current
    if (!wrap) return
    const wr = wrap.getBoundingClientRect()
    const hr = el.getBoundingClientRect()
    const TIP_W = 176
    const TIP_H = 132
    let left = hr.left - wr.left + hr.width / 2 - TIP_W / 2
    left = Math.max(2, Math.min(left, wr.width - TIP_W - 2))
    let top = hr.top - wr.top - TIP_H - 8
    if (top < 0) top = hr.bottom - wr.top + 8
    setHover({ turn: points[idx].turn, idx, left, top })
  }

  // 尺寸尚未测量到（首帧）或过小则不绘制，避免拉伸闪烁
  const ready = w > 0 && h > 0 && innerW > 0 && innerH > 0

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div ref={sizeRef} className="relative flex-1 min-h-0">
      {ready && (
        <svg width={w} height={h} className="block overflow-visible">
          {/* y 网格 + 刻度 */}
          {yTicks.map((v) => {
            const y = yOf(v)
            return (
              <g key={v}>
                <line x1={PAD_L} y1={y} x2={w - PAD_R} y2={y} className="stroke-border" strokeWidth={0.6} />
                <text x={PAD_L - 4} y={y + 3} textAnchor="end" className="fill-muted-foreground/60 font-mono" fontSize={9}>{v}</text>
              </g>
            )
          })}
          {/* 均值虚线 */}
          <line x1={PAD_L} y1={avgY} x2={w - PAD_R} y2={avgY} className="stroke-blue-400/70" strokeWidth={0.8} strokeDasharray="4 3" />
          <text x={w - PAD_R} y={avgY - 3} textAnchor="end" className="fill-blue-400 font-mono" fontSize={9}>均 {avg}</text>
          {/* 面积 + 折线 */}
          <polygon points={areaPts} className="fill-amber-500/15" />
          <polyline points={linePts} fill="none" className="stroke-amber-500" strokeWidth={1.5} strokeLinejoin="round" />
          {/* 节点（命中圆在前，可视圆在后） */}
          {points.map((p, k) => (
            <g key={p.turn.id}>
              <circle
                cx={p.cx} cy={p.cy} r={9} fill="transparent" className="cursor-pointer"
                onMouseEnter={(e) => showTip(k, e.currentTarget)}
                onMouseLeave={() => setHover(null)}
              />
              <circle
                cx={p.cx} cy={p.cy} r={hover?.idx === k ? 4.5 : 3}
                className={hover?.idx === k ? 'fill-amber-500 stroke-amber-500' : 'fill-background stroke-amber-500'}
                strokeWidth={1.5}
                style={{ pointerEvents: 'none' }}
              />
            </g>
          ))}
          {/* x 轴时间标签 */}
          {xIdx.map((k) => (
            <text key={k} x={xOf(k)} y={h - 6} textAnchor="middle" className="fill-muted-foreground/40 font-mono" fontSize={8}>
              {formatTime(valued[k].turn.userStopAt).slice(0, 8)}
            </text>
          ))}
        </svg>
      )}

      {/* tooltip */}
      {hover && <ChartTooltip turn={hover.turn} idx={hover.idx} left={hover.left} top={hover.top} />}
      </div>

      {/* 统计条 */}
      <div className="shrink-0 flex gap-3 px-3 py-1 border-t border-border/40 text-[10px] text-muted-foreground tabular-nums">
        <span>样本 <b className="text-foreground/90 font-semibold">{n}</b></span>
        <span>最小 <b className="text-foreground/90 font-semibold">{formatMs(minV)}</b></span>
        <span>均值 <b className="text-amber-500 font-semibold">{formatMs(avg)}</b></span>
        <span>最大 <b className="text-foreground/90 font-semibold">{formatMs(rawMax)}</b></span>
      </div>
    </div>
  )
}

function ChartTooltip({ turn, idx, left, top }: { turn: TurnTiming; idx: number; left: number; top: number }) {
  const d = turnDeltas(turn)
  const tag = turnTag(turn)
  const Row = ({ k, v }: { k: string; v: string }) => (
    <div className="flex justify-between gap-2.5">
      <span className="text-muted-foreground/85">{k}</span>
      <span className="text-foreground/90 tabular-nums">{v}</span>
    </div>
  )
  return (
    <div
      className="absolute z-20 pointer-events-none rounded-md border bg-popover px-2 py-1.5 text-[11px] leading-relaxed shadow-lg"
      style={{ left, top, width: 176 }}
    >
      <div className="flex justify-between gap-2.5 mb-0.5">
        <span className="text-muted-foreground">第 {idx + 1} 轮 用户等待</span>
        <span className="text-amber-500 font-bold tabular-nums">{formatMs(d.userWait)}</span>
      </div>
      <Row k="录音时长" v={formatMs(d.recording)} />
      <Row k="进入状态延迟" v={formatMs(d.enterDelay)} />
      <Row k="出声延迟" v={formatMs(d.speakDelay)} />
      <Row k="用户说完" v={formatTime(turn.userStopAt)} />
      <Row k="开始说话" v={formatTime(turn.serverSpeakAt)} />
      {tag && <Row k="类型" v={tag} />}
    </div>
  )
}
