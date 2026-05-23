let gainNode: GainNode | null = null

export function registerGainNode(node: GainNode | null): void {
  gainNode = node
}

export function setAppVolume(volume: number): void {
  if (gainNode) gainNode.gain.value = volume / 100
}

export function getAppVolume(): number {
  return gainNode ? Math.round(gainNode.gain.value * 100) : 100
}
