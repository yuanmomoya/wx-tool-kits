import Taro from '@tarojs/taro'

const RAMP_LIMIT_MS = 640
const SOUND_KEY = 'pelvic-floor-sound'

export type Phase = 'contract' | 'relax'
export type Cue = 'contract' | 'relax' | 'done'
export type StageTone = 'short' | 'medium'

export interface Stage {
  contractMs: number
  relaxMs: number
  reps: number
  label: string
  tone: StageTone
}

export const SESSION_MS = 600_000
export const SESSION_LABEL = '1s-2s-4s-6s'

interface Pattern {
  seconds: number
  contractMs: number
  relaxMs: number
  label: string
  tone: StageTone
  minReps: number
  maxReps: number
}

const PATTERNS: Pattern[] = [
  { seconds: 1, contractMs: 1_000, relaxMs: 1_000, label: "1s'组短频训练", tone: 'short', minReps: 4, maxReps: 8 },
  { seconds: 2, contractMs: 2_000, relaxMs: 2_000, label: "2s'组短频训练", tone: 'short', minReps: 2, maxReps: 4 },
  { seconds: 4, contractMs: 4_000, relaxMs: 4_000, label: "4s'组中频训练", tone: 'medium', minReps: 2, maxReps: 3 },
  { seconds: 6, contractMs: 6_000, relaxMs: 6_000, label: "6s'组长频训练", tone: 'medium', minReps: 2, maxReps: 2 },
]

export interface StageSpan {
  stage: Stage
  index: number
  startMs: number
  durationMs: number
}

export interface TrainingSession {
  stages: Stage[]
  spans: StageSpan[]
  totalMs: number
}

function createRandom(seed: number) {
  let state = (seed >>> 0) || 1
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0
    return state / 4294967296
  }
}

function intBetween(random: () => number, min: number, max: number) {
  return min + Math.floor(random() * (max - min + 1))
}

function shuffle<T>(items: T[], random: () => number) {
  const copy = [...items]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1))
    const current = copy[index]
    copy[index] = copy[swap]
    copy[swap] = current
  }
  return copy
}

function compileSession(stages: Stage[]): TrainingSession {
  const spans: StageSpan[] = []
  let cursor = 0
  stages.forEach((stage, index) => {
    const durationMs = (stage.contractMs + stage.relaxMs) * stage.reps
    spans.push({ stage, index, startMs: cursor, durationMs })
    cursor += durationMs
  })
  return { stages, spans, totalMs: cursor }
}

function takePattern(stages: Stage[], pattern: Pattern, reps: number, remaining: number) {
  const cycle = pattern.contractMs + pattern.relaxMs
  const maxByTime = Math.floor(remaining / cycle)
  const repsUsed = Math.min(reps, maxByTime)
  if (repsUsed < 1) return remaining
  stages.push({
    contractMs: pattern.contractMs,
    relaxMs: pattern.relaxMs,
    reps: repsUsed,
    label: pattern.label,
    tone: pattern.tone,
  })
  return remaining - repsUsed * cycle
}

/** 先打乱四种间隔各来一段，再随机接上不同间隔，直到刚好 10 分钟。 */
export function createSession(seed: number): TrainingSession {
  const random = createRandom(seed)
  const stages: Stage[] = []
  let remaining = SESSION_MS
  let previous = 0
  shuffle(PATTERNS, random).forEach((pattern) => {
    remaining = takePattern(stages, pattern, intBetween(random, pattern.minReps, pattern.maxReps), remaining)
    previous = pattern.seconds
  })
  while (remaining > 0) {
    const different = PATTERNS.filter((pattern) => pattern.seconds !== previous && pattern.contractMs + pattern.relaxMs <= remaining)
    const fitting = different.length > 0
      ? different
      : PATTERNS.filter((pattern) => pattern.contractMs + pattern.relaxMs <= remaining)
    if (fitting.length === 0) break
    const pattern = fitting[Math.floor(random() * fitting.length)]
    const maxByTime = Math.floor(remaining / (pattern.contractMs + pattern.relaxMs))
    const maxReps = Math.min(pattern.maxReps, maxByTime)
    const minReps = Math.min(pattern.minReps, maxReps)
    remaining = takePattern(stages, pattern, intBetween(random, minReps, maxReps), remaining)
    previous = pattern.seconds
  }
  return compileSession(stages)
}

export function mixCaption(session: TrainingSession) {
  const opening = session.stages.slice(0, 4).map((stage) => `${stage.contractMs / 1000}秒`).join(' → ')
  return `${opening}…`
}

export interface TrainingSnapshot {
  status: 'running' | 'done'
  stageIndex: number
  stageLabel: string
  repIndex: number
  repNumber: number
  stageReps: number
  phase: Phase
  phaseElapsedMs: number
  phaseDurationMs: number
  intervalSeconds: number
  elapsedMs: number
  remainingMs: number
}

export interface WaveSample {
  x: number
  y: number
}

export interface WaveWindow {
  samples: WaveSample[]
  progress: number
  startMs: number
  durationMs: number
}

