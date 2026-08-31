import { useState } from 'react'
import { Input, Picker, ScrollView, Text, View } from '@tarojs/components'
import Taro, { useShareAppMessage, useShareTimeline } from '@tarojs/taro'

import NavigationBar from '@/components/NavigationBar'
import ToolIntroCard from '@/packages/tools/components/ToolIntroCard'
import { calculateExpiry, getShelfStatus } from './shelf-life.logic'

import './shelf-life.scss'

const unitOptions = [
  { id: 'day', label: '天' },
  { id: 'month', label: '月' },
  { id: 'year', label: '年' },
]

const STATUS_THEME_MAP: Record<string, { badge: string }> = {
  pending: { badge: '待计算' },
  fresh: { badge: '未过期' },
  warning: { badge: '快到期' },
  today: { badge: '今天到期' },
  expired: { badge: '已过期' },
}

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

function getMonthLastDate(year: number, monthIndex: number) {
  return new Date(year, monthIndex + 1, 0).getDate()
}

function addDays(date: Date, days: number) {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

function addMonths(date: Date, months: number) {
  const year = date.getFullYear()
  const monthIndex = date.getMonth() + months
  const day = date.getDate()
  const targetYear = year + Math.floor(monthIndex / 12)
  const targetMonth = ((monthIndex % 12) + 12) % 12
  const lastDate = getMonthLastDate(targetYear, targetMonth)
  return new Date(targetYear, targetMonth, Math.min(day, lastDate))
}

function addYears(date: Date, years: number) {
  const targetYear = date.getFullYear() + years
  const targetMonth = date.getMonth()
  const day = date.getDate()
  const lastDate = getMonthLastDate(targetYear, targetMonth)
  return new Date(targetYear, targetMonth, Math.min(day, lastDate))
}

function getDayDiff(startDate: Date, endDate: Date) {
  const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate())
  const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate())
  return Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000))
}

function getUnitText(value: number, unitKey: string) {
  const unitMap: Record<string, string> = { day: '天', month: '个月', year: '年' }
  return `${value} ${unitMap[unitKey]}`
}

function calculateExpiryDate(manufactureDate: Date, shelfLifeValue: number, unitKey: string) {
  if (unitKey === 'day') return addDays(manufactureDate, shelfLifeValue - 1)
  if (unitKey === 'month') return addDays(addMonths(manufactureDate, shelfLifeValue), -1)
  return addDays(addYears(manufactureDate, shelfLifeValue), -1)
}

const defaultResult = {
  expiryDate: '--',
  badge: STATUS_THEME_MAP.pending.badge,
  statusText: '--',
  distanceText: '--',
  shelfLifeText: '--',
  statusTheme: 'pending',
}

