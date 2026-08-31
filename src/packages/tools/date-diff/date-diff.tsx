import { useState } from 'react'
import { Input, Picker, ScrollView, Text, View } from '@tarojs/components'
import Taro, { useShareAppMessage, useShareTimeline } from '@tarojs/taro'

import NavigationBar from '@/components/NavigationBar'
import ToolIntroCard from '@/packages/tools/components/ToolIntroCard'
import { addCalendarDays, calendarDayDiff, countWeekdays as countCalendarWeekdays } from './date-diff.logic'

import './date-diff.scss'

function formatDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseDate(dateString: string) {
  const [year, month, day] = String(dateString || '').split('-').map(Number)
  return new Date(year, month - 1, day)
}

function cloneDateOnly(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function addDays(date: Date, days: number) {
  return parseDate(addCalendarDays(formatDate(date), days))
}

function getDayDiff(startDate: Date, endDate: Date) {
  return calendarDayDiff(formatDate(startDate), formatDate(endDate))
}

function countWeekdays(startDate: Date, endDate: Date) {
  return Math.abs(countCalendarWeekdays(formatDate(startDate), formatDate(endDate), true))
}

function getWeekText(days: number) {
  const weeks = Math.floor(days / 7)
  const restDays = days % 7
  if (!weeks) return `${restDays} 天`
  if (!restDays) return `${weeks} 周`
  return `${weeks} 周 ${restDays} 天`
}

const today = formatDate(new Date())

const defaultInterval = {
  daysText: '--',
  inclusiveText: '--',
  weekText: '--',
  weekdayText: '--',
  directionText: '选择日期后开始计算',
}

const defaultOffset = {
  targetDate: '--',
  baseDate: '--',
  offsetText: '--',
  directionText: '--',
}

export default function DateDiffPage() {
  const [startDate, setStartDate] = useState(today)
  const [endDate, setEndDate] = useState(today)
  const [baseDate, setBaseDate] = useState(today)
  const [offsetDays, setOffsetDays] = useState('30')
  const [offsetDirection, setOffsetDirection] = useState('after')
  const [hasIntervalResult, setHasIntervalResult] = useState(false)
  const [hasOffsetResult, setHasOffsetResult] = useState(false)
  const [intervalResult, setIntervalResult] = useState(defaultInterval)
  const [offsetResult, setOffsetResult] = useState(defaultOffset)

  useShareAppMessage(() => ({
    title: '两个日期相差几天？也能反推前后日期',
    path: '/packages/tools/date-diff/date-diff',
  }))

  useShareTimeline(() => ({
    title: '日期间隔计算器：算天数、推日期',
  }))

  const onCalculateInterval = () => {
    if (!startDate || !endDate) {
      Taro.showToast({ title: '请选择两个日期', icon: 'none' })
      return
    }
    const start = parseDate(startDate)
    const end = parseDate(endDate)
    const signedDiff = getDayDiff(start, end)
    const days = Math.abs(signedDiff)
    if (days > 36500) {
      Taro.showToast({ title: '日期跨度有点大', icon: 'none' })
      return
    }
    let directionText = '两个日期是同一天'
    if (signedDiff > 0) directionText = '结束日期晚于开始日期'
    else if (signedDiff < 0) directionText = '结束日期早于开始日期'

    setHasIntervalResult(true)
    setIntervalResult({
      daysText: `${days} 天`,
      inclusiveText: `${days + 1} 天`,
      weekText: getWeekText(days),
      weekdayText: `${countWeekdays(start, end)} 天`,
      directionText,
    })
  }

  const onCalculateOffset = () => {
    const offsetInput = String(offsetDays || '').trim()
    const days = Number(offsetDays)
    if (!baseDate) {
      Taro.showToast({ title: '请选择基准日期', icon: 'none' })
      return
    }
    if (!offsetInput || !Number.isInteger(days) || days < 0) {
      Taro.showToast({ title: '天数请填写非负整数', icon: 'none' })
      return
    }
    if (days > 36500) {
      Taro.showToast({ title: '天数有点大', icon: 'none' })
      return
    }
    const base = parseDate(baseDate)
    const sign = offsetDirection === 'before' ? -1 : 1
    const target = addDays(base, sign * days)
    setHasOffsetResult(true)
    setOffsetResult({
      targetDate: formatDate(target),
      baseDate,
      offsetText: `${days} 天`,
      directionText: offsetDirection === 'before' ? '之前' : '之后',
    })
  }

  return (
    <View className='shell'>
      <NavigationBar title='日期间隔' background='var(--s-1-weak, #f5f7fa)' />
      <ScrollView className='page-scroll' scrollY enhanced showScrollbar={false}>
        <View className='page'>
          <ToolIntroCard
            title='算天数，也能反推日期'
            description='可计算两个日期的间隔，也可按指定天数推算前后日期。'
          />

          <View className='card'>
            <Text className='card__title'>日期间隔</Text>
            <View className='field-list'>
              <Picker
                mode='date'
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.detail.value)
                  setHasIntervalResult(false)
                  setIntervalResult(defaultInterval)
                }}
              >
                <View className='field-row'>
                  <View className='field-main'>
                    <Text className='field-label'>开始日期</Text>
                    <Text className='picker-value'>{startDate || '请选择'}</Text>
                  </View>
                </View>
              </Picker>
              <Picker
                mode='date'
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.detail.value)
                  setHasIntervalResult(false)
                  setIntervalResult(defaultInterval)
                }}
              >
                <View className='field-row'>
                  <View className='field-main'>
                    <Text className='field-label'>结束日期</Text>
                    <Text className='picker-value'>{endDate || '请选择'}</Text>
                  </View>
                </View>
              </Picker>
            </View>
            <View className='button-row'>
              <View className='calc-btn' onClick={onCalculateInterval}>
                计算间隔
              </View>
            </View>
          </View>

          <View className='result-card'>
            <View className='result-head'>
              <View>
                <Text className='result-label'>相差天数</Text>
                <Text className='result-value result-value-sm'>{intervalResult.daysText}</Text>
              </View>
              <Text className='result-badge'>{hasIntervalResult ? '已计算' : '待计算'}</Text>
            </View>
            <View className='summary-grid'>
              <View className='summary-item'>
                <Text className='summary-label'>含首尾</Text>
                <Text className='summary-value'>{intervalResult.inclusiveText}</Text>
              </View>
              <View className='summary-item'>
                <Text className='summary-label'>折合周数</Text>
                <Text className='summary-value'>{intervalResult.weekText}</Text>
              </View>
            </View>
            <View className='detail-row'>
              <Text className='detail-label'>工作日</Text>
              <Text className='detail-value'>{intervalResult.weekdayText}</Text>
            </View>
            <Text className='detail-desc'>{intervalResult.directionText}</Text>
            {hasIntervalResult ? (
              <Text
                className='reset-link'
                onClick={() => {
                  setStartDate(today)
                  setEndDate(today)
                  setHasIntervalResult(false)
                  setIntervalResult(defaultInterval)
                }}
              >
                重置间隔
              </Text>
            ) : null}
          </View>

          <View className='card'>
            <Text className='card__title'>日期推算</Text>
            <View className='field-list'>
              <Picker
                mode='date'
                value={baseDate}
                onChange={(e) => {
                  setBaseDate(e.detail.value)
                  setHasOffsetResult(false)
                  setOffsetResult(defaultOffset)
                }}
              >
                <View className='field-row'>
                  <View className='field-main'>
                    <Text className='field-label'>基准日期</Text>
                    <Text className='picker-value'>{baseDate || '请选择'}</Text>
                  </View>
                </View>
              </Picker>
              <View className='field-row'>
                <View className='field-main'>
                  <Text className='field-label'>偏移天数</Text>
                  <Input
                    className='field-input'
                    type='number'
                    value={offsetDays}
                    placeholder='例如 30'
                    placeholderClass='input-placeholder'
                    onInput={(e) => {
                      setOffsetDays(e.detail.value)
                      setHasOffsetResult(false)
                      setOffsetResult(defaultOffset)
                    }}
                  />
                  <View className='direction-row'>
                    <View
                      className={`chip ${offsetDirection === 'before' ? 'is-active' : ''}`}
                      onClick={() => {
                        setOffsetDirection('before')
                        setHasOffsetResult(false)
                        setOffsetResult(defaultOffset)
                      }}
                    >
                      之前
                    </View>
                    <View
                      className={`chip ${offsetDirection === 'after' ? 'is-active' : ''}`}
                      onClick={() => {
                        setOffsetDirection('after')
                        setHasOffsetResult(false)
                        setOffsetResult(defaultOffset)
                      }}
                    >
                      之后
                    </View>
                  </View>
                </View>
                <Text className='field-unit'>天</Text>
              </View>
            </View>
            <View className='button-row'>
              <View className='calc-btn' onClick={onCalculateOffset}>
                推算日期
              </View>
            </View>
          </View>

          <View className='result-card'>
            <View className='result-head'>
              <View>
                <Text className='result-label'>目标日期</Text>
                <Text className='result-value result-value-sm'>{offsetResult.targetDate}</Text>
              </View>
              <Text className='result-badge'>{hasOffsetResult ? '已推算' : '待计算'}</Text>
            </View>
            {hasOffsetResult ? (
              <View className='detail-card'>
                <View className='detail-row'>
                  <Text className='detail-label'>基准</Text>
                  <Text className='detail-value'>{offsetResult.baseDate}</Text>
                </View>
                <View className='detail-row'>
                  <Text className='detail-label'>偏移</Text>
                  <Text className='detail-value'>
                    {offsetResult.directionText} {offsetResult.offsetText}
                  </Text>
                </View>
                <Text
                  className='reset-link'
                  onClick={() => {
                    setBaseDate(today)
                    setOffsetDays('30')
                    setOffsetDirection('after')
                    setHasOffsetResult(false)
                    setOffsetResult(defaultOffset)
                  }}
                >
                  重置推算
                </Text>
              </View>
            ) : (
              <Text className='result-empty'>选择基准日期并填写天数后，这里会显示推算结果。</Text>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  )
}
