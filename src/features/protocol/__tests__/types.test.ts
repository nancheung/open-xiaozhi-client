import { describe, it, expect } from 'vitest'
import {
  isServerHello,
  isTTSMessage,
  EMOTION_MAP, type EmotionType,
} from '../types'

describe('类型守卫', () => {
  it('isServerHello 识别 hello 消息', () => {
    expect(isServerHello({ type: 'hello', session_id: 'abc', version: 1, transport: 'websocket', audio_params: { format: 'opus', sample_rate: 24000, channels: 1, frame_duration: 60 } })).toBe(true)
    expect(isServerHello({ type: 'stt', text: 'x' })).toBe(false)
  })

  it('isTTSMessage 识别全部 state 值', () => {
    expect(isTTSMessage({ type: 'tts', state: 'start', session_id: 'x' })).toBe(true)
    expect(isTTSMessage({ type: 'tts', state: 'sentence_start', text: 'hi', session_id: 'x' })).toBe(true)
    expect(isTTSMessage({ type: 'tts', state: 'stop', session_id: 'x' })).toBe(true)
  })

  it('EMOTION_MAP 覆盖全部 21 个情绪', () => {
    const emotions: EmotionType[] = [
      'happy','funny','crying','angry','sad','loving','surprised','shocked',
      'thinking','winking','delicious','confident','relaxed','sleepy','silly',
      'confused','neutral','laughing','embarrassed','cool','kissy',
    ]
    emotions.forEach(e => expect(EMOTION_MAP[e]).toBeDefined())
    expect(Object.keys(EMOTION_MAP)).toHaveLength(21)
  })
})
