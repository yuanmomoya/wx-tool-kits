import { useState } from 'react'
import { Input, ScrollView, Text, View } from '@tarojs/components'
import Taro, { useShareAppMessage, useShareTimeline } from '@tarojs/taro'

import NavigationBar from '@/components/NavigationBar'
import ToolIntroCard from '@/packages/tools/components/ToolIntroCard'
import { calculateCompound } from './compound.logic'

import './compound.scss'

const quickRateOptions = ['1', '3', '5', '8', '10']
const quickYearOptions = ['1', '3', '5', '10', '20']

const defaultResult = {
  totalAssetsCompact: '--',
  totalAssets: '--',
  totalInvested: '--',
  totalProfit: '--',
  profitRate: '--',
  monthlyRate: '--',
  principalFuture: '--',
  sipFuture: '--',
  planLabel: '',
  summary: '',
}

function formatMoney(value: number) {
  const fixed = Number(value || 0).toFixed(2)
  return `${fixed.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} 元`
}

function trimZero(value: number) {
  return Number(value || 0)
    .toFixed(2)
    .replace(/\.0+$/, '')
    .replace(/(\.\d*[1-9])0+$/, '$1')
}

function formatCompactMoney(value: number) {
  const amount = Number(value || 0)
  if (amount >= 100000000) return `${trimZero(amount / 100000000)} 亿`
  if (amount >= 10000) return `${trimZero(amount / 10000)} 万`
  return trimZero(amount)
}

function formatPercent(value: number, digits = 1) {
  return `${Number(value || 0)
    .toFixed(digits)
    .replace(/\.0+$/, '')
    .replace(/(\.\d*[1-9])0+$/, '$1')}%`
}

