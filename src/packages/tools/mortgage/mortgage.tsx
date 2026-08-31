import { useMemo, useState } from 'react'
import { Input, ScrollView, Text, View } from '@tarojs/components'
import Taro, { useShareAppMessage, useShareTimeline } from '@tarojs/taro'

import NavigationBar from '@/components/NavigationBar'
import ToolIntroCard from '@/packages/tools/components/ToolIntroCard'
import { calculateMortgage } from './mortgage.logic'

import './mortgage.scss'

const loanTypes = [
  { label: '商业贷', value: 'commercial' },
  { label: '公积金', value: 'fund' },
  { label: '组合贷', value: 'combined' },
]

const repayTypes = [
  { label: '等额本息', value: 'interest' },
  { label: '等额本金', value: 'principal' },
]

const quickYears = ['10', '20', '30']
const downPaymentOptions = ['20', '30', '40', '50']

type ScheduleItem = { period: number; payment: string; principal: string; interest: string }
type RawScheduleItem = { period: number; payment: number; principal: number; interest: number }

const emptyResult = {
  firstMonth: '--',
  totalInterest: '--',
  totalRepayment: '--',
  monthlyDecrease: '',
  months: 0,
}

function formatMoney(value: number) {
  if (value >= 10000) return `${(value / 10000).toFixed(2)} 万`
  return `${value.toFixed(2)} 元`
}

function trimNumber(value: number) {
  return Number(value.toFixed(2)).toString()
}

function buildFlatSchedule(monthlyPayment: number, principal: number, months: number) {
  const principalPerMonth = principal / months
  return Array.from({ length: months }, (_, index) => ({
    period: index + 1,
    payment: monthlyPayment,
    principal: principalPerMonth,
    interest: 0,
  }))
}

function calculateEqualInterest(principal: number, monthlyRate: number, months: number) {
  if (monthlyRate === 0) {
    const monthlyPayment = principal / months
    return {
      firstMonth: monthlyPayment,
      totalInterest: 0,
      totalRepayment: principal,
      monthlyDecrease: 0,
      schedule: buildFlatSchedule(monthlyPayment, principal, months),
    }
  }

  const pow = Math.pow(1 + monthlyRate, months)
  const monthlyPayment = (principal * monthlyRate * pow) / (pow - 1)
  const totalRepayment = monthlyPayment * months
  const totalInterest = totalRepayment - principal
  const schedule: RawScheduleItem[] = []
  let remaining = principal

  for (let index = 1; index <= months; index += 1) {
    const interest = remaining * monthlyRate
    const principalPaid = monthlyPayment - interest
    remaining -= principalPaid
    schedule.push({
      period: index,
      payment: monthlyPayment,
      principal: principalPaid,
      interest,
    })
  }

  return { firstMonth: monthlyPayment, totalInterest, totalRepayment, monthlyDecrease: 0, schedule }
}

function calculateEqualPrincipal(principal: number, monthlyRate: number, months: number) {
  const principalPerMonth = principal / months
  const firstMonth = principalPerMonth + principal * monthlyRate
  const monthlyDecrease = principalPerMonth * monthlyRate
  const totalInterest = (principal * monthlyRate * (months + 1)) / 2
  const schedule: RawScheduleItem[] = []

  for (let index = 1; index <= months; index += 1) {
    const remaining = principal - principalPerMonth * (index - 1)
    const interest = remaining * monthlyRate
    schedule.push({
      period: index,
      payment: principalPerMonth + interest,
      principal: principalPerMonth,
      interest,
    })
  }

  return {
    firstMonth,
    totalInterest,
    totalRepayment: principal + totalInterest,
    monthlyDecrease,
    schedule,
  }
}

function calculateLoan(principal: number, annualRate: number, months: number, repayType: string) {
  const result = calculateMortgage(principal, annualRate, months, repayType === 'principal' ? 'equal-principal' : 'equal-interest')
  return {
    firstMonth: result.firstPayment,
    totalInterest: result.totalInterest,
    totalRepayment: result.totalPayment,
    monthlyDecrease: result.schedule.length > 1 ? result.schedule[0].payment - result.schedule[1].payment : 0,
    schedule: result.schedule.map((item) => ({ period: item.month, payment: item.payment, principal: item.principal, interest: item.interest })),
  }
}

