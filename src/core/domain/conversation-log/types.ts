// 对话记录的领域类型。
export interface ConversationMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  timestamp: number
  audioChunks: Uint8Array[]
  audioFinalized: boolean
}
