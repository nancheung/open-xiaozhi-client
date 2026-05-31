import { useCallback } from 'react'
import { useStore } from '../store'
import { connect, disconnect, sendJson } from '../ws/wsManager'
import { buildListen, buildAbort, buildServerAction } from '../features/protocol/types'

export function useConnection() {
  const sessionId = useStore(s => s.sessionId)
  const status = useStore(s => s.status)

  const handleConnect = useCallback(() => {
    void connect()
  }, [])

  const handleDisconnect = useCallback(() => {
    disconnect()
  }, [])

  const sendListen = useCallback((
    state: 'start' | 'stop' | 'detect',
    opts?: { mode?: 'auto' | 'manual' | 'realtime'; text?: string }
  ) => {
    if (!sessionId) return
    const msg = buildListen(state, sessionId, opts)
    sendJson(msg)
    useStore.getState().addLog('out', msg)
  }, [sessionId])

  const sendAbort = useCallback((reason?: 'wake_word_detected') => {
    if (!sessionId) return
    const msg = buildAbort(sessionId, reason)
    sendJson(msg)
    const store = useStore.getState()
    store.addLog('out', msg)
    store.finalizeAssistantMessage()
  }, [sessionId])

  const sendUpdate = useCallback((secret: string) => {
    if (!sessionId) return
    const msg = buildServerAction(sessionId, 'update_config', secret)
    sendJson(msg)
    useStore.getState().addLog('out', msg)
  }, [sessionId])

  const sendRestart = useCallback((secret: string) => {
    if (!sessionId) return
    const msg = buildServerAction(sessionId, 'restart', secret)
    sendJson(msg)
    useStore.getState().addLog('out', msg)
  }, [sessionId])

  return { connect: handleConnect, disconnect: handleDisconnect, sendListen, sendAbort, sendUpdate, sendRestart, status, sessionId }
}
