import { useState } from 'react'
import { Input, ScrollView, Text, View } from '@tarojs/components'
import Taro, { useShareAppMessage, useShareTimeline } from '@tarojs/taro'

import NavigationBar from '@/components/NavigationBar'
import ToolIntroCard from '@/packages/tools/components/ToolIntroCard'
import { calculateMonthlyTax } from './salary.logic'

import './salary.scss'

const TAX_THRESHOLD = 5000

const taxBrackets = [
  { limit: 3000, rate: 0.03, deduction: 0 },
  { limit: 12000, rate: 0.1, deduction: 210 },
  { limit: 25000, rate: 0.2, deduction: 1410 },
  { limit: 35000, rate: 0.25, deduction: 2660 },
  { limit: 55000, rate: 0.3, deduction: 4410 },
  { limit: 80000, rate: 0.35, deduction: 7160 },
  { limit: Infinity, rate: 0.45, deduction: 15160 },
]

type SocialItem = { name: string; rate: string; amount: string; payer?: string }

const defaultSocialItems: SocialItem[] = [
  { name: '养老保险', rate: '8', amount: '--' },
  { name: '医疗保险', rate: '2', amount: '--' },
  { name: '失业保险', rate: '0.5', amount: '--' },
  { name: '工伤保险', rate: '0', amount: '--', payer: '单位缴纳' },
  { name: '生育保险', rate: '0', amount: '--', payer: '单位缴纳' },
]

const emptyResult = {
  takeHome: '--',
  tax: '--',
  contribution: '--',
  social: '--',
  fund: '--',
  taxable: '--',
  netRate: '待计算',
}

function formatMoney(value: number) {
  return `${value.toFixed(2)} 元`
}

function calculateTax(taxableIncome: number) {
  return calculateMonthlyTax(taxableIncome)
}

