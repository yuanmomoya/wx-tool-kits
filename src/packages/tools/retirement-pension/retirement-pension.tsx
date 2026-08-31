import { useState } from 'react'
import { Input, ScrollView, Text, View } from '@tarojs/components'
import Taro, { useShareAppMessage, useShareTimeline } from '@tarojs/taro'

import NavigationBar from '@/components/NavigationBar'
import ToolIntroCard from '@/packages/tools/components/ToolIntroCard'
import { calculatePension, getAccountMonthsByAge } from './retirement-pension.logic'

import './retirement-pension.scss'

const retireAgeOptions = [
  { age: '50', months: 195 },
  { age: '55', months: 170 },
  { age: '60', months: 139 },
  { age: '65', months: 101 },
]

const contributionLevelOptions = [
  { id: 'low', label: '偏低', index: 0.6, desc: '约最低档' },
  { id: 'average', label: '平均', index: 1.0, desc: '接近社平' },
  { id: 'high', label: '较高', index: 1.5, desc: '高于平均' },
]

const baseQuickOptions = ['6000', '8000', '10000', '12000']
const PERSONAL_PENSION_RATE = 0.08

function toAmount(value: string) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function formatMoney(value: number) {
  if (!Number.isFinite(value)) return '--'
  return `${value.toFixed(0)} 元`
}

function formatYear(value: number) {
  if (!Number.isFinite(value)) return '--'
  return `${value.toFixed(1).replace(/\.0$/, '')} 年`
}

function formatRate(value: number) {
  return `${Number(value).toFixed(2)}`
}

const defaultResult = {
  monthlyTotal: '--',
  basePension: '--',
  accountPension: '--',
  yearlyTotal: '--',
  totalYears: '--',
  futureYears: '--',
  futureAccount: '--',
  accountMonths: '--',
  summary: '填好参数后，这里会显示预计每月养老金。',
}

