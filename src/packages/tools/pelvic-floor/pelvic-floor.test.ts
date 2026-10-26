import Taro from '@tarojs/taro'
import { describe, expect, it, vi } from 'vitest'

import {
  SESSION_MS,
  buildWaveWindow,
  createSession,
  cueForTransition,
  formatRemainClock,
  getStateAt,
  layoutWave,
  mixCaption,
  muscleLevel,
  previewWave,
  readSoundEnabled,
  sampleAt,
  writeSoundEnabled,
  type Stage,
} from './pelvic-floor.logic'

const short: Stage = { contractMs: 1_000, relaxMs: 1_000, reps: 4, label: "1s'组短频训练", tone: 'short' }
const medium: Stage = { contractMs: 4_000, relaxMs: 4_000, reps: 2, label: "4s'组中频训练", tone: 'medium' }

function signature(seed: number) {
  return createSession(seed).stages.map((stage) => `${stage.contractMs}x${stage.reps}`).join(',')
}

describe('盆底肌训练节律', () => {
  it('用 1 秒、2 秒、4 秒、6 秒随机拼成 10 分钟', () => {
    const session = createSession(7)
    const again = createSession(7)
    expect(SESSION_MS).toBe(600_000)
    expect(session.totalMs).toBe(600_000)
    expect(again.stages).toEqual(session.stages)
    expect(signature(1)).not.toBe(signature(2))
    expect(new Set(session.stages.map((stage) => stage.contractMs))).toEqual(new Set([1_000, 2_000, 4_000, 6_000]))
    expect(session.stages.every((stage) => stage.relaxMs === stage.contractMs && stage.reps >= 1)).toBe(true)
    expect(session.stages.slice(0, 4).every((stage) => stage.reps >= 2)).toBe(true)
    const repeats = session.stages.filter((stage, index) => index > 0 && stage.contractMs === session.stages[index - 1].contractMs)
    expect(repeats.length).toBeLessThanOrEqual(1)
    expect(mixCaption(session)).toContain('→')
  })

  it('一段做完就跳到另一种间隔', () => {
    const session = createSession(4)
    const first = session.spans[0]
    expect(getStateAt(0, session)).toMatchObject({
      status: 'running',
      stageIndex: 0,
      phase: 'contract',
      intervalSeconds: first.stage.contractMs / 1000,
      remainingMs: 600_000,
    })
    expect(getStateAt(first.stage.contractMs, session)).toMatchObject({ stageIndex: 0, phase: 'relax', repIndex: 0 })
    expect(getStateAt(first.durationMs - 1, session)).toMatchObject({ stageIndex: 0, phase: 'relax' })
    expect(getStateAt(first.durationMs, session)).toMatchObject({ stageIndex: 1, phase: 'contract', repNumber: 1 })
    expect(getStateAt(first.durationMs, session).intervalSeconds).not.toBe(first.stage.contractMs / 1000)
    expect(getStateAt(599_999, session)).toMatchObject({ status: 'running' })
    expect(getStateAt(600_000, session)).toMatchObject({ status: 'done', remainingMs: 0 })
    expect(getStateAt(Number.NaN, session)).toMatchObject({ stageIndex: 0, phase: 'contract', elapsedMs: 0 })
  })

  it('短频很快到顶，中频会在顶部停住', () => {
    expect(muscleLevel(0, short)).toBe(0)
    expect(muscleLevel(200, short)).toBeCloseTo(1)
    expect(muscleLevel(1_000, short)).toBeCloseTo(1)
    expect(muscleLevel(1_200, short)).toBeCloseTo(0)
    expect(muscleLevel(640, medium)).toBeCloseTo(1)
    expect(muscleLevel(3_000, medium)).toBeCloseTo(1)
    expect(muscleLevel(4_000 + 640, medium)).toBeCloseTo(0)
    expect(muscleLevel(400, medium)).toBeGreaterThan(0.4)
    expect(muscleLevel(400, medium)).toBeLessThan(1)
  })

  it('短频一屏排开，中频放大成一条梯形', () => {
    const session = createSession(1)
    const first = session.spans[0]
    const cycle = first.stage.contractMs + first.stage.relaxMs
    const opened = buildWaveWindow(0, session)
    expect(opened).toMatchObject({ startMs: 0, progress: 0 })
    if (first.stage.tone === 'short') {
      expect(opened.durationMs).toBe(cycle * Math.min(6, first.stage.reps))
    } else {
      expect(opened.durationMs).toBeLessThanOrEqual(cycle * 1.5)
    }
    expect(buildWaveWindow(600_000, session).progress).toBe(1)

    const preview = previewWave(session)
    expect(preview.progress).toBeGreaterThan(0.2)
    expect(preview.progress).toBeLessThan(0.85)
    expect(preview.samples[0]?.x).toBe(0)
    expect(preview.samples[preview.samples.length - 1]?.x).toBe(1)
    const ys = preview.samples.map((sample) => sample.y)
    expect(Math.max(...ys)).toBeGreaterThan(0.9)
  })

  it('脉冲折线连续，播放头贴在线上', () => {
    const wave = buildWaveWindow(6_000, createSession(1))
    const layout = layoutWave(wave.samples, wave.progress, 311, 168)
    expect(layout.segments.length).toBeGreaterThan(4)
    for (let index = 1; index < layout.segments.length; index += 1) {
      const prev = layout.segments[index - 1]
      const next = layout.segments[index]
      expect(next.x1).toBeCloseTo(prev.x2, 4)
      expect(next.y1).toBeCloseTo(prev.y2, 4)
    }
    const ys = layout.segments.flatMap((segment) => [segment.y1, segment.y2])
    expect(Math.min(...ys)).toBeLessThan(layout.baseline - 40)
    const onLine = layout.segments.some((segment) => {
      if (layout.head.x < Math.min(segment.x1, segment.x2) - 0.6) return false
      if (layout.head.x > Math.max(segment.x1, segment.x2) + 0.6) return false
      const span = segment.x2 - segment.x1
      const ratio = Math.abs(span) < 0.001 ? 0 : (layout.head.x - segment.x1) / span
      const y = segment.y1 + (segment.y2 - segment.y1) * ratio
      return Math.abs(y - layout.head.y) < 1
    })
    expect(onLine).toBe(true)
  })

  it('在采样点之间插值，并在阶段变化时给出提示', () => {
    expect(sampleAt([{ x: 0, y: 0 }, { x: 1, y: 1 }], 0.5)).toEqual({ x: 0.5, y: 0.5 })
    const session = createSession(4)
    const first = session.spans[0]
    const started = getStateAt(0, session)
    const stillContract = getStateAt(200, session)
    const relaxed = getStateAt(first.stage.contractMs, session)
    const nextStage = getStateAt(first.durationMs, session)
    const finished = getStateAt(600_000, session)
    expect(cueForTransition(null, started)).toBe('contract')
    expect(cueForTransition(started, stillContract)).toBeNull()
    expect(cueForTransition(started, relaxed)).toBe('relax')
    expect(cueForTransition(getStateAt(first.durationMs - 1, session), nextStage)).toBe('contract')
    expect(cueForTransition(getStateAt(599_999, session), finished)).toBe('done')
    expect(cueForTransition(finished, finished)).toBeNull()
  })

  it('格式化剩余时间，并记住提示音开关', () => {
    expect(formatRemainClock(0)).toBe('0:00')
    expect(formatRemainClock(1_000)).toBe('0:01')
    expect(formatRemainClock(1_001)).toBe('0:02')
    expect(formatRemainClock(600_000)).toBe('10:00')
    expect(readSoundEnabled()).toBe(true)
    writeSoundEnabled(false)
    expect(readSoundEnabled()).toBe(false)
    writeSoundEnabled(true)
    expect(readSoundEnabled()).toBe(true)
    vi.mocked(Taro.getStorageSync).mockImplementationOnce(() => {
      throw new Error('storage unavailable')
    })
    expect(readSoundEnabled()).toBe(true)
  })
})