export function cycleMs(stage: Stage) {
  return stage.contractMs + stage.relaxMs
}

export function rampMs(phaseMs: number) {
  return Math.min(RAMP_LIMIT_MS, phaseMs * 0.16)
}

function clamp(value: number, max: number) {
  if (!Number.isFinite(value) || value <= 0) return 0
  return Math.min(value, max)
}

function spanAt(session: TrainingSession, elapsedMs: number) {
  return session.spans.find((span) => elapsedMs < span.startMs + span.durationMs) ?? session.spans[session.spans.length - 1]
}

/** 短频是窄脉冲，中频和长频会在顶部停住。0 是放松，1 是收紧。 */
export function muscleLevel(timeInCycleMs: number, stage: Stage) {
  const cycle = cycleMs(stage)
  const time = ((timeInCycleMs % cycle) + cycle) % cycle
  if (time < stage.contractMs) {
    const rise = rampMs(stage.contractMs)
    if (rise <= 0) return 1
    return Math.min(1, time / rise)
  }
  const relaxElapsed = time - stage.contractMs
  const fall = rampMs(stage.relaxMs)
  if (fall <= 0) return 0
  return Math.max(0, 1 - relaxElapsed / fall)
}

export function getStateAt(elapsedMs: number, session: TrainingSession): TrainingSnapshot {
  const elapsed = clamp(elapsedMs, session.totalMs)
  if (elapsed >= session.totalMs) {
    const last = session.spans[session.spans.length - 1]
    return {
      status: 'done',
      stageIndex: last.index,
      stageLabel: last.stage.label,
      repIndex: last.stage.reps - 1,
      repNumber: last.stage.reps,
      stageReps: last.stage.reps,
      phase: 'relax',
      phaseElapsedMs: last.stage.relaxMs,
      phaseDurationMs: last.stage.relaxMs,
      intervalSeconds: last.stage.contractMs / 1000,
      elapsedMs: session.totalMs,
      remainingMs: 0,
    }
  }
  const span = spanAt(session, elapsed)
  const local = elapsed - span.startMs
  const cycle = cycleMs(span.stage)
  const repIndex = Math.floor(local / cycle)
  const within = local - repIndex * cycle
  const phase: Phase = within < span.stage.contractMs ? 'contract' : 'relax'
  const phaseElapsedMs = phase === 'contract' ? within : within - span.stage.contractMs
  return {
    status: 'running',
    stageIndex: span.index,
    stageLabel: span.stage.label,
    repIndex,
    repNumber: repIndex + 1,
    stageReps: span.stage.reps,
    phase,
    phaseElapsedMs,
    phaseDurationMs: phase === 'contract' ? span.stage.contractMs : span.stage.relaxMs,
    intervalSeconds: span.stage.contractMs / 1000,
    elapsedMs: elapsed,
    remainingMs: session.totalMs - elapsed,
  }
}

export function cueForTransition(previous: TrainingSnapshot | null, next: TrainingSnapshot): Cue | null {
  if (next.status === 'done') return previous?.status === 'done' ? null : 'done'
  if (
    !previous
    || previous.stageIndex !== next.stageIndex
    || previous.repIndex !== next.repIndex
    || previous.phase !== next.phase
  ) {
    return next.phase
  }
  return null
}

function windowBounds(elapsedMs: number, session: TrainingSession) {
  const elapsed = clamp(elapsedMs, session.totalMs)
  const at = elapsed >= session.totalMs ? session.totalMs - 1 : elapsed
  const span = spanAt(session, at)
  const cycle = cycleMs(span.stage)
  if (span.stage.tone === 'short') {
    const pageMs = cycle * Math.min(6, span.stage.reps)
    const local = Math.min(Math.max(at - span.startMs, 0), Math.max(span.durationMs - 1, 0))
    let page = Math.floor(local / pageMs)
    let startMs = span.startMs + page * pageMs
    let durationMs = Math.min(pageMs, span.startMs + span.durationMs - startMs)
    if (durationMs < pageMs * 0.45 && page > 0) {
      page -= 1
      startMs = span.startMs + page * pageMs
      durationMs = Math.min(pageMs, span.startMs + span.durationMs - startMs)
    }
    return { startMs, durationMs: Math.max(durationMs, 1) }
  }
  const durationMs = Math.min(cycle * 1.5, session.totalMs)
  let startMs = at - durationMs * 0.58
  if (startMs < 0) startMs = 0
  if (startMs + durationMs > session.totalMs) startMs = Math.max(0, session.totalMs - durationMs)
  return { startMs, durationMs: Math.max(1, Math.min(durationMs, session.totalMs - startMs)) }
}

function levelAt(session: TrainingSession, time: number) {
  const span = spanAt(session, Math.min(Math.max(time, 0), session.totalMs - 1))
  return muscleLevel(time - span.startMs, span.stage)
}

