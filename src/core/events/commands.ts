// 命令：UI / 意图层 → application 层的单向输入。
// UI 只调用 runtime.dispatch(command)，绝不直接触碰传输层或状态机。

import type { ListenMode } from './domainEvents'

export type Command =
  // 连接
  | { type: 'Connect' }
  | { type: 'Disconnect' }
  // 会话 / 录音
  | { type: 'ToggleMic' }                                  // 麦克风按钮（开始/结束，依当前态）
  | { type: 'Abort'; reason?: 'wake_word_detected' }       // 中断/打断
  | { type: 'SetListenMode'; mode: ListenMode }
  // 协议调试
  | { type: 'SendRawJson'; payload: unknown }
  | { type: 'ServerAction'; action: 'update_config' | 'restart'; secret: string }
  // 设备控制
  | { type: 'SetVolume'; value: number }
  | { type: 'SetBrightness'; value: number }
  | { type: 'SetTheme'; value: 'light' | 'dark' }
  // 摄像头
  | { type: 'EnableCamera' }
  | { type: 'DisableCamera' }
  // 音频上下文（浏览器自动播放策略）
  | { type: 'ResumePlayback' }
