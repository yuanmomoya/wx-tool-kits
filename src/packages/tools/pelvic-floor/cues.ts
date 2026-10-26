import cueContract from './assets/cue-contract.mp3'
import cueDone from './assets/cue-done.mp3'
import cueRelax from './assets/cue-relax.mp3'

import type { Cue } from './pelvic-floor.logic'

function assetUrl(file: string) {
  if (!file) return ''
  if (file.startsWith('data:') || file.startsWith('http') || file.startsWith('/')) return file
  return `/${file.replace(/^\.\//, '')}`
}

export const PHASE_CUES: Record<Cue, string> = {
  contract: assetUrl(cueContract),
  relax: assetUrl(cueRelax),
  done: assetUrl(cueDone),
}