function sampleTimes(startMs: number, durationMs: number, session: TrainingSession) {
  const end = startMs + durationMs
  const times = new Set<number>([startMs, end])
  for (let offset = 0; offset <= durationMs; offset += 100) times.add(startMs + offset)
  session.spans.forEach((span) => {
    if (span.startMs >= end || span.startMs + span.durationMs <= startMs) return
    const cycle = cycleMs(span.stage)
    const marks = [0, rampMs(span.stage.contractMs), span.stage.contractMs, span.stage.contractMs + rampMs(span.stage.relaxMs), cycle]
    for (let origin = span.startMs; origin < span.startMs + span.durationMs; origin += cycle) {
      marks.forEach((mark) => {
        const time = origin + mark
        if (time >= startMs && time <= end) times.add(time)
      })
    }
  })
  return Array.from(times).sort((left, right) => left - right)
}

export function buildWaveWindow(elapsedMs: number, session: TrainingSession): WaveWindow {
  const { startMs, durationMs } = windowBounds(elapsedMs, session)
  const elapsed = clamp(elapsedMs, session.totalMs)
  const samples = sampleTimes(startMs, durationMs, session).map((time) => ({
    x: durationMs === 0 ? 0 : (time - startMs) / durationMs,
    y: levelAt(session, Math.min(time, session.totalMs - 1)),
  }))
  return {
    samples,
    progress: durationMs === 0 ? 1 : Math.max(0, Math.min(1, (elapsed - startMs) / durationMs)),
    startMs,
    durationMs,
  }
}

export function previewWave(session: TrainingSession) {
  const stage = session.stages[0]
  const cycle = cycleMs(stage)
  const span = session.spans[0]
  const previewAt = stage.tone === 'short'
    ? Math.min(cycle * 3, Math.max(cycle * 0.5, span.durationMs * 0.45))
    : Math.min(stage.contractMs * 0.92, Math.max(span.durationMs - 1, 0))
  return buildWaveWindow(previewAt, session)
}

export interface WaveLayoutSegment {
  x1: number
  y1: number
  x2: number
  y2: number
}

export interface WaveLayout {
  segments: WaveLayoutSegment[]
  head: { x: number; y: number }
  baseline: number
}

function simplifyPolyline(points: Array<{ x: number; y: number }>) {
  if (points.length <= 2) return points
  const kept = [points[0]]
  for (let index = 1; index < points.length - 1; index += 1) {
    const prev = kept[kept.length - 1]
    const current = points[index]
    const next = points[index + 1]
    const cross = (current.x - prev.x) * (next.y - current.y) - (current.y - prev.y) * (next.x - current.x)
    if (Math.abs(cross) > 0.75) kept.push(current)
  }
  kept.push(points[points.length - 1])
  return kept
}

/** 把采样收成一条连续折线。转角共用端点，播放头落在线上。 */
export function layoutWave(samples: WaveSample[], progress: number, width: number, height: number): WaveLayout {
  const padX = 8
  const padY = 16
  const plotWidth = Math.max(1, width - padX * 2)
  const plotHeight = Math.max(1, height - padY * 2)
  const baseline = padY + plotHeight * 0.78
  const peak = padY + plotHeight * 0.14
  const limit = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0))
  const mapPoint = (sample: WaveSample) => ({
    x: padX + sample.x * plotWidth,
    y: baseline - sample.y * (baseline - peak),
  })
  const points = simplifyPolyline(samples.map(mapPoint))
  const segments: WaveLayoutSegment[] = []
  if (points.length > 0) {
    let cursor = points[0]
    points.slice(1).forEach((point) => {
      if (Math.hypot(point.x - cursor.x, point.y - cursor.y) < 0.4) return
      segments.push({ x1: cursor.x, y1: cursor.y, x2: point.x, y2: point.y })
      cursor = point
    })
    const last = points[points.length - 1]
    if (cursor.x !== last.x || cursor.y !== last.y) {
      segments.push({ x1: cursor.x, y1: cursor.y, x2: last.x, y2: last.y })
    }
  }
  return { segments, head: mapPoint(sampleAt(samples, limit)), baseline }
}

export function sampleAt(samples: WaveSample[], x: number): WaveSample {
  if (samples.length === 0) return { x, y: 0 }
  if (x <= samples[0].x) return { x, y: samples[0].y }
  for (let index = 1; index < samples.length; index += 1) {
    const right = samples[index]
    const left = samples[index - 1]
    if (x <= right.x) {
      const span = right.x - left.x
      const ratio = span === 0 ? 0 : (x - left.x) / span
      return { x, y: left.y + (right.y - left.y) * ratio }
    }
  }
  const last = samples[samples.length - 1]
  return { x, y: last.y }
}

export function formatRemainClock(ms: number) {
  const safe = Number.isFinite(ms) ? Math.max(0, ms) : 0
  const totalSeconds = Math.ceil(safe / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export function readSoundEnabled() {
  try {
    const value = Taro.getStorageSync(SOUND_KEY)
    if (value === '' || value === undefined || value === null) return true
    return value === true || value === '1'
  } catch {
    return true
  }
}

export function writeSoundEnabled(enabled: boolean) {
  Taro.setStorageSync(SOUND_KEY, enabled ? '1' : '0')
}