export default function ShelfLifePage() {
  const [manufactureDate, setManufactureDate] = useState('')
  const [todayDate] = useState(formatDate(new Date()))
  const [shelfLifeValue, setShelfLifeValue] = useState('')
  const [unitKey, setUnitKey] = useState('month')
  const [hasResult, setHasResult] = useState(false)
  const [result, setResult] = useState(defaultResult)

  useShareAppMessage(() => ({
    title: '商品什么时候过期？输入生产日期和保质期就能算',
    path: '/packages/tools/shelf-life/shelf-life',
  }))

  useShareTimeline(() => ({
    title: '保质期计算器：快速判断到期日和剩余天数',
  }))

  const clearResult = () => {
    setHasResult(false)
    setResult(defaultResult)
  }

  const onCalculate = () => {
    const value = Number(shelfLifeValue)
    if (!manufactureDate) {
      Taro.showToast({ title: '请选择生产日期', icon: 'none' })
      return
    }
    if (!Number.isInteger(value) || value <= 0) {
      Taro.showToast({ title: '保质期请填写正整数', icon: 'none' })
      return
    }
    if (value > 9999) {
      Taro.showToast({ title: '保质期数值看起来有点大', icon: 'none' })
      return
    }

    const expiryDate = calculateExpiry(manufactureDate, value, unitKey as 'day' | 'month' | 'year')
    const diffFromReference = getShelfStatus(expiryDate, todayDate).remainingDays
    const shelfLifeText = getUnitText(value, unitKey)

    let statusTheme = 'fresh'
    let statusText = ''
    let distanceText = ''

    if (diffFromReference > 7) {
      statusTheme = 'fresh'
      statusText = '当前还在保质期内'
      distanceText = `距离到期还有 ${diffFromReference} 天`
    } else if (diffFromReference > 0) {
      statusTheme = 'warning'
      statusText = '已经临近到期'
      distanceText = `距离到期还有 ${diffFromReference} 天`
    } else if (diffFromReference === 0) {
      statusTheme = 'today'
      statusText = '今天就是到期参考日'
      distanceText = '建议尽快食用或使用'
    } else {
      statusTheme = 'expired'
      statusText = '已经超过保质期'
      distanceText = `已过期 ${Math.abs(diffFromReference)} 天`
    }

    setHasResult(true)
    setResult({
      expiryDate,
      badge: STATUS_THEME_MAP[statusTheme].badge,
      statusText,
      distanceText,
      shelfLifeText,
      statusTheme,
    })
  }

  return (
    <View className='shell'>
      <NavigationBar title='保质期计算' background='var(--s-1-weak, #f5f7fa)' />
      <ScrollView className='page-scroll' scrollY enhanced showScrollbar={false}>
        <View className='page'>
          <ToolIntroCard
            title='计算到期日和剩余天数'
            description='输入生产日期和保质期，快速判断商品是否临期或过期。'
          />

          <View className='card'>
            <Text className='card__title'>保质期信息</Text>
            <View className='field-list'>
              <Picker
                mode='date'
                value={manufactureDate || todayDate}
                end={todayDate}
                onChange={(e) => {
                  setManufactureDate(e.detail.value)
                  clearResult()
                }}
              >
                <View className='field-row'>
                  <View className='field-main'>
                    <Text className='field-label'>生产日期</Text>
                    <Text className={`picker-value ${manufactureDate ? '' : 'is-placeholder'}`}>
                      {manufactureDate || '请选择生产日期'}
                    </Text>
                  </View>
                </View>
              </Picker>
              <View className='field-row'>
                <View className='field-main'>
                  <Text className='field-label'>保质期</Text>
                  <Input
                    className='field-input'
                    type='number'
                    value={shelfLifeValue}
                    placeholder='请输入保质期'
                    placeholderClass='input-placeholder'
                    onInput={(e) => {
                      setShelfLifeValue(e.detail.value)
                      clearResult()
                    }}
                  />
                  <View className='chip-row'>
                    {unitOptions.map((item) => (
                      <View
                        key={item.id}
                        className={`chip ${unitKey === item.id ? 'is-active' : ''}`}
                        onClick={() => {
                          setUnitKey(item.id)
                          clearResult()
                        }}
                      >
                        {item.label}
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            </View>
            <Text className='helper-note'>参考日按今天 {todayDate} 计算。</Text>
            <View className='button-row'>
              <View className='calc-btn' onClick={onCalculate}>
                计算到期日
              </View>
            </View>
          </View>

          <View className={`result-card status-${result.statusTheme}`}>
            <View className='result-head'>
              <View>
                <Text className='result-label'>到期参考日</Text>
                <Text className='result-value result-value-sm'>{result.expiryDate}</Text>
              </View>
              <Text className='result-badge'>{result.badge}</Text>
            </View>
            {hasResult ? (
              <View className='detail-card'>
                <Text className='detail-desc'>{result.statusText}</Text>
                <Text className='detail-tip'>{result.distanceText}</Text>
                <View className='detail-row'>
                  <Text className='detail-label'>保质期</Text>
                  <Text className='detail-value'>{result.shelfLifeText}</Text>
                </View>
                <Text
                  className='reset-link'
                  onClick={() => {
                    setManufactureDate('')
                    setShelfLifeValue('')
                    setUnitKey('month')
                    clearResult()
                  }}
                >
                  重新填写
                </Text>
              </View>
            ) : (
              <Text className='result-empty'>填好生产日期和保质期后，这里会显示到期参考日和当前状态。</Text>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  )
}
