import { useEffect, useMemo, useRef, useState } from 'react'
import { Image, ScrollView, Text, View } from '@tarojs/components'
import Taro, { useDidHide, useShareAppMessage, useShareTimeline } from '@tarojs/taro'

import NavigationBar from '@/components/NavigationBar'
import soundOffIcon from './assets/sound-off.png'
import soundOnIcon from './assets/sound-on.png'
import { PHASE_CUES } from './cues'
import {
  SESSION_LABEL,
  SESSION_MS,
  buildWaveWindow,
  createSession,
  cueForTransition,
  formatRemainClock,
  getStateAt,
  layoutWave,
  previewWave,
  readSoundEnabled,
  writeSoundEnabled,
  type Cue,
  type TrainingSnapshot,
  type WaveLayoutSegment,
  type WaveSample,
} from './pelvic-floor.logic'

import './pelvic-floor.scss'

type Screen = 'ready' | 'countdown' | 'training' | 'paused' | 'done'
type CueAudio = {
  src: string
  stop: () => void
  play: () => void
  destroy: () => void
}
const WAVE_HEIGHT = 150
const WAVE_DONE = '#24342c'
const WAVE_AHEAD = '#e4e1dc'

function useWaveWidth() {
  const [width, setWidth] = useState(311)
  useEffect(() => {
    try {
      const info = Taro.getWindowInfo?.() || Taro.getSystemInfoSync()
      const windowWidth = info.windowWidth || 375
      setWidth(Math.max(240, Math.round(windowWidth - 64)))
    } catch {
      setWidth(311)
    }
  }, [])
  return width
}

const WAVE_STROKE = 4

function segmentStyle(segment: WaveLayoutSegment) {
  const dx = segment.x2 - segment.x1
  const dy = segment.y2 - segment.y1
  const length = Math.hypot(dx, dy)
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI
  return {
    left: `${segment.x1}px`,
    top: `${segment.y1 - WAVE_STROKE / 2}px`,
    width: `${length + 1.5}px`,
    height: `${WAVE_STROKE}px`,
    transform: `rotate(${angle}deg)`,
    transformOrigin: '0 50%',
  }
}

function WaveLines({ segments, color }: { segments: WaveLayoutSegment[]; color: string }) {
  return (
    <>
      {segments.map((segment) => (
        <View
          key={`${color}-${segment.x1}-${segment.y1}-${segment.x2}-${segment.y2}`}
          className='wave-seg'
          style={{ ...segmentStyle(segment), backgroundColor: color }}
        />
      ))}
    </>
  )
}

function splitWave(segments: WaveLayoutSegment[], cut: number) {
  const done: WaveLayoutSegment[] = []
  const ahead: WaveLayoutSegment[] = []
  segments.forEach((segment) => {
    if (segment.x2 <= cut) {
      done.push(segment)
      return
    }
    if (segment.x1 >= cut) {
      ahead.push(segment)
      return
    }
    const span = segment.x2 - segment.x1
    const ratio = span === 0 ? 0 : (cut - segment.x1) / span
    const midY = segment.y1 + (segment.y2 - segment.y1) * ratio
    done.push({ x1: segment.x1, y1: segment.y1, x2: cut, y2: midY })
    ahead.push({ x1: cut, y1: midY, x2: segment.x2, y2: segment.y2 })
  })
  return { done, ahead }
}

function Waveform({ samples, progress }: { samples: WaveSample[]; progress: number }) {
  const width = useWaveWidth()
  const drawn = useMemo(() => {
    const layout = layoutWave(samples, progress, width, WAVE_HEIGHT)
    return { ...layout, ...splitWave(layout.segments, layout.head.x) }
  }, [samples, progress, width])
  return (
    <View className='wave-plot' style={{ height: `${WAVE_HEIGHT}px` }}>
      <View className='wave-baseline' style={{ top: `${drawn.baseline}px` }} />
      <WaveLines segments={drawn.ahead} color={WAVE_AHEAD} />
      <WaveLines segments={drawn.done} color={WAVE_DONE} />
      <View className='wave-head' style={{ left: `${drawn.head.x}px`, top: `${drawn.head.y}px` }} />
    </View>
  )
}

