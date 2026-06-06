// 入站 MCP 协议处理（服务端为发起方）：initialize / tools.list / tools.call / notifications。
// 工具执行复用既有 features/mcp/tools.ts（设备侧副作用，已具备测试覆盖）。

import type { DomainEvent } from '../core/events/domainEvents'
import type { EventBus } from '../core/events/eventBus'
import type { Transport } from '../core/ports/Transport'
import { buildMCPResponse, type MCPMessage } from '../core/domain/protocol/messages'
import { TOOL_DEFINITIONS, handleToolCall } from '../features/mcp/tools'

export class McpService {
  constructor(
    private readonly transport: Transport,
    private readonly getSessionId: () => string | null,
    private readonly bus: EventBus<DomainEvent>,
    private readonly onMcpReady: () => void,
  ) {}

  private reply(payload: MCPMessage['payload']): void {
    const sid = this.getSessionId() ?? ''
    const resp = buildMCPResponse(sid, payload)
    this.transport.sendText(JSON.stringify(resp))
    this.bus.emit({ type: 'Log', direction: 'out', data: resp })
  }

  handle(msg: MCPMessage): void {
    const { payload } = msg

    if (payload.method === 'initialize') {
      const params = payload.params as
        { capabilities?: { vision?: { url?: unknown; token?: unknown } } } | undefined
      const vision = params?.capabilities?.vision
      if (vision && typeof vision.url === 'string') {
        const token = typeof vision.token === 'string' ? vision.token : null
        this.bus.emit({ type: 'VisionEndpoint', url: vision.url, token })
        this.bus.emit({ type: 'Log', direction: 'system', data: `视觉端点已配置: ${vision.url}` })
      }
      this.reply({
        jsonrpc: '2.0', id: payload.id,
        result: { serverInfo: { name: 'open-xiaozhi-client', version: __APP_VERSION__ } },
      })
      return
    }

    if (payload.method === 'tools/list') {
      this.reply({ jsonrpc: '2.0', id: payload.id, result: { tools: TOOL_DEFINITIONS } })
      this.onMcpReady()
      return
    }

    if (payload.method === 'tools/call') {
      const params = payload.params as { name: string; arguments?: Record<string, unknown> }
      void handleToolCall(params.name, params.arguments ?? {}).then((result) => {
        const responsePayload: MCPMessage['payload'] = { jsonrpc: '2.0', id: payload.id }
        if (result.isError) responsePayload.error = { message: result.content[0].text }
        else responsePayload.result = { content: result.content }
        this.reply(responsePayload)
      })
      return
    }

    if (payload.method === 'notifications/initialized') {
      this.onMcpReady()
    }
  }
}
