import { useCallback, useEffect, useRef, useState } from 'react'
import { Input, Picker, ScrollView, Text, View } from '@tarojs/components'
import type { ITouchEvent } from '@tarojs/components/types/common'
import Taro, { useShareAppMessage, useShareTimeline } from '@tarojs/taro'

import NavigationBar from '@/components/NavigationBar'
import ToolIntroCard from '@/packages/tools/components/ToolIntroCard'

import './ruler.scss'

const STORAGE_KEY = 'rulerCalibrationV1'

type StandardOption = {
  id: string
  name: string
  length: number
  desc: string
  custom?: boolean
}

type RulerTick = {
  mm: number
  type: 'minor' | 'middle' | 'major'
  label: string
}

type StoredCalibration = {
  pxPerMm: number
  standardId: string
  standardLength: number
  customLengthInput?: string
  calibrationPx: number
  windowWidth: number
  updatedAt: number
}

const standardOptions: StandardOption[] = [
  {
    id: 'card-short',
    name: '银行卡 / 身份证短边 53.98mm',
    length: 53.98,
    desc: '适合快速校准，放在左侧校准线旁比较',
  },
  {
    id: 'card-long',
    name: '银行卡 / 身份证长边 85.60mm',
    length: 85.6,
    desc: '竖向校准更推荐，手机竖屏通常也能放下',
  },
  {
    id: 'known-10',
    name: '已知长度 1cm / 10mm',
    length: 10,
    desc: '适合用身边明确为 1cm 的小物件校准',
  },
  {
    id: 'known-20',
    name: '已知长度 2cm / 20mm',
    length: 20,
    desc: '适合用身边明确为 2cm 的物件校准',
  },
  {
    id: 'known-30',
    name: '已知长度 3cm / 30mm',
    length: 30,
    desc: '适合用身边明确为 3cm 的物件校准',
  },
  {
    id: 'known-40',
    name: '已知长度 4cm / 40mm',
    length: 40,
    desc: '适合用身边明确为 4cm 的物件校准',
  },
  {
    id: 'known-50',
    name: '已知长度 5cm / 50mm',
    length: 50,
    desc: '适合用身边明确为 5cm 的物件校准',
  },
  {
    id: 'custom',
    name: '自定义长度',
    length: 50,
    custom: true,
    desc: '输入你手边已知物品的真实长度',
  },
]

const DEFAULT_STANDARD_INDEX = 1

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

const formatNumber = (value: number, digits = 2) => {
  if (!Number.isFinite(value)) return '--'
  return String(Number(value.toFixed(digits)))
}