export default function SalaryPage() {
  const [grossSalary, setGrossSalary] = useState('')
  const [socialItems, setSocialItems] = useState(defaultSocialItems)
  const [socialTotalRate, setSocialTotalRate] = useState('10.5')
  const [fundRate, setFundRate] = useState('7')
  const [specialDeduction, setSpecialDeduction] = useState('')
  const [hasResult, setHasResult] = useState(false)
  const [result, setResult] = useState(emptyResult)
  const quickFundRates = ['5', '7', '12']

  useShareAppMessage(() => ({
    title: '税后工资到手多少？五险一金和个税一起算',
    path: '/packages/tools/salary/salary',
  }))

  useShareTimeline(() => ({
    title: '工资计算器：估算税后到手收入',
  }))

  const getSocialRateTotal = (items = socialItems) =>
    items.reduce((total, item) => total + Number(item.rate || 0), 0)

  const updateSocialPreview = (nextGross = grossSalary, items = socialItems) => {
    const gross = Number(nextGross || 0)
    const nextItems = items.map((item) => {
      const rate = Number(item.rate || 0)
      return {
        ...item,
        amount: gross > 0 ? formatMoney((gross * rate) / 100) : '--',
      }
    })
    const total = getSocialRateTotal(nextItems).toFixed(1).replace(/\.0$/, '')
    setSocialItems(nextItems)
    setSocialTotalRate(total)
  }

  const onCalculate = () => {
    const gross = Number(grossSalary)
    const socialRate = getSocialRateTotal()
    const fund = Number(fundRate || 0)
    const special = Number(specialDeduction || 0)

    if (!gross || gross <= 0) {
      Taro.showToast({ title: '请填写税前月薪', icon: 'none' })
      return
    }
    if (socialRate < 0 || fund < 0 || special < 0) {
      Taro.showToast({ title: '扣除项不能为负数', icon: 'none' })
      return
    }

    updateSocialPreview()
    const socialAmount = (gross * socialRate) / 100
    const fundAmount = (gross * fund) / 100
    const contribution = socialAmount + fundAmount
    const taxableIncome = Math.max(gross - contribution - special - TAX_THRESHOLD, 0)
    const tax = calculateTax(taxableIncome)
    const takeHome = Math.max(gross - contribution - tax, 0)
    const netRate = `${Math.round((takeHome / gross) * 100)}% 到手`

    setHasResult(true)
    setResult({
      takeHome: formatMoney(takeHome),
      tax: formatMoney(tax),
      contribution: formatMoney(contribution),
      social: formatMoney(socialAmount),
      fund: formatMoney(fundAmount),
      taxable: formatMoney(taxableIncome),
      netRate,
    })
  }

  return (
    <View className='shell'>
      <NavigationBar title='工资计算器' background='var(--s-1-weak, #f5f7fa)' />
      <ScrollView className='page-scroll' scrollY enhanced showScrollbar={false}>
        <View className='page'>
          <ToolIntroCard
            title='算算每月税后到手工资'
            description='根据税前工资、五险一金和专项附加扣除，估算个税与到手收入。'
          />

          <View className='card'>
            <Text className='card__title'>薪资信息</Text>
            <View className='field-list'>
              <View className='field-row'>
                <View className='field-main'>
                  <Text className='field-label'>税前月薪</Text>
                  <Input
                    className='field-input'
                    type='digit'
                    value={grossSalary}
                    placeholder='请输入税前月薪'
                    placeholderClass='input-placeholder'
                    onInput={(e) => {
                      setGrossSalary(e.detail.value)
                      updateSocialPreview(e.detail.value)
                    }}
                  />
                </View>
                <Text className='field-unit'>元</Text>
              </View>

              <View className='field-row'>
                <View className='field-main'>
                  <View className='field-label-row'>
                    <Text className='field-label'>五险个人扣除</Text>
                    <Text className='social-total'>合计 {socialTotalRate}%</Text>
                  </View>
                  <View className='social-list'>
                    {socialItems.map((item, index) => (
                      <View key={item.name} className='social-item'>
                        <View className='social-name-wrap'>
                          <Text className='social-name'>{item.name}</Text>
                          {item.payer ? <Text className='social-payer'>{item.payer}</Text> : null}
                        </View>
                        <View className='social-rate-box'>
                          <Input
                            className='social-rate-input'
                            type='digit'
                            value={item.rate}
                            onInput={(e) => {
                              const next = socialItems.map((row, i) =>
                                i === index ? { ...row, rate: e.detail.value } : row
                              )
                              updateSocialPreview(grossSalary, next)
                            }}
                          />
                          <Text className='social-rate-unit'>%</Text>
                        </View>
                        <Text className='social-amount'>{item.amount}</Text>
                      </View>
                    ))}
                  </View>
                  <Text className='social-note'>
                    标注“单位缴纳”的项目通常个人无需缴纳，如有特殊情况可自行调整比例。
                  </Text>
                </View>
              </View>

              <View className='field-row'>
                <View className='field-main'>
                  <Text className='field-label'>公积金个人比例</Text>
                  <View className='fund-input-row'>
                    <Input
                      className='field-input'
                      type='digit'
                      value={fundRate}
                      placeholder='请输入公积金比例'
                      placeholderClass='input-placeholder'
                      onInput={(e) => setFundRate(e.detail.value)}
                    />
                    <View className='quick-fund-row'>
                      {quickFundRates.map((item) => (
                        <View
                          key={item}
                          className={`chip ${fundRate === item ? 'is-active' : ''}`}
                          onClick={() => setFundRate(item)}
                        >
                          {item}%
                        </View>
                      ))}
                    </View>
                  </View>
                </View>
                <Text className='field-unit'>%</Text>
              </View>

              <View className='field-row'>
                <View className='field-main'>
                  <Text className='field-label'>专项附加扣除</Text>
                  <Input
                    className='field-input'
                    type='digit'
                    value={specialDeduction}
                    placeholder='没有可不填'
                    placeholderClass='input-placeholder'
                    onInput={(e) => setSpecialDeduction(e.detail.value)}
                  />
                </View>
                <Text className='field-unit'>元</Text>
              </View>
            </View>

            <View className='button-row'>
              <View className='calc-btn' onClick={onCalculate}>
                计算到手工资
              </View>
            </View>
          </View>

          <View className='result-card'>
            <View className='result-head'>
              <View>
                <Text className='result-label'>预计到手</Text>
                <Text className='result-value result-value-sm'>{result.takeHome}</Text>
              </View>
              <Text className='result-badge'>{hasResult ? result.netRate : '待计算'}</Text>
            </View>
            <View className='summary-grid'>
              <View className='summary-item'>
                <Text className='summary-label'>个人所得税</Text>
                <Text className='summary-value'>{result.tax}</Text>
              </View>
              <View className='summary-item'>
                <Text className='summary-label'>五险一金</Text>
                <Text className='summary-value'>{result.contribution}</Text>
              </View>
            </View>
            {hasResult ? (
              <View className='detail-card'>
                <View className='detail-row'>
                  <Text className='detail-label'>五险扣除</Text>
                  <Text className='detail-value'>{result.social}</Text>
                </View>
                <View className='detail-row'>
                  <Text className='detail-label'>公积金扣除</Text>
                  <Text className='detail-value'>{result.fund}</Text>
                </View>
                <View className='detail-row'>
                  <Text className='detail-label'>应纳税所得额</Text>
                  <Text className='detail-value'>{result.taxable}</Text>
                </View>
                <Text className='detail-tip'>按 5000 元起征点和月度速算扣除数估算。</Text>
                <Text
                  className='reset-link'
                  onClick={() => {
                    setHasResult(false)
                    setResult(emptyResult)
                  }}
                >
                  重新计算
                </Text>
              </View>
            ) : (
              <Text className='result-empty'>填好税前月薪后，这里会显示到手工资、个税和扣除明细。</Text>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  )
}
