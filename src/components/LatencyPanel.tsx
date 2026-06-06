import { useState } from 'react'
import { useStore } from '../store'
import { Button } from './ui/button'
import { ScrollArea } from './ui/scroll-area'
import { cn } from '@/lib/utils'
import type { TurnTiming } from '../features/latency/latencySlice'
import { formatMs, formatTime, turnDeltas, turnTag } from '../features/latency/format'
import { LatencyChart } from './LatencyChart'

type ViewMode = 'list' | 'graph'

/**
 * 「耗时分析」框：可视化每轮对话各阶段耗时，突出「用户说完话 → 服务器开始说话」的等待。
 * 列表模式展示最新轮明细 + 历史；图表模式以折线图展示历轮等待趋势。
 */
export function LatencyPanel() {
  const turns = useStore((s) => s.turns)
  const clearLatency = useStore((s) => s.clearLatency)
  const [mode, setMode] = useState<ViewMode>('list')

  return (
    <div className="flex flex-col flex-1 overflow-hidden min-h-0">
      <div className="flex items-center justify-between gap-2 px-3 py-1.5 border-b shrink-0">
        <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
          耗时分析 <span className="tabular-nums">({turns.length})</span>
        </span>
        <div className="flex items-center gap-1.5">
          <div className="inline-flex rounded-md border overflow-hidden">
            {(['list', 'graph'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  'text-[11px] h-[22px] px-2.5 transition-colors',
                  mode === m ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground/90'
                )}
              >
                {m === 'list' ? '列表' : '图表'}
              </button>
            ))}
          </div>
          <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={clearLatency}>
            清空
          </Button>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
        {mode === 'graph' ? <LatencyChart turns={turns} /> : <LatencyList turns={turns} />}
      </div>
    </div>
  )
}

function LatencyList({ turns }: { turns: TurnTiming[] }) {
  if (turns.length === 0) {
    return (
      <div className="flex-1 min-h-0 flex items-center justify-center">
        <p className="text-xs text-muted-foreground/40 italic">暂无数据，对话后将显示耗时</p>
      </div>
    )
  }

  const latest = turns[turns.length - 1]
  const d = turnDeltas(latest)
  const past = [...turns.slice(0, -1)].reverse()

  return (
    <>
      <div className="px-3 py-2 border-b shrink-0">
        <div className="flex items-baseline justify-between">
          <span className="text-[11px] text-muted-foreground">用户说完话 → 服务器开始说话</span>
          <span className="font-mono font-semibold text-lg tabular-nums text-amber-500">{formatMs(d.userWait)}</span>
        </div>
        <div className="grid grid-cols-3 gap-x-2 mt-1.5 text-[11px] font-mono">
          <Stat label="录音时长" value={formatMs(d.recording)} />
          <Stat label="进入状态延迟" value={formatMs(d.enterDelay)} />
          <Stat label="出声延迟" value={formatMs(d.speakDelay)} />
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 mt-1.5 text-[11px] font-mono text-muted-foreground/80">
          <Mile label="用户开始" ts={latest.userStartAt} />
          <Mile label="用户说完" ts={latest.userStopAt} />
          <Mile label="进入说话" ts={latest.serverEnterAt} />
          <Mile label="开始说话" ts={latest.serverSpeakAt} />
        </div>
      </div>

      {past.length > 0 && (
        <>
          <div className="text-[10px] text-muted-foreground/40 text-center py-1 shrink-0">── 历史 ──</div>
          <ScrollArea className="flex-1 min-h-0">
            <div className="px-3 pb-1">
              {past.map((t) => {
                const td = turnDeltas(t)
                const tag = turnTag(t)
                return (
                  <div key={t.id} className="flex gap-2 py-0.5 border-b border-border/20 text-[11px] font-mono items-center">
                    <span className="text-muted-foreground/60 w-[96px] shrink-0 tabular-nums">
                      {formatTime(t.userStopAt ?? t.serverEnterAt)}
                    </span>
                    <span className="text-amber-500 font-semibold tabular-nums w-[60px] shrink-0">{formatMs(td.userWait)}</span>
                    <span className="text-muted-foreground/70 tabular-nums min-w-0 truncate">
                      录{formatMs(td.recording)} · 入{formatMs(td.enterDelay)} · 声{formatMs(td.speakDelay)}
                      {tag && <span className="text-muted-foreground/40">（{tag}）</span>}
                    </span>
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        </>
      )}
    </>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-muted-foreground/70">{label}</span>
      <span className="tabular-nums text-foreground/90">{value}</span>
    </div>
  )
}

function Mile({ label, ts }: { label: string; ts: number | null }) {
  return (
    <span className="tabular-nums">
      <span className="text-muted-foreground">{label}</span> {formatTime(ts)}
    </span>
  )
}
