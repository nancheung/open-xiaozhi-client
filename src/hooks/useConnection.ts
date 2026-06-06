// 兼容 hook：连接相关意图统一通过 AppRuntime 命令分发。
// 保留原 API 形态（connect/disconnect/sendUpdate/sendRestart/status/sessionId），
// 供 ConnectionHeader、HttpPanel 等使用。会话级 listen/abort 已由会话状态机接管。
import { useCallback } from 'react'
import { useStore } from '../store'
import { useDispatch } from '../ui/runtime/RuntimeContext'

export function useConnection() {
  const status = useStore(s => s.status)
  const sessionId = useStore(s => s.sessionId)
  const dispatch = useDispatch()

  const connect = useCallback(() => dispatch({ type: 'Connect' }), [dispatch])
  const disconnect = useCallback(() => dispatch({ type: 'Disconnect' }), [dispatch])
  const sendUpdate = useCallback(
    (secret: string) => dispatch({ type: 'ServerAction', action: 'update_config', secret }),
    [dispatch],
  )
  const sendRestart = useCallback(
    (secret: string) => dispatch({ type: 'ServerAction', action: 'restart', secret }),
    [dispatch],
  )

  return { connect, disconnect, sendUpdate, sendRestart, status, sessionId }
}
