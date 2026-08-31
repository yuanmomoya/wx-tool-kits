import { useState } from 'react'
import { Picker, ScrollView, Text, View } from '@tarojs/components'
import Taro, { useShareAppMessage, useShareTimeline } from '@tarojs/taro'

import NavigationBar from '@/components/NavigationBar'
import ToolIntroCard from '@/packages/tools/components/ToolIntroCard'
import { calculateRetirementAge } from './retirement-age.logic'

import './retirement-age.scss'

const workerTypes = [
  {
    id: 'male',
    label: '男职工',
    baseAgeMonths: 60 * 12,
    maxDelayMonths: 36,
    stepMonths: 4,
    finalAgeText: '63 岁',
  },
  {
    id: 'female55',
    label: '女性原 55 岁（管理/专技）',
    baseAgeMonths: 55 * 12,
    maxDelayMonths: 36,
    stepMonths: 4,
    finalAgeText: '58 岁',
  },
  {
    id: 'female50',
    label: '女性原 50 岁（普通工人）',
    baseAgeMonths: 50 * 12,
    maxDelayMonths: 60,
    stepMonths: 2,
    finalAgeText: '55 岁',
  },
]

const POLICY_START_YEAR = 2025
const POLICY_START_MONTH_INDEX = 0

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

function addMonths(date: Date, months: number) {
  const year = date.getFullYear()
  const monthIndex = date.getMonth() + months
  const day = date.getDate()
  const targetYear = year + Math.floor(monthIndex / 12)
  const targetMonth = ((monthIndex % 12) + 12) % 12
  const lastDate = new Date(targetYear, targetMonth + 1, 0).getDate()
  return new Date(targetYear, targetMonth, Math.min(day, lastDate))
}

function getMonthIndex(date: Date) {
  return date.getFullYear() * 12 + date.getMonth()
}

function getPolicyDelayMonths(
  oldRetireDate: Date,
  workerType: (typeof workerTypes)[number]
) {
  const oldMonthIndex = getMonthIndex(oldRetireDate)
  const startMonthIndex = POLICY_START_YEAR * 12 + POLICY_START_MONTH_INDEX
  if (oldMonthIndex < startMonthIndex) return 0
  const monthsAfterStart = oldMonthIndex - startMonthIndex
  const delayMonths = Math.floor(monthsAfterStart / workerType.stepMonths) + 1
  return Math.min(delayMonths, workerType.maxDelayMonths)
}

function formatAgeByMonths(totalMonths: number) {
  const years = Math.floor(totalMonths / 12)
  const months = totalMonths % 12
  if (!months) return `${years} 岁`
  return `${years} 岁 ${months} 个月`
}