const formatDateTime = (timestamp: number) => {
  if (!timestamp) return ''

  const date = new Date(timestamp)
  const pad = (val: number) => String(val).padStart(2, '0')

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const getWindowSize = () => {
  try {
    const windowInfo = (Taro.getWindowInfo?.() || Taro.getSystemInfoSync()) as {
      windowWidth: number
      windowHeight: number
    }

    return {
      width: windowInfo.windowWidth,
      height: windowInfo.windowHeight,
    }
  } catch {
    return {
      width: 375,
      height: 667,
    }
  }
}

const getPanelHeight = (windowHeight: number) => clamp(Math.floor(windowHeight * 0.78), 660, 920)

const getCalibrationMax = (panelHeight: number) => Math.max(360, panelHeight - 80)

const getEstimatedPxPerMm = (windowWidth: number) => clamp(windowWidth / 68, 4.2, 6.4)

const buildTicks = (maxMm: number): RulerTick[] =>
  Array.from({ length: maxMm + 1 }, (_, mm) => {
    let type: RulerTick['type'] = 'minor'

    if (mm % 10 === 0) {
      type = 'major'
    } else if (mm % 5 === 0) {
      type = 'middle'
    }

    return {
      mm,
      type,
      label: mm % 10 === 0 ? String(mm / 10) : '',
    }
  })

const readCalibration = (): StoredCalibration | null => {
  try {
    const stored = Taro.getStorageSync(STORAGE_KEY) as StoredCalibration | undefined

    if (stored && Number(stored.pxPerMm) > 0) {
      return stored
    }
  } catch {
    return null
  }

  return null
}

export default function RulerPage() {
  const dragStartY = useRef(0)
  const dragStartPx = useRef(0)

  const [standardIndex, setStandardIndex] = useState(DEFAULT_STANDARD_INDEX)
  const [standardName, setStandardName] = useState(standardOptions[DEFAULT_STANDARD_INDEX].name)
  const [standardDesc, setStandardDesc] = useState(standardOptions[DEFAULT_STANDARD_INDEX].desc)
  const [standardLength, setStandardLength] = useState(standardOptions[DEFAULT_STANDARD_INDEX].length)
  const [standardLengthText, setStandardLengthText] = useState(
    formatNumber(standardOptions[DEFAULT_STANDARD_INDEX].length),
  )
  const [isCustomStandard, setIsCustomStandard] = useState(false)
  const [customLengthInput, setCustomLengthInput] = useState('')
  const [windowWidth, setWindowWidth] = useState(375)
  const [calibrationMax, setCalibrationMax] = useState(580)
  const [panelHeight, setPanelHeight] = useState(660)
  const [calibrationPx, setCalibrationPx] = useState(469)
  const [pxPerMm, setPxPerMm] = useState(5.48)
  const [pxPerMmText, setPxPerMmText] = useState('5.48')
  const [tickSize, setTickSize] = useState(5.48)
  const [rulerHeight, setRulerHeight] = useState(1096)
  const [rulerTicks, setRulerTicks] = useState<RulerTick[]>(buildTicks(200))
  const [rulerLengthCm] = useState(20)
  const [hasCalibration, setHasCalibration] = useState(false)
  const [statusText, setStatusText] = useState('未校准')
  const [statusDesc, setStatusDesc] = useState('当前尺子按常见手机宽度估算，只适合临时参考。')
  const [calibrationTimeText, setCalibrationTimeText] = useState('')
  const [dimensionWarning, setDimensionWarning] = useState('')

  const getLengthFromInput = useCallback((value: string) => {
    const length = Number(value)

    if (Number.isFinite(length) && length > 0) {
      return clamp(length, 5, 200)
    }

    return 50
  }, [])

  const getCustomLength = useCallback(
    (input = customLengthInput) => {
      const customLength = Number(input)

      if (Number.isFinite(customLength) && customLength > 0) {
        return clamp(customLength, 5, 200)
      }

      return 50
    },
    [customLengthInput],
  )

  const syncCalibrationLine = useCallback(
    (nextPx: number, max = calibrationMax) => {
      const clamped = clamp(Number(nextPx), 160, max)
      setCalibrationPx(clamped)
      return clamped
    },
    [calibrationMax],
  )

  const rebuildRuler = useCallback((nextPxPerMm: number, width = windowWidth) => {
    const safePxPerMm = Number(nextPxPerMm) || getEstimatedPxPerMm(width)
    const rulerLengthMm = 20 * 10

    setPxPerMm(safePxPerMm)
    setPxPerMmText(formatNumber(safePxPerMm))
    setTickSize(safePxPerMm)
    setRulerTicks(buildTicks(rulerLengthMm))
    setRulerHeight(Math.round(rulerLengthMm * safePxPerMm))
  }, [windowWidth])

  const initRuler = useCallback(() => {
    const windowSize = getWindowSize()
    const nextPanelHeight = getPanelHeight(windowSize.height)
    const nextCalibrationMax = getCalibrationMax(nextPanelHeight)
    const stored = readCalibration()
    const storedStandardIndex = stored ? standardOptions.findIndex((item) => item.id === stored.standardId) : -1
    const nextStandardIndex = storedStandardIndex >= 0 ? storedStandardIndex : DEFAULT_STANDARD_INDEX
    const standard = standardOptions[nextStandardIndex]
    const nextCustomLengthInput =
      stored && stored.standardId === 'custom'
        ? String(stored.customLengthInput || stored.standardLength || '')
        : ''
    const nextStandardLength = standard.custom
      ? getLengthFromInput(nextCustomLengthInput)
      : standard.length
    const nextPxPerMm = stored ? stored.pxPerMm : getEstimatedPxPerMm(windowSize.width)
    const nextCalibrationPx = clamp(Math.round(nextPxPerMm * nextStandardLength), 160, nextCalibrationMax)

    setStandardIndex(nextStandardIndex)
    setStandardName(standard.name)
    setStandardDesc(standard.desc)
    setStandardLength(nextStandardLength)
    setStandardLengthText(formatNumber(nextStandardLength))
    setIsCustomStandard(Boolean(standard.custom))
    setCustomLengthInput(nextCustomLengthInput)
    setWindowWidth(windowSize.width)
    setCalibrationMax(nextCalibrationMax)
    setPanelHeight(nextPanelHeight)
    setCalibrationPx(nextCalibrationPx)
    setHasCalibration(Boolean(stored))
    setStatusText(stored ? '已校准' : '未校准')
    setStatusDesc(
      stored
        ? '当前尺子使用本机保存的校准值，适合同一台设备继续测量。'
        : '当前尺子按常见手机宽度估算，只适合临时参考。',
    )
    setCalibrationTimeText(stored ? `上次校准：${formatDateTime(stored.updatedAt)}` : '')
    rebuildRuler(nextPxPerMm, windowSize.width)
  }, [getLengthFromInput, rebuildRuler])

  const handleResize = useCallback(() => {
    const windowSize = getWindowSize()
    const nextPanelHeight = getPanelHeight(windowSize.height)
    const nextCalibrationMax = getCalibrationMax(nextPanelHeight)

    setWindowWidth(windowSize.width)
    setCalibrationMax(nextCalibrationMax)
    setPanelHeight(nextPanelHeight)
    setDimensionWarning((prev) =>
      hasCalibration ? '屏幕方向或窗口尺寸变化后，建议重新校准一次。' : prev,
    )
    syncCalibrationLine(calibrationPx, nextCalibrationMax)
    rebuildRuler(pxPerMm, windowSize.width)
  }, [calibrationPx, hasCalibration, pxPerMm, rebuildRuler, syncCalibrationLine])

  useEffect(() => {
    initRuler()
  }, [initRuler])

  useEffect(() => {
    const handler = () => {
      handleResize()
    }

    Taro.onWindowResize?.(handler)

    return () => {
      Taro.offWindowResize?.(handler)
    }
  }, [handleResize])

  useShareAppMessage(() => ({
    title: '手机临时当尺子用，先校准再测量更靠谱',
    path: '/packages/tools/ruler/ruler',
  }))

  useShareTimeline(() => ({
    title: '校准尺子：用手机屏幕临时测量长度',
  }))

  const updateCalibrationPx = (value: number) => {
    syncCalibrationLine(value)
  }

  const onStandardChange = (nextIndex: number) => {
    const standard = standardOptions[nextIndex]
    const nextStandardLength = standard.custom ? getCustomLength() : standard.length
    const nextCalibrationPx = clamp(Math.round(pxPerMm * nextStandardLength), 160, calibrationMax)

    setStandardIndex(nextIndex)
    setStandardName(standard.name)
    setStandardDesc(standard.desc)
    setStandardLength(nextStandardLength)
    setStandardLengthText(formatNumber(nextStandardLength))
    setIsCustomStandard(Boolean(standard.custom))
    syncCalibrationLine(nextCalibrationPx)
  }

  const onCustomLengthInput = (value: string) => {
    const nextStandardLength = getLengthFromInput(value)
    const nextCalibrationPx = clamp(Math.round(pxPerMm * nextStandardLength), 160, calibrationMax)

    setCustomLengthInput(value)
    setStandardLength(nextStandardLength)
    setStandardLengthText(formatNumber(nextStandardLength))
    syncCalibrationLine(nextCalibrationPx)
  }

  const onCalibrationTouchStart = (event: ITouchEvent) => {
    const touch = event.touches?.[0]
    if (!touch) return

    dragStartY.current = touch.clientY || touch.pageY || 0
    dragStartPx.current = calibrationPx
  }

  const onCalibrationTouchMove = (event: ITouchEvent) => {
    const touch = event.touches?.[0]
    if (!touch) return

    const currentY = touch.clientY || touch.pageY || 0
    const delta = currentY - dragStartY.current
    updateCalibrationPx(dragStartPx.current + delta)
  }

  const onNudgeTap = (delta: number) => {
    updateCalibrationPx(calibrationPx + delta)
  }

  const onSaveCalibration = () => {
    if (!Number.isFinite(Number(standardLength)) || Number(standardLength) <= 0) {
      Taro.showToast({ title: '请输入有效长度', icon: 'none' })
      return
    }

    const nextPxPerMm = Number(calibrationPx) / Number(standardLength)
    const payload: StoredCalibration = {
      pxPerMm: nextPxPerMm,
      standardId: standardOptions[standardIndex].id,
      standardLength,
      customLengthInput,
      calibrationPx,
      windowWidth,
      updatedAt: Date.now(),
    }

    try {
      Taro.setStorageSync(STORAGE_KEY, payload)
    } catch {
      Taro.showToast({ title: '保存失败', icon: 'none' })
      return
    }

    setPxPerMm(nextPxPerMm)
    setHasCalibration(true)
    setStatusText('已校准')
    setStatusDesc('当前尺子使用本机保存的校准值，适合同一台设备继续测量。')
    setCalibrationTimeText(`上次校准：${formatDateTime(payload.updatedAt)}`)
    setDimensionWarning('')
    rebuildRuler(nextPxPerMm)
    Taro.showToast({ title: '已保存校准', icon: 'success' })
  }

  const onResetCalibration = () => {
    try {
      Taro.removeStorageSync(STORAGE_KEY)
    } catch {
      // 删除失败时继续回到估算值，避免用户卡在旧状态。
    }

    const nextPxPerMm = getEstimatedPxPerMm(windowWidth)
    const nextCalibrationPx = clamp(Math.round(nextPxPerMm * standardLength), 160, calibrationMax)

    setPxPerMm(nextPxPerMm)
    syncCalibrationLine(nextCalibrationPx)
    setHasCalibration(false)
    setStatusText('未校准')
    setStatusDesc('当前尺子按常见手机宽度估算，只适合临时参考。')
    setCalibrationTimeText('')
    setDimensionWarning('')
    rebuildRuler(nextPxPerMm)
    Taro.showToast({ title: '已恢复估算', icon: 'none' })
  }

  return (
    <View className='shell'>
      <NavigationBar title='校准尺子' background='var(--s-1-weak, #f5f7fa)' />
      <ScrollView className='page-scroll' scrollY enhanced showScrollbar={false}>
        <View className='page'>
          <ToolIntroCard
            title='左边校准，右边测量'
            description='竖向比较更适合手机屏幕，银行卡长边也能放下。'
          />

          <View className='card'>
            <View className='card__head'>
              <View>
                <Text className='card__title'>测量面板</Text>
                <Text className='card__subtitle'>拖动左侧校准线，对齐实体卡片边长。</Text>
              </View>
              <Text className={`status-badge ${hasCalibration ? 'is-ready' : ''}`}>{statusText}</Text>
            </View>

            <View className='tool-meta'>
              <Text className='meta-item'>1 mm = {pxPerMmText} px</Text>
              <Text className='meta-item'>{rulerLengthCm} cm 可滑动</Text>
            </View>

            {dimensionWarning ? <Text className='warning-row'>{dimensionWarning}</Text> : null}

            <View className='measure-board' style={{ height: `${panelHeight}px` }}>
              <View className='calibration-pane'>
                <Text className='pane-label'>校准</Text>
                <View className='calibration-stage'>
                  <View className='calibration-line' style={{ height: `${calibrationPx}px` }}>
                    <View className='line-end top' />
                    <View className='line-body' />
                    <View className='line-guide' />
                    <View className='line-end bottom' />
                  </View>
                  <View
                    className='drag-rail'
                    catchMove
                    onTouchStart={onCalibrationTouchStart}
                    onTouchMove={onCalibrationTouchMove}
                  >
                    <View className='drag-rail-line' />
                    <View className='drag-handle' style={{ top: `${calibrationPx}px` }}>
                      <View className='drag-handle-grip' />
                    </View>
                  </View>
                </View>
                <Text className='calibration-value'>{standardLengthText} mm</Text>
              </View>

              <View className='ruler-pane'>
                <Text className='pane-label ruler-label'>尺子</Text>
                <ScrollView className='ruler-scroll' scrollY enhanced showScrollbar={false}>
                  <View className='ruler-track' style={{ height: `${rulerHeight}px` }}>
                    {rulerTicks.map((item) => (
                      <View
                        key={item.mm}
                        className={`tick tick-${item.type}`}
                        style={{ height: `${tickSize}px` }}
                      >
                        <View className='tick-line' />
                        {item.label ? (
                          <View className='tick-label'>
                            <Text className='tick-number'>{item.label}</Text>
                            <Text className='tick-unit'>cm</Text>
                          </View>
                        ) : null}
                      </View>
                    ))}
                  </View>
                </ScrollView>
              </View>
            </View>

            <View className='standard-row'>
              <Picker
                mode='selector'
                range={standardOptions}
                rangeKey='name'
                value={standardIndex}
                onChange={(event) => onStandardChange(Number(event.detail.value))}
              >
                <View className='standard-picker'>
                  <Text className='standard-picker-text'>{standardName}</Text>
                  <Text className='standard-picker-arrow'>▼</Text>
                </View>
              </Picker>
              <Text className='standard-desc'>{standardDesc}</Text>
            </View>

            {isCustomStandard ? (
              <View className='custom-row'>
                <Input
                  className='custom-input'
                  type='digit'
                  value={customLengthInput}
                  placeholder='输入真实长度'
                  placeholderClass='input-placeholder'
                  onInput={(event) => onCustomLengthInput(event.detail.value)}
                />
                <Text className='custom-unit'>mm</Text>
              </View>
            ) : null}

            <View className='nudge-row'>
              <View className='nudge-button' onClick={() => onNudgeTap(-5)}>
                -5
              </View>
              <View className='nudge-button' onClick={() => onNudgeTap(-1)}>
                -1
              </View>
              <Text className='nudge-value'>{calibrationPx} px</Text>
              <View className='nudge-button' onClick={() => onNudgeTap(1)}>
                +1
              </View>
              <View className='nudge-button' onClick={() => onNudgeTap(5)}>
                +5
              </View>
            </View>

            <View className='button-row action-row'>
              <View className='calc-btn' onClick={onSaveCalibration}>
                保存校准
              </View>
              <View className='secondary-btn' onClick={onResetCalibration}>
                恢复估算
              </View>
            </View>

            <Text className='helper-note'>{statusDesc}</Text>
            {calibrationTimeText ? <Text className='helper-note'>{calibrationTimeText}</Text> : null}
            <Text className='helper-note'>
              小程序无法读取真实 PPI，换手机、横竖屏或系统显示缩放变化后建议重新校准。
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  )
}
