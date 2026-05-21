import { useStore } from '../store'
import { Button } from './ui/button'
import { Textarea } from './ui/textarea'
import { ScrollArea } from './ui/scroll-area'
import { Separator } from './ui/separator'

export function IotPanel() {
  const descriptorsJson = useStore(s => s.descriptorsJson)
  const jsonError = useStore(s => s.jsonError)
  const receivedCommands = useStore(s => s.receivedCommands)
  const setDescriptorsJson = useStore(s => s.setDescriptorsJson)
  const applyJsonEdit = useStore(s => s.applyJsonEdit)
  const clearCommands = useStore(s => s.clearCommands)

  return (
    <div className="flex flex-col gap-4 p-4 h-full overflow-auto">
      {/* 设备描述符编辑器 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">IoT 设备描述符</span>
          <Button
            size="sm"
            className="h-7 text-xs"
            onClick={() => applyJsonEdit()}
            disabled={!!jsonError}
          >
            应用
          </Button>
        </div>
        <Textarea
          className="font-mono text-xs resize-y min-h-40"
          value={descriptorsJson}
          onChange={e => setDescriptorsJson(e.target.value)}
          spellCheck={false}
        />
        {jsonError && (
          <p className="text-xs text-destructive">{jsonError}</p>
        )}
        <p className="text-[10px] text-muted-foreground">
          修改描述符后点击「应用」使其生效，服务器会在 hello 后查询此配置。
        </p>
      </div>

      <Separator />

      {/* 收到的 IoT 命令 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">
            收到的 IoT 命令
            <span className="ml-1 text-xs text-muted-foreground tabular-nums">({receivedCommands.length})</span>
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={clearCommands}
            disabled={receivedCommands.length === 0}
          >
            清空
          </Button>
        </div>
        <ScrollArea className="h-40 border rounded-md bg-muted/20">
          <div className="p-2 space-y-1">
            {receivedCommands.length === 0 ? (
              <p className="text-xs text-muted-foreground/40 text-center py-4 italic">暂无 IoT 命令</p>
            ) : (
              receivedCommands.map((cmd, i) => (
                <div key={i} className="text-[11px] font-mono bg-muted rounded px-2 py-1 break-all">
                  {JSON.stringify(cmd.commands)}
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