export default function MortgagePage() {
  const [loanType, setLoanType] = useState('commercial')
  const [repayType, setRepayType] = useState('interest')
  const [houseTotalPrice, setHouseTotalPrice] = useState('')
  const [downPaymentRate, setDownPaymentRate] = useState('30')
  const [helperDownPaymentAmount, setHelperDownPaymentAmount] = useState('')
  const [helperLoanAmount, setHelperLoanAmount] = useState('')
  const [commercialAmount, setCommercialAmount] = useState('')
  const [fundAmount, setFundAmount] = useState('')
  const [years, setYears] = useState('')
  const [commercialRate, setCommercialRate] = useState('3.2')
  const [fundRate, setFundRate] = useState('2.6')
  const [hasResult, setHasResult] = useState(false)
  const [result, setResult] = useState(emptyResult)
  const [schedule, setSchedule] = useState<ScheduleItem[]>([])

  useShareAppMessage(() => ({
    title: '房贷月供怎么算？等额本息和等额本金对比一下',
    path: '/packages/tools/mortgage/mortgage',
  }))

  useShareTimeline(() => ({
    title: '房贷计算器：快速估算月供和总利息',
  }))

  const clearResult = () => {
    setHasResult(false)
    setResult(emptyResult)
    setSchedule([])
  }

  const syncHelperLoanAmount = (loanAmount: string, nextLoanType = loanType) => {
    if (!loanAmount) return
    if (nextLoanType === 'fund') setFundAmount(loanAmount)
    else setCommercialAmount(loanAmount)
  }

  const updateHelperLoanAmount = (totalPriceStr: string, rateStr: string, nextLoanType = loanType) => {
    const totalPrice = Number(totalPriceStr)
    const rate = Number(rateStr)
    if (!totalPrice || totalPrice <= 0 || rate < 0 || rate >= 100) {
      setHelperDownPaymentAmount('')
      setHelperLoanAmount('')
      return
    }
    const downPaymentAmount = (totalPrice * rate) / 100
    const loanAmount = (totalPrice * (100 - rate)) / 100
    const helperDown = trimNumber(downPaymentAmount)
    const helperLoan = trimNumber(loanAmount)
    setHelperDownPaymentAmount(helperDown)
    setHelperLoanAmount(helperLoan)
    syncHelperLoanAmount(helperLoan, nextLoanType)
  }

  const updateHouseTotalFromLoan = (
    nextCommercial: string,
    nextFund: string,
    field: 'commercialAmount' | 'fundAmount',
    rateStr: string,
    nextLoanType = loanType
  ) => {
    const rate = Number(rateStr)
    if (rate < 0 || rate >= 100) return
    const commercial = Number(nextCommercial || 0)
    const fund = Number(nextFund || 0)
    const loanAmount =
      nextLoanType === 'combined' ? commercial + fund : Number((field === 'commercialAmount' ? nextCommercial : nextFund) || 0)
    if (!loanAmount || loanAmount <= 0) return
    const totalPrice = loanAmount / ((100 - rate) / 100)
    setHouseTotalPrice(trimNumber(totalPrice))
    setHelperDownPaymentAmount(trimNumber((totalPrice * rate) / 100))
    setHelperLoanAmount(trimNumber(loanAmount))
  }

  const onCalculate = () => {
    const commercial = Number(commercialAmount || 0) * 10000
    const fund = Number(fundAmount || 0) * 10000
    const yearNum = Number(years)
    const cRate = Number(commercialRate)
    const fRate = Number(fundRate)
    const months = yearNum * 12
    const totalPrincipal = commercial + fund

    if (!totalPrincipal) {
      Taro.showToast({ title: '请填写贷款金额', icon: 'none' })
      return
    }
    if (!yearNum || yearNum < 1 || yearNum > 40) {
      Taro.showToast({ title: '贷款年限需为 1-40 年', icon: 'none' })
      return
    }
    if (commercial > 0 && (cRate < 0 || Number.isNaN(cRate))) {
      Taro.showToast({ title: '请填写商业贷利率', icon: 'none' })
      return
    }
    if (fund > 0 && (fRate < 0 || Number.isNaN(fRate))) {
      Taro.showToast({ title: '请填写公积金利率', icon: 'none' })
      return
    }

    const loans = [
      { amount: commercial, annualRate: cRate },
      { amount: fund, annualRate: fRate },
    ].filter((item) => item.amount > 0)

    const parts = loans.map((item) => calculateLoan(item.amount, item.annualRate, months, repayType))
    const summary = parts.reduce(
      (acc, item) => ({
        firstMonth: acc.firstMonth + item.firstMonth,
        totalInterest: acc.totalInterest + item.totalInterest,
        totalRepayment: acc.totalRepayment + item.totalRepayment,
        monthlyDecrease: acc.monthlyDecrease + item.monthlyDecrease,
      }),
      { firstMonth: 0, totalInterest: 0, totalRepayment: 0, monthlyDecrease: 0 }
    )

    const mergedSchedule = Array.from({ length: months }, (_, index) =>
      parts.reduce(
        (acc, item) => ({
          period: index + 1,
          payment: acc.payment + (item.schedule[index]?.payment || 0),
          principal: acc.principal + (item.schedule[index]?.principal || 0),
          interest: acc.interest + (item.schedule[index]?.interest || 0),
        }),
        { period: index + 1, payment: 0, principal: 0, interest: 0 }
      )
    )

    setHasResult(true)
    setResult({
      firstMonth: formatMoney(summary.firstMonth),
      totalInterest: formatMoney(summary.totalInterest),
      totalRepayment: formatMoney(summary.totalRepayment),
      monthlyDecrease: summary.monthlyDecrease > 0 ? formatMoney(summary.monthlyDecrease) : '',
      months,
    })
    setSchedule(
      mergedSchedule.map((item) => ({
        period: item.period,
        payment: formatMoney(item.payment),
        principal: formatMoney(item.principal),
        interest: formatMoney(item.interest),
      }))
    )
  }

  const visibleSchedule = useMemo(() => schedule, [schedule])

  return (
    <View className='shell'>
      <NavigationBar title='房贷计算器' background='var(--s-1-weak, #f5f7fa)' />
      <ScrollView className='page-scroll' scrollY enhanced showScrollbar={false}>
        <View className='page'>
          <ToolIntroCard
            title='估算月供和总利息'
            description='支持商业贷、公积金贷和组合贷，可比较等额本息与等额本金。'
          />

          <View className='card'>
            <Text className='card__title'>贷款方案</Text>
            <View className='segment-row'>
              {loanTypes.map((item) => (
                <View
                  key={item.value}
                  className={`segment-item ${loanType === item.value ? 'is-active' : ''}`}
                  onClick={() => {
                    setLoanType(item.value)
                    if (item.value === 'commercial') setFundAmount('')
                    if (item.value === 'fund') setCommercialAmount('')
                    if (helperLoanAmount) syncHelperLoanAmount(helperLoanAmount, item.value)
                    clearResult()
                  }}
                >
                  {item.label}
                </View>
              ))}
            </View>
            <View className='segment-row'>
              {repayTypes.map((item) => (
                <View
                  key={item.value}
                  className={`segment-item ${repayType === item.value ? 'is-active' : ''}`}
                  onClick={() => {
                    setRepayType(item.value)
                    clearResult()
                  }}
                >
                  {item.label}
                </View>
              ))}
            </View>

            <View className='field-list'>
              <View className='field-row'>
                <View className='field-main'>
                  <Text className='field-label'>房屋总价</Text>
                  <Input
                    className='field-input'
                    type='digit'
                    value={houseTotalPrice}
                    placeholder='可选，用于辅助计算贷款'
                    placeholderClass='input-placeholder'
                    onInput={(e) => {
                      setHouseTotalPrice(e.detail.value)
                      updateHelperLoanAmount(e.detail.value, downPaymentRate)
                      clearResult()
                    }}
                  />
                </View>
                <Text className='field-unit'>万元</Text>
              </View>

              <View className='field-row'>
                <View className='field-main'>
                  <View className='field-label-row'>
                    <Text className='field-label'>首付比例</Text>
                    {helperDownPaymentAmount ? (
                      <Text className='down-payment-inline'>首付 {helperDownPaymentAmount} 万</Text>
                    ) : null}
                  </View>
                  <View className='down-input-row'>
                    <Input
                      className='field-input'
                      type='digit'
                      value={downPaymentRate}
                      placeholder='可手动填写'
                      placeholderClass='input-placeholder'
                      onInput={(e) => {
                        setDownPaymentRate(e.detail.value)
                        updateHelperLoanAmount(houseTotalPrice, e.detail.value)
                        clearResult()
                      }}
                    />
                    <View className='quick-down-row'>
                      {downPaymentOptions.map((item) => (
                        <View
                          key={item}
                          className={`chip ${downPaymentRate === item ? 'is-active' : ''}`}
                          onClick={() => {
                            setDownPaymentRate(item)
                            updateHelperLoanAmount(houseTotalPrice, item)
                            clearResult()
                          }}
                        >
                          {item}%
                        </View>
                      ))}
                    </View>
                  </View>
                </View>
                <Text className='field-unit'>%</Text>
              </View>

              {loanType !== 'fund' ? (
                <View className='field-row'>
                  <View className='field-main'>
                    <Text className='field-label'>商业贷款金额</Text>
                    <Input
                      className='field-input'
                      type='digit'
                      value={commercialAmount}
                      placeholder='请输入商业贷款金额'
                      placeholderClass='input-placeholder'
                      onInput={(e) => {
                        setCommercialAmount(e.detail.value)
                        updateHouseTotalFromLoan(e.detail.value, fundAmount, 'commercialAmount', downPaymentRate)
                        clearResult()
                      }}
                    />
                  </View>
                  <Text className='field-unit'>万元</Text>
                </View>
              ) : null}

              {loanType !== 'commercial' ? (
                <View className='field-row'>
                  <View className='field-main'>
                    <Text className='field-label'>公积金贷款金额</Text>
                    <Input
                      className='field-input'
                      type='digit'
                      value={fundAmount}
                      placeholder='请输入公积金贷款金额'
                      placeholderClass='input-placeholder'
                      onInput={(e) => {
                        setFundAmount(e.detail.value)
                        updateHouseTotalFromLoan(commercialAmount, e.detail.value, 'fundAmount', downPaymentRate)
                        clearResult()
                      }}
                    />
                  </View>
                  <Text className='field-unit'>万元</Text>
                </View>
              ) : null}

              <View className='field-row'>
                <View className='field-main'>
                  <Text className='field-label'>贷款年限</Text>
                  <View className='year-input-row'>
                    <Input
                      className='field-input'
                      type='number'
                      value={years}
                      placeholder='请输入贷款年限'
                      placeholderClass='input-placeholder'
                      onInput={(e) => {
                        setYears(e.detail.value)
                        clearResult()
                      }}
                    />
                    <View className='quick-year-row'>
                      {quickYears.map((item) => (
                        <View
                          key={item}
                          className={`chip ${years === item ? 'is-active' : ''}`}
                          onClick={() => {
                            setYears(item)
                            clearResult()
                          }}
                        >
                          {item} 年
                        </View>
                      ))}
                    </View>
                  </View>
                </View>
                <Text className='field-unit'>年</Text>
              </View>

              {loanType !== 'fund' ? (
                <View className='field-row'>
                  <View className='field-main'>
                    <Text className='field-label'>商业贷年利率</Text>
                    <Input
                      className='field-input'
                      type='digit'
                      value={commercialRate}
                      placeholder='请输入商业贷利率'
                      placeholderClass='input-placeholder'
                      onInput={(e) => {
                        setCommercialRate(e.detail.value)
                        clearResult()
                      }}
                    />
                  </View>
                  <Text className='field-unit'>%</Text>
                </View>
              ) : null}

              {loanType !== 'commercial' ? (
                <View className='field-row'>
                  <View className='field-main'>
                    <Text className='field-label'>公积金年利率</Text>
                    <Input
                      className='field-input'
                      type='digit'
                      value={fundRate}
                      placeholder='请输入公积金利率'
                      placeholderClass='input-placeholder'
                      onInput={(e) => {
                        setFundRate(e.detail.value)
                        clearResult()
                      }}
                    />
                  </View>
                  <Text className='field-unit'>%</Text>
                </View>
              ) : null}
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
                <Text className='result-label'>{repayType === 'principal' ? '首月月供' : '每月月供'}</Text>
                <Text className='result-value result-value-sm'>{result.firstMonth}</Text>
              </View>
              <Text className='result-badge'>{hasResult ? `${result.months} 期` : '待计算'}</Text>
            </View>

            <View className='summary-grid'>
              <View className='summary-item'>
                <Text className='summary-label'>总利息</Text>
                <Text className='summary-value'>{result.totalInterest}</Text>
              </View>
              <View className='summary-item'>
                <Text className='summary-label'>还款总额</Text>
                <Text className='summary-value'>{result.totalRepayment}</Text>
              </View>
            </View>

            {hasResult && result.monthlyDecrease ? (
              <Text className='decrease-tip'>每月约递减 {result.monthlyDecrease}</Text>
            ) : null}

            {hasResult ? (
              <View className='schedule-card'>
                <Text className='schedule-title'>全部还款明细（{result.months} 期）</Text>
                {visibleSchedule.map((item) => (
                  <View key={item.period} className='schedule-row'>
                    <Text className='schedule-period'>第 {item.period} 期</Text>
                    <View>
                      <Text className='schedule-money'>{item.payment}</Text>
                      <Text className='schedule-sub'>
                        本金 {item.principal} / 利息 {item.interest}
                      </Text>
                    </View>
                  </View>
                ))}
                <Text className='reset-link' onClick={clearResult}>
                  重新计算
                </Text>
              </View>
            ) : (
              <Text className='result-empty'>填好金额、年限和利率后，这里会显示月供与总利息。</Text>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  )
}
