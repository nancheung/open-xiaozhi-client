// 音频输入/输出端口。
// 输入：麦克风采集 → Opus 帧（每帧通过回调回传）。
// 输出：接收下行 Opus 帧并播放，按服务端协商采样率工作。

export interface AudioInputPort {
  /** 开始采集。每编码出一帧 Opus 调用一次 onFrame。 */
  start(onFrame: (frame: Uint8Array) => void): Promise<void>
  stop(): void
}

export interface AudioOutputPort {
  /** 设置下行采样率（来自服务端 hello），用于解码与播放上下文。 */
  configure(sampleRate: number): void
  /** 播放一帧下行 Opus 音频。 */
  playFrame(frame: Uint8Array): void
  /** 浏览器自动播放策略导致挂起时，恢复播放上下文。 */
  resume(): void
  /** 连接结束时释放资源。 */
  reset(): void
}
