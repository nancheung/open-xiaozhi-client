// 仅用于可视化：暴露麦克风/扬声器适配器的 AnalyserNode 给 VolumeBar / WaveformBars。
// 不包含任何控制流——录音/播放由状态机与适配器驱动。

import { useEffect, useState } from 'react'
import { useAppServices } from '../runtime/RuntimeContext'
import { useDispatch } from '../runtime/RuntimeContext'

export function useAudioAnalysers() {
  const { mic, speaker } = useAppServices()
  const dispatch = useDispatch()
  const [recordingAnalyser, setRecordingAnalyser] = useState<AnalyserNode | null>(mic.getAnalyser())
  const [playbackAnalyser, setPlaybackAnalyser] = useState<AnalyserNode | null>(speaker.getAnalyser())

  useEffect(() => mic.onAnalyserChange(setRecordingAnalyser), [mic])
  useEffect(() => speaker.onAnalyserChange(setPlaybackAnalyser), [speaker])

  const resumeAudioContext = () => dispatch({ type: 'ResumePlayback' })

  return { recordingAnalyser, playbackAnalyser, resumeAudioContext }
}