export default function CompoundPage() {
  const [principalValue, setPrincipalValue] = useState('')
  const [monthlyValue, setMonthlyValue] = useState('')
  const [annualRateValue, setAnnualRateValue] = useState('')
  const [yearsValue, setYearsValue] = useState('')
  const [hasResult, setHasResult] = useState(false)
  const [result, setResult] = useState(defaultResult)

  useShareAppMessage(() => ({
    title: '长期复利和每月定投，算一下未来能有多少',
    path: '/packages/tools/compound/compound',
  }))

  useShareTimeline(() => ({
    title: '复利 / 定投计算器：估算长期收益结果',
  }))

  const clearResult = () => {
    setHasResult(false)
    setResult(defaultResult)
  }

  const onCalculate = () => {
    const principal = Number(principalValue || 0)
    const monthly = Number(monthlyValue || 0)
    const annualRate = Number(annualRateValue)
    const years = Number(yearsValue)

    if (principal === 0 && monthly === 0) {
      Taro.showToast({ title: '请至少填写本金或每月定投', icon: 'none' })
      return
    }
    if (principal < 0 || monthly < 0) {
      Taro.showToast({ title: '金额不能是负数', icon: 'none' })
      return
    }
    if (principal > 1000000000 || monthly > 100000000) {
      Taro.showToast({ title: '金额看起来有点大，检查一下', icon: 'none' })
      return
    }
    if (Number.isNaN(annualRate) || annualRate < 0 || annualRate > 100) {
      Taro.showToast({ title: '年化收益率建议填 0 到 100', icon: 'none' })
      return
    }
    if (Number.isNaN(years) || years < 0.5 || years > 80) {
      Taro.showToast({ title: '投资年限建议填 0.5 到 80 年', icon: 'none' })
      return
    }

    const calculation = calculateCompound(principal, monthly, annualRate, years)
    const { months, monthlyRate, principalFuture, contributionsFuture: sipFuture } = calculation
    const totalAssets = calculation.total
    const totalInvested = calculation.invested
    const totalProfit = calculation.profit
    const profitRate = totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0

    setHasResult(true)
    setResult({
      totalAssetsCompact: formatCompactMoney(totalAssets),
      totalAssets: formatMoney(totalAssets),
      totalInvested: formatMoney(totalInvested),
      totalProfit: formatMoney(totalProfit),
      profitRate: formatPercent(profitRate, 1),
      monthlyRate: formatPercent(monthlyRate * 100, 2),
      principalFuture: formatMoney(principalFuture),
      sipFuture: formatMoney(sipFuture),
      planLabel: `${months} 个月`,
      summary:
        '按月复利估算，并默认每月月末投入一次定投；这里先把年化收益率换算成等效月收益率，再计算整段持有结果。',
    })
  }

  const onReset = () => {
    setPrincipalValue('')
    setMonthlyValue('')
    setAnnualRateValue('')
    setYearsValue('')
    clearResult()
  }

  return (
    <View className='shell'>
      <NavigationBar title='复利 / 定投' background='var(--s-1-weak, #f5f7fa)' />
      <ScrollView className='page-scroll' scrollY enhanced showScrollbar={false}>
        <View className='page'>
          <ToolIntroCard
            title='估算复利和定投结果'
            description='输入本金、每月投入、收益率和期限，查看期末总额与收益。'
          />

          <View className='card'>
            <Text className='card__title'>投资参数</Text>
            <View className='field-list'>
              <View className='field-row'>
                <View className='field-main'>
                  <Text className='field-label'>初始本金</Text>
                  <Input
                    className='field-input'
                    type='digit'
                    value={principalValue}
                    placeholder='可以填 0'
                    placeholderClass='input-placeholder'
                    onInput={(e) => {
                      setPrincipalValue(e.detail.value)
                      clearResult()
                    }}
                  />
                </View>
                <Text className='field-unit'>元</Text>
              </View>
              <View className='field-row'>
                <View className='field-main'>
                  <Text className='field-label'>每月定投</Text>
                  <Input
                    className='field-input'
                    type='digit'
                    value={monthlyValue}
                    placeholder='可以填 0'
                    placeholderClass='input-placeholder'
                    onInput={(e) => {
                      setMonthlyValue(e.detail.value)
                      clearResult()
                    }}
                  />
                </View>
                <Text className='field-unit'>元</Text>
              </View>
              <View className='field-row'>
                <View className='field-main'>
                  <Text className='field-label'>年化收益率</Text>
                  <Input
                    className='field-input'
                    type='digit'
                    value={annualRateValue}
                    placeholder='例如 5'
                    placeholderClass='input-placeholder'
                    onInput={(e) => {
                      setAnnualRateValue(e.detail.value)
                      clearResult()
                    }}
                  />
                  <View className='quick-row'>
                    {quickRateOptions.map((item) => (
                      <View
                        key={item}
                        className={`chip ${annualRateValue === item ? 'is-active' : ''}`}
                        onClick={() => {
                          setAnnualRateValue(item)
                          clearResult()
                        }}
                      >
                        {item}%
                      </View>
                    ))}
                  </View>
                </View>
                <Text className='field-unit'>%</Text>
              </View>
              <View className='field-row'>
                <View className='field-main'>
                  <Text className='field-label'>投资年限</Text>
                  <Input
                    className='field-input'
                    type='digit'
                    value={yearsValue}
                    placeholder='例如 10'
                    placeholderClass='input-placeholder'
                    onInput={(e) => {
                      setYearsValue(e.detail.value)
                      clearResult()
                    }}
                  />
                  <View className='quick-row'>
                    {quickYearOptions.map((item) => (
                      <View
                        key={item}
                        className={`chip ${yearsValue === item ? 'is-active' : ''}`}
                        onClick={() => {
                          setYearsValue(item)
                          clearResult()
                        }}
                      >
                        {item} 年
                      </View>
                    ))}
                  </View>
                </View>
                <Text className='field-unit'>年</Text>
              </View>
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
                <Text className='result-label'>预计总资产</Text>
                <Text className='result-value'>{result.totalAssetsCompact}</Text>
              </View>
              <Text className='result-badge'>{hasResult ? result.planLabel : '待计算'}</Text>
            </View>
            <View className='summary-grid'>
              <View className='summary-item'>
                <Text className='summary-label'>累计投入</Text>
                <Text className='summary-value'>{result.totalInvested}</Text>
              </View>
              <View className='summary-item'>
                <Text className='summary-label'>累计收益</Text>
                <Text className='summary-value'>{result.totalProfit}</Text>
              </View>
            </View>
            {hasResult ? (
              <View className='detail-card'>
                <View className='detail-row'>
                  <Text className='detail-label'>收益率</Text>
                  <Text className='detail-value'>{result.profitRate}</Text>
                </View>
                <View className='detail-row'>
                  <Text className='detail-label'>等效月利率</Text>
                  <Text className='detail-value'>{result.monthlyRate}</Text>
                </View>
                <View className='detail-row'>
                  <Text className='detail-label'>本金终值</Text>
                  <Text className='detail-value'>{result.principalFuture}</Text>
                </View>
                <View className='detail-row'>
                  <Text className='detail-label'>定投终值</Text>
                  <Text className='detail-value'>{result.sipFuture}</Text>
                </View>
                <Text className='detail-desc'>{result.summary}</Text>
                <Text className='detail-tip'>精确值：{result.totalAssets}</Text>
                <Text className='reset-link' onClick={onReset}>
                  重新填写
                </Text>
              </View>
            ) : (
              <Text className='result-empty'>填好本金、定投、收益率和年限后，这里会显示复利结果。</Text>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  )
}