export default function PelvicFloorPage() {
  const [screen, setScreen] = useState<Screen>('ready')
  const [countdown, setCountdown] = useState(3)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [soundOn, setSoundOn] = useState(readSoundEnabled)
  const [session, setSession] = useState(() => createSession(Date.now()))
  const sessionRef = useRef(session)
  const screenRef = useRef(screen)
  const elapsedRef = useRef(0)
  const originRef = useRef(0)
  const cueRef = useRef<TrainingSnapshot | null>(null)
  const soundOnRef = useRef(soundOn)
  const timersRef = useRef<Array<ReturnType<typeof setTimeout>>>([])
  const audioRef = useRef<CueAudio | null>(null)
  const snapshot = getStateAt(elapsedMs, session)
  const wave = useMemo(
    () => (screen === 'ready' ? previewWave(session) : buildWaveWindow(elapsedMs, session)),
    [screen, elapsedMs, session],
  )

  sessionRef.current = session
  screenRef.current = screen
  soundOnRef.current = soundOn

  const clearTimers = () => {
    timersRef.current.forEach((timer) => clearTimeout(timer))
    timersRef.current = []
  }

  const stopAudio = () => {
    try {
      audioRef.current?.stop()
    } catch {
      audioRef.current = null
    }
  }

  const playSrc = (src: string) => {
    if (!soundOnRef.current || !src) return
    try {
      const player = audioRef.current || (Taro.createInnerAudioContext() as CueAudio)
      audioRef.current = player
      player.stop()
      player.src = src
      player.play()
    } catch {
      audioRef.current = null
    }
  }

  const playCue = (cue: Cue) => playSrc(PHASE_CUES[cue])

  const cancelCountdown = () => {
    clearTimers()
    stopAudio()
    cueRef.current = null
    screenRef.current = 'ready'
    setScreen('ready')
  }

  const tick = () => {
    if (screenRef.current !== 'training') return
    const elapsed = Date.now() - originRef.current
    const next = getStateAt(elapsed, sessionRef.current)
    const cue = cueForTransition(cueRef.current, next)
    cueRef.current = next
    elapsedRef.current = next.elapsedMs
    setElapsedMs(next.elapsedMs)
    if (cue) playCue(cue)
    if (next.status === 'done') {
      screenRef.current = 'done'
      setScreen('done')
      return
    }
    timersRef.current.push(setTimeout(tick, 50))
  }

  const startTraining = () => {
    clearTimers()
    originRef.current = Date.now() - elapsedRef.current
    cueRef.current = elapsedRef.current > 0 ? getStateAt(elapsedRef.current, sessionRef.current) : null
    screenRef.current = 'training'
    setScreen('training')
    tick()
  }

  const pauseTraining = () => {
    if (screenRef.current !== 'training') return
    clearTimers()
    stopAudio()
    const elapsed = Math.min(Math.max(0, Date.now() - originRef.current), SESSION_MS)
    elapsedRef.current = elapsed
    setElapsedMs(elapsed)
    screenRef.current = 'paused'
    setScreen('paused')
  }

  const beginCountdown = () => {
    if (screenRef.current !== 'ready' && screenRef.current !== 'done') return
    clearTimers()
    stopAudio()
    elapsedRef.current = 0
    cueRef.current = null
    setElapsedMs(0)
    setCountdown(3)
    screenRef.current = 'countdown'
    setScreen('countdown')
    ;[1, 2].forEach((step) => {
      timersRef.current.push(setTimeout(() => {
        if (screenRef.current !== 'countdown') return
        setCountdown(3 - step)
      }, step * 1000))
    })
    timersRef.current.push(setTimeout(() => {
      if (screenRef.current !== 'countdown') return
      startTraining()
    }, 3000))
  }

  const toggleSound = () => {
    const next = !soundOnRef.current
    soundOnRef.current = next
    setSoundOn(next)
    writeSoundEnabled(next)
    if (!next) stopAudio()
  }

  const resetReady = () => {
    clearTimers()
    stopAudio()
    const next = createSession(Date.now())
    sessionRef.current = next
    setSession(next)
    elapsedRef.current = 0
    cueRef.current = null
    setElapsedMs(0)
    screenRef.current = 'ready'
    setScreen('ready')
  }

  useDidHide(() => {
    if (screenRef.current === 'training') pauseTraining()
    else if (screenRef.current === 'countdown') cancelCountdown()
  })

  useEffect(() => () => {
    clearTimers()
    stopAudio()
    try {
      audioRef.current?.destroy()
    } catch {
      audioRef.current = null
    }
  }, [])

  useShareAppMessage(() => ({
    title: '盆底肌训练：10分钟渐进组合',
    path: '/packages/tools/pelvic-floor/pelvic-floor',
  }))

  useShareTimeline(() => ({
    title: '盆底肌训练：1秒到6秒，跟着节奏收缩放松',
  }))

  const phaseLabel = snapshot.phase === 'contract' ? '收紧' : '放松'

  return (
    <View className='shell'>
      <NavigationBar
        title={screen === 'ready' ? '' : '盆底肌训练'}
        background='#f6f3ee'
      />
      {screen === 'countdown' ? (
        <View className='countdown'>
          <Text className='countdown__title'>准备开始</Text>
          <View className='countdown__ring'>
            <Text className='countdown__num'>{countdown}</Text>
          </View>
          <Text className='countdown__hint'>请调整好姿势，放松身心</Text>
        </View>
      ) : (
        <ScrollView className='page-scroll' scrollY enhanced showScrollbar={false}>
          <View className={screen === 'ready' ? 'page home-page' : 'page'}>
            {screen === 'ready' ? (
              <View className='home'>
                <Text className='home__hello'>Hi, 欢迎回来</Text>
                <Text className='home__title'>盆底肌修复训练</Text>
                <Text className='home__sub'>每天10分钟，重塑健康活力</Text>
                <View className='home-card'>
                  <Waveform samples={wave.samples} progress={wave.progress} />
                  <Text className='home-card__caption'>{session.stages[0]?.label}</Text>
                  <View className='home-tags'>
                    <Text className='home-tag is-active'>随机组合</Text>
                    <View className='home-tags__modes'>
                      <Text className='home-tag'>{SESSION_LABEL}</Text>
                    </View>
                  </View>
                </View>
                <View className='home-start' onClick={beginCountdown}>开始今日训练</View>
              </View>
            ) : null}

            {screen === 'training' || screen === 'paused' ? (
              <>
                <View className='card rhythm-card'>
                  <View className='rhythm-card__head'>
                    <Text className='card__title'>跟随节奏训练</Text>
                    <Text className={`phase-badge phase-badge--${snapshot.phase}`}>{phaseLabel}</Text>
                  </View>
                  <Waveform samples={wave.samples} progress={wave.progress} />
                  <Text className='rhythm-card__meta'>{snapshot.stageLabel}</Text>
                </View>
                <View className='control-row'>
                  <View className='control-btn' onClick={toggleSound}>
                    <Image className='control-icon' src={soundOn ? soundOnIcon : soundOffIcon} mode='aspectFit' />
                  </View>
                  <View className='control-btn' onClick={screen === 'paused' ? startTraining : pauseTraining}>
                    {screen === 'paused' ? <View className='play-icon' /> : (
                      <View className='pause-icon'>
                        <View className='pause-icon__bar' />
                        <View className='pause-icon__bar' />
                      </View>
                    )}
                  </View>
                </View>
                <Text className='status-line'>
                  {screen === 'paused' ? '已暂停' : '训练进行中...'} · 剩余 {formatRemainClock(snapshot.remainingMs)}
                </Text>
              </>
            ) : null}

            {screen === 'done' ? (
              <View className='card'>
                <Text className='done-title'>本组完成</Text>
                <Text className='done-copy'>
                  10 分钟的 1 秒、2 秒、4 秒、6 秒组合练完了。
                </Text>
                <Waveform samples={wave.samples} progress={1} />
                <View className='primary-btn' onClick={resetReady}>再来一次</View>
              </View>
            ) : null}
          </View>
        </ScrollView>
      )}
    </View>
  )
}