export default function RetirementPensionPage() {
  const [currentAge, setCurrentAge] = useState('')
  const [payYears, setPayYears] = useState('')
  const [accountBalance, setAccountBalance] = useState('')
  const [monthlyPayBase, setMonthlyPayBase] = useState('')
  const [contributionLevel, setContributionLevel] = useState('average')
  const [retireAge, setRetireAge] = useState('60')
  const [accountMonths, setAccountMonths] = useState('139')
  const [estimateBase, setEstimateBase] = useState('8000')
  const [extraMonthly, setExtraMonthly] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [hasResult, setHasResult] = useState(false)
  const [result, setResult] = useState(defaultResult)

  useShareAppMessage(() => ({
    title: '退休后每月养老金大概多少？先做个粗略估算',
    path: '/packages/tools/retirement-pension/retirement-pension',
  }))

  useShareTimeline(() => ({
    title: '养老金估算器：粗略估算退休后每月金额',
  }))

  const clearResult = () => {
    setHasResult(false)
    setResult(defaultResult)
  }

  const onCalculate = () => {
    const current = toAmount(currentAge)
    const retire = toAmount(retireAge)
    const paid = toAmount(payYears)
    const balance = toAmount(accountBalance)
    const payBase = toAmount(monthlyPayBase)
    const base = toAmount(estimateBase)
    const months = toAmount(accountMonths)
    const extra = toAmount(extraMonthly)
    const level =
      contributionLevelOptions.find((item) => item.id === contributionLevel) || contributionLevelOptions[1]

    if (current <= 0 || current > 90) {
      Taro.showToast({ title: '请填写当前年龄', icon: 'none' })
      return
    }
    if (retire <= 0 || retire > 90) {
      Taro.showToast({ title: '请选择退休年龄', icon: 'none' })
      return
    }
    if (current > retire) {
      Taro.showToast({ title: '当前年龄不能超过退休年龄', icon: 'none' })
      return
    }
    if (paid < 0 || paid > 80) {
      Taro.showToast({ title: '请填写已缴年限', icon: 'none' })
      return
    }
    if (balance < 0) {
      Taro.showToast({ title: '账户余额不能为负', icon: 'none' })
      return
    }
    if (payBase < 0) {
      Taro.showToast({ title: '缴费基数不能为负', icon: 'none' })
      return
    }
    if (base <= 0) {
      Taro.showToast({ title: '请填写估算基准', icon: 'none' })
      return
    }
    if (months <= 0 || months > 300) {
      Taro.showToast({ title: '计发月数需大于 0', icon: 'none' })
      return
    }

    const futureYears = retire - current
    const totalYears = paid + futureYears
    if (totalYears <= 0) {
      Taro.showToast({ title: '缴费年限不能为 0', icon: 'none' })
      return
    }

    const calculation = calculatePension({
      currentAge: current,
      retireAge: retire,
      paidYears: paid,
      accountBalance: balance,
      monthlyPayBase: payBase,
      estimateBase: base,
      contributionIndex: level.index,
      accountMonths: months,
      extraMonthly: extra,
    })
    const estimatedIndex = calculation.index
    const futureAccountBalance = calculation.futureAccount
    const basePension = calculation.basePension
    const accountPension = calculation.accountPension
    const monthlyTotal = calculation.monthlyTotal

    setHasResult(true)
    setResult({
      monthlyTotal: formatMoney(monthlyTotal),
      basePension: formatMoney(basePension),
      accountPension: formatMoney(accountPension),
      yearlyTotal: formatMoney(monthlyTotal * 12),
      totalYears: formatYear(totalYears),
      futureYears: formatYear(futureYears),
      futureAccount: formatMoney(futureAccountBalance),
      accountMonths: `${months.toFixed(0)} 个月`,
      summary: `按估算基准 ${formatMoney(base)}、缴费指数 ${formatRate(estimatedIndex)}、退休前继续缴 ${formatYear(futureYears)} 粗略估算。`,
    })
  }

  const onReset = () => {
    setCurrentAge('')
    setPayYears('')
    setAccountBalance('')
    setMonthlyPayBase('')
    setContributionLevel('average')
    setRetireAge('60')
    setAccountMonths('139')
    setEstimateBase('8000')
    setExtraMonthly('')
    setShowAdvanced(false)
    clearResult()
  }

  return (
    <View className='shell'>
      <NavigationBar title='养老金估算' background='var(--s-1-weak, #f5f7fa)' />
      <ScrollView className='page-scroll' scrollY enhanced showScrollbar={false}>
        <View className='page'>
          <ToolIntroCard
            title='粗略估算每月养老金'
            description='根据年龄、缴费年限和缴费基数估算，实际金额以当地政策为准。'
          />

          <View className='card'>
            <Text className='card__title'>普通估算</Text>
            <View className='field-list'>
              <View className='field-row'>
                <View className='field-main'>
                  <Text className='field-label'>当前年龄</Text>
                  <Input
                    className='field-input'
                    type='number'
                    value={currentAge}
                    placeholder='例如 35'
                    placeholderClass='input-placeholder'
                    onInput={(e) => {
                      setCurrentAge(e.detail.value)
                      clearResult()
                    }}
                  />
                </View>
                <Text className='field-unit'>岁</Text>
              </View>
              <View className='field-row'>
                <View className='field-main'>
                  <Text className='field-label'>已缴养老保险年限</Text>
                  <Input
                    className='field-input'
                    type='digit'
                    value={payYears}
                    placeholder='例如 5、15、25'
                    placeholderClass='input-placeholder'
                    onInput={(e) => {
                      setPayYears(e.detail.value)
                      clearResult()
                    }}
                  />
                </View>
                <Text className='field-unit'>年</Text>
              </View>
              <View className='field-row'>
                <View className='field-main'>
                  <Text className='field-label'>个人养老账户余额</Text>
                  <Input
                    className='field-input'
                    type='digit'
                    value={accountBalance}
                    placeholder='社保查询里的养老账户余额'
                    placeholderClass='input-placeholder'
                    onInput={(e) => {
                      setAccountBalance(e.detail.value)
                      clearResult()
                    }}
                  />
                </View>
                <Text className='field-unit'>元</Text>
              </View>
              <View className='field-row'>
                <View className='field-main'>
                  <Text className='field-label'>养老按多少工资交</Text>
                  <Input
                    className='field-input'
                    type='digit'
                    value={monthlyPayBase}
                    placeholder='例如 10000，不知道可不填'
                    placeholderClass='input-placeholder'
                    onInput={(e) => {
                      setMonthlyPayBase(e.detail.value)
                      clearResult()
                    }}
                  />
                  <Text className='helper-note'>工资条里养老个人扣款 ÷ 8% 可粗略反推；不填时按下面的缴费水平估算。</Text>
                </View>
                <Text className='field-unit'>元/月</Text>
              </View>
            </View>

            <Text className='card__title' style={{ marginTop: '16px' }}>
              预计退休年龄
            </Text>
            <View className='field-row'>
              <View className='field-main'>
                <Input
                  className='field-input'
                  type='digit'
                  value={retireAge}
                  placeholder='可手动填写'
                  placeholderClass='input-placeholder'
                  onInput={(e) => {
                    setRetireAge(e.detail.value)
                    const nextAge = Number(e.detail.value)
                    if (nextAge >= 40 && nextAge <= 70) {
                      setAccountMonths(String(getAccountMonthsByAge(nextAge)))
                    }
                    clearResult()
                  }}
                />
                <View className='chip-row'>
                  {retireAgeOptions.map((item) => (
                    <View
                      key={item.age}
                      className={`chip ${retireAge === item.age ? 'is-active' : ''}`}
                      onClick={() => {
                        setRetireAge(item.age)
                        setAccountMonths(String(item.months))
                        clearResult()
                      }}
                    >
                      {item.age} 岁
                    </View>
                  ))}
                </View>
              </View>
              <Text className='field-unit'>岁</Text>
            </View>

            <Text className='card__title' style={{ marginTop: '16px' }}>
              未来缴费水平
            </Text>
            <View className='level-row'>
              {contributionLevelOptions.map((item) => (
                <View
                  key={item.id}
                  className={`level-item ${contributionLevel === item.id ? 'is-active' : ''}`}
                  onClick={() => {
                    setContributionLevel(item.id)
                    clearResult()
                  }}
                >
                  <Text className='level-label'>{item.label}</Text>
                  <Text className='level-desc'>{item.desc}</Text>
                </View>
              ))}
            </View>

            <View className='advanced-toggle' onClick={() => setShowAdvanced(!showAdvanced)}>
              高级设置 · {showAdvanced ? '收起' : '展开'}
            </View>

            {showAdvanced ? (
              <View className='field-list' style={{ marginTop: '12px' }}>
                <View className='field-row'>
                  <View className='field-main'>
                    <Text className='field-label'>估算基准</Text>
                    <Input
                      className='field-input'
                      type='digit'
                      value={estimateBase}
                      placeholder='默认 8000'
                      placeholderClass='input-placeholder'
                      onInput={(e) => {
                        setEstimateBase(e.detail.value)
                        clearResult()
                      }}
                    />
                    <View className='chip-row'>
                      {baseQuickOptions.map((item) => (
                        <View
                          key={item}
                          className={`chip ${estimateBase === item ? 'is-active' : ''}`}
                          onClick={() => {
                            setEstimateBase(item)
                            clearResult()
                          }}
                        >
                          {item}
                        </View>
                      ))}
                    </View>
                  </View>
                  <Text className='field-unit'>元/月</Text>
                </View>
                <View className='field-row'>
                  <View className='field-main'>
                    <Text className='field-label'>个人账户计发月数</Text>
                    <Input
                      className='field-input'
                      type='number'
                      value={accountMonths}
                      onInput={(e) => {
                        setAccountMonths(e.detail.value)
                        clearResult()
                      }}
                    />
                  </View>
                  <Text className='field-unit'>月</Text>
                </View>
                <View className='field-row'>
                  <View className='field-main'>
                    <Text className='field-label'>其他月待遇</Text>
                    <Input
                      className='field-input'
                      type='digit'
                      value={extraMonthly}
                      placeholder='没有可不填'
                      placeholderClass='input-placeholder'
                      onInput={(e) => {
                        setExtraMonthly(e.detail.value)
                        clearResult()
                      }}
                    />
                  </View>
                  <Text className='field-unit'>元/月</Text>
                </View>
              </View>
            ) : null}

            <Text className='helper-note'>
              普通估算会用“估算基准 8000 元/月”替代未来当地计发基数；如果你查到了当地口径，可以在高级设置里改得更接近。
            </Text>
            <View className='button-row'>
              <View className='calc-btn' onClick={onCalculate}>
                开始估算
              </View>
            </View>
          </View>

          <View className='result-card'>
            <View className='result-head'>
              <View>
                <Text className='result-label'>预计每月养老金</Text>
                <Text className='result-value result-value-sm'>{result.monthlyTotal}</Text>
              </View>
              <Text className='result-badge'>{hasResult ? result.accountMonths : '待计算'}</Text>
            </View>
            <View className='summary-grid'>
              <View className='summary-item'>
                <Text className='summary-label'>基础养老金</Text>
                <Text className='summary-value'>{result.basePension}</Text>
              </View>
              <View className='summary-item'>
                <Text className='summary-label'>个人账户养老金</Text>
                <Text className='summary-value'>{result.accountPension}</Text>
              </View>
              <View className='summary-item'>
                <Text className='summary-label'>退休时缴费年限</Text>
                <Text className='summary-value'>{result.totalYears}</Text>
              </View>
              <View className='summary-item'>
                <Text className='summary-label'>退休时账户余额</Text>
                <Text className='summary-value'>{result.futureAccount}</Text>
              </View>
              <View className='summary-item'>
                <Text className='summary-label'>距退休继续缴</Text>
                <Text className='summary-value'>{result.futureYears}</Text>
              </View>
              <View className='summary-item'>
                <Text className='summary-label'>预计全年</Text>
                <Text className='summary-value'>{result.yearlyTotal}</Text>
              </View>
            </View>
            {hasResult ? (
              <View className='detail-card'>
                <Text className='detail-desc'>{result.summary}</Text>
                <Text className='detail-tip'>这是按当前输入做的粗略估算，不等同于社保部门最终核定金额。</Text>
                <Text className='reset-link' onClick={onReset}>
                  重新填写
                </Text>
              </View>
            ) : (
              <Text className='result-empty'>填好年龄、已缴年限和个人账户余额后，这里会显示预估退休月待遇。</Text>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  )
}