function formatYearMonth(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

const defaultResult = {
  retireDate: '--',
  retireAgeText: '--',
  flexibleDate: '--',
  flexibleAgeText: '--',
  delayText: '--',
  oldRetireDate: '--',
  workerTypeText: '--',
  ruleText: '选择出生日期和人员类型后开始计算',
  summary: '结果会按渐进式延迟退休规则粗略估算。',
}

export default function RetirementAgePage() {
  const [birthDate, setBirthDate] = useState('')
  const [todayDate] = useState(formatDate(new Date()))
  const [workerType, setWorkerType] = useState('male')
  const [hasResult, setHasResult] = useState(false)
  const [result, setResult] = useState(defaultResult)

  useShareAppMessage(() => ({
    title: '输入出生日期，估算自己的退休时间',
    path: '/packages/tools/retirement-age/retirement-age',
  }))

  useShareTimeline(() => ({
    title: '退休年龄计算器：估算法定退休年月',
  }))

  const clearResult = () => {
    setHasResult(false)
    setResult(defaultResult)
  }

  const onCalculate = () => {
    const type = workerTypes.find((item) => item.id === workerType)
    if (!birthDate) {
      Taro.showToast({ title: '请选择出生日期', icon: 'none' })
      return
    }
    if (!type) {
      Taro.showToast({ title: '请选择人员类型', icon: 'none' })
      return
    }

    const policy = calculateRetirementAge(birthDate, type.id as 'male' | 'female55' | 'female50')
    const oldRetireDate = parseDate(policy.oldRetireDate)
    const delayMonths = policy.delayMonths
    const retireDate = parseDate(policy.retireDate)
    const retireAgeMonths = policy.retireAgeMonths
    const flexibleAgeMonths = retireAgeMonths + 36
    const flexibleRetireDate = parseDate(policy.flexibleRetireDate)
    const ruleText = delayMonths
      ? `按规则延迟 ${delayMonths} 个月，最终不超过 ${type.finalAgeText}`
      : '原退休时间早于 2025 年，按原年龄估算'

    setHasResult(true)
    setResult({
      retireDate: formatYearMonth(retireDate),
      retireAgeText: formatAgeByMonths(retireAgeMonths),
      flexibleDate: formatYearMonth(flexibleRetireDate),
      flexibleAgeText: formatAgeByMonths(flexibleAgeMonths),
      delayText: `${delayMonths} 个月`,
      oldRetireDate: formatYearMonth(oldRetireDate),
      workerTypeText: type.label,
      ruleText,
      summary: '结果按普通职工法定退休年龄估算，特殊工种、病退、灵活就业和地方办理细则可能不同。',
    })
  }

  return (
    <View className='shell'>
      <NavigationBar title='退休年龄' background='var(--s-1-weak, #f5f7fa)' />
      <ScrollView className='page-scroll' scrollY enhanced showScrollbar={false}>
        <View className='page'>
          <ToolIntroCard
            title='估算自己的退休时间'
            description='按出生日期、性别和人员类型，估算退休年龄与退休年月。'
          />

          <View className='card'>
            <Text className='card__title'>基本信息</Text>
            <View className='field-list'>
              <Picker
                mode='date'
                value={birthDate || todayDate}
                end={todayDate}
                onChange={(e) => {
                  setBirthDate(e.detail.value)
                  clearResult()
                }}
              >
                <View className='field-row'>
                  <View className='field-main'>
                    <Text className='field-label'>出生日期</Text>
                    <Text className={`picker-value ${birthDate ? '' : 'is-placeholder'}`}>
                      {birthDate || '请选择出生日期'}
                    </Text>
                  </View>
                </View>
              </Picker>
            </View>
            <Text className='card__title' style={{ marginTop: '16px' }}>
              人员类型
            </Text>
            <View className='type-list'>
              {workerTypes.map((item) => (
                <View
                  key={item.id}
                  className={`type-item ${workerType === item.id ? 'is-active' : ''}`}
                  onClick={() => {
                    setWorkerType(item.id)
                    clearResult()
                  }}
                >
                  {item.label}
                </View>
              ))}
            </View>
            <View className='button-row'>
              <View className='calc-btn' onClick={onCalculate}>
                开始计算
              </View>
            </View>
          </View>

          <View className='result-card'>
            <View className='result-head'>
              <View>
                <Text className='result-label'>预计退休年月</Text>
                <Text className='result-value result-value-sm'>{result.retireDate}</Text>
              </View>
              <Text className='result-badge'>{hasResult ? result.retireAgeText : '待计算'}</Text>
            </View>
            <View className='summary-grid'>
              <View className='summary-item'>
                <Text className='summary-label'>延迟月数</Text>
                <Text className='summary-value'>{result.delayText}</Text>
              </View>
              <View className='summary-item'>
                <Text className='summary-label'>原退休年月</Text>
                <Text className='summary-value'>{result.oldRetireDate}</Text>
              </View>
            </View>
            {hasResult ? (
              <View className='detail-card'>
                <View className='detail-row'>
                  <Text className='detail-label'>人员类型</Text>
                  <Text className='detail-value'>{result.workerTypeText}</Text>
                </View>
                <View className='detail-row'>
                  <Text className='detail-label'>弹性上限</Text>
                  <Text className='detail-value'>
                    {result.flexibleDate} / {result.flexibleAgeText}
                  </Text>
                </View>
                <Text className='detail-desc'>{result.ruleText}</Text>
                <Text className='detail-tip'>{result.summary}</Text>
                <Text
                  className='reset-link'
                  onClick={() => {
                    setBirthDate('')
                    setWorkerType('male')
                    clearResult()
                  }}
                >
                  重新填写
                </Text>
              </View>
            ) : (
              <Text className='result-empty'>选择出生日期和人员类型后，这里会显示退休年月估算。</Text>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  )
}
