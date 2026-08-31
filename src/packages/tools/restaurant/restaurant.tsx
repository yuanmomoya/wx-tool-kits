import { useState } from 'react'
import { Input, ScrollView, Text, View } from '@tarojs/components'
import Taro, { useShareAppMessage, useShareTimeline } from '@tarojs/taro'

import NavigationBar from '@/components/NavigationBar'
import ToolIntroCard from '@/packages/tools/components/ToolIntroCard'

import './restaurant.scss'

const modules = [
  { label: '建店成本', value: 'cost' },
  { label: '盈亏平衡', value: 'breakEven' },
  { label: '经营分析', value: 'analysis' },
]

type ResultState = {
  primaryLabel: string
  primaryValue: string
  badge: string
  notice: string
  rows: { label: string; value: string }[]
  tip: string
}

function getEmptyResult(module: string): ResultState {
  if (module === 'breakEven') {
    return {
      primaryLabel: '保本营业额',
      primaryValue: '--',
      badge: '待计算',
      notice: '',
      rows: [],
      tip: '填好数据后，这里会显示保本营业额、亏损线和综合毛利率。',
    }
  }
  if (module === 'analysis') {
    return {
      primaryLabel: '月净利润',
      primaryValue: '--',
      badge: '待计算',
      notice: '',
      rows: [],
      tip: '填好数据后，这里会显示经营健康度。',
    }
  }
  return {
    primaryLabel: '预计投入',
    primaryValue: '--',
    badge: '待计算',
    notice: '',
    rows: [],
    tip: '填好数据后，这里会显示关键指标。',
  }
}

function formatMoney(value: number) {
  if (Math.abs(value) >= 10000) return `${(value / 10000).toFixed(2)} 万`
  return `${value.toFixed(0)} 元`
}

function formatWan(value: number) {
  return `${value.toFixed(2)} 万`
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) return '--'
  return `${value.toFixed(1).replace(/\.0$/, '')}%`
}

export default function RestaurantPage() {
  const [activeModule, setActiveModule] = useState('cost')
  const [monthlyRent, setMonthlyRent] = useState('')
  const [rentPayMonths, setRentPayMonths] = useState('')
  const [rentDeposit, setRentDeposit] = useState('')
  const [transferFee, setTransferFee] = useState('')
  const [franchiseFee, setFranchiseFee] = useState('')
  const [decorationAdCost, setDecorationAdCost] = useState('')
  const [equipmentCost, setEquipmentCost] = useState('')
  const [openingStock, setOpeningStock] = useState('')
  const [offlineGrossMarginRate, setOfflineGrossMarginRate] = useState('')
  const [deliveryGrossMarginRate, setDeliveryGrossMarginRate] = useState('')
  const [offlineSalesRate, setOfflineSalesRate] = useState('60')
  const [deliverySalesRate, setDeliverySalesRate] = useState('40')
  const [fixedRent, setFixedRent] = useState('')
  const [fixedLabor, setFixedLabor] = useState('')
  const [fixedUtilities, setFixedUtilities] = useState('')
  const [fixedOther, setFixedOther] = useState('')
  const [monthlyRevenue, setMonthlyRevenue] = useState('')
  const [foodCost, setFoodCost] = useState('')
  const [laborCost, setLaborCost] = useState('')
  const [rentCost, setRentCost] = useState('')
  const [platformCost, setPlatformCost] = useState('')
  const [utilityCost, setUtilityCost] = useState('')
  const [otherCost, setOtherCost] = useState('')
  const [hasResult, setHasResult] = useState(false)
  const [result, setResult] = useState(getEmptyResult('cost'))

  useShareAppMessage(() => ({
    title: '想开餐饮店？先算算启动成本和保本营业额',
    path: '/packages/tools/restaurant/restaurant',
  }))

  useShareTimeline(() => ({
    title: '餐饮投资计算器：开店成本、保本线和经营分析',
  }))

  const getNumber = (value: string) => Number(value || 0)

  const getComplementRate = (value: string) => {
    if (value === '') return ''
    const rate = Number(value)
    if (Number.isNaN(rate)) return ''
    return String(Math.max(0, 100 - rate))
  }

  const getHealthLabel = (profitRate: number) => {
    if (profitRate >= 15) return '经营健康'
    if (profitRate >= 5) return '有利润'
    if (profitRate >= 0) return '微利'
    return '亏损'
  }

  const getAnalysisTip = (profitRate: number, foodRate: number, laborRate: number, rentRate: number) => {
    if (profitRate < 0) return '当前为亏损状态，优先检查食材、人工、房租和平台费用是否过高。'
    if (foodRate > 38) return '食材成本率偏高，可以检查菜单定价、损耗和采购价格。'
    if (laborRate > 25) return '人工占比偏高，可以检查排班效率和高峰时段配置。'
    if (rentRate > 15) return '房租占比偏高，需要更谨慎评估客流和翻台效率。'
    return '成本结构相对稳，建议继续观察客流、复购和单品毛利。'
  }

  const calculateCost = () => {
    const rentStartupCost = getNumber(monthlyRent) * getNumber(rentPayMonths) + getNumber(rentDeposit)
    const items: [string, number][] = [
      ['房租启动', rentStartupCost],
      ['转让费用', getNumber(transferFee)],
      ['加盟学习', getNumber(franchiseFee)],
      ['装修广告', getNumber(decorationAdCost)],
      ['设备费用', getNumber(equipmentCost)],
      ['首批物料', getNumber(openingStock)],
    ]
    const total = items.reduce((sum, item) => sum + item[1], 0)
    if (!total) {
      Taro.showToast({ title: '请填写至少一项建店成本', icon: 'none' })
      return
    }
    const rentRate = total ? formatPercent((rentStartupCost / total) * 100) : '--'
    const entryCost = getNumber(transferFee) + getNumber(franchiseFee)
    const buildCost = getNumber(decorationAdCost) + getNumber(equipmentCost)
    setHasResult(true)
    setResult({
      primaryLabel: '建店总成本',
      primaryValue: formatWan(total),
      badge: rentRate === '--' ? '已估算' : `房租 ${rentRate}`,
      notice: '',
      rows: [
        { label: '房租启动成本', value: formatWan(rentStartupCost) },
        { label: '转让/加盟小计', value: formatWan(entryCost) },
        { label: '装修设备小计', value: formatWan(buildCost) },
        { label: '首批物料', value: formatWan(getNumber(openingStock)) },
        { label: '建议安全预算', value: formatWan(total * 1.1) },
      ],
      tip: '建店成本已按“月租 × 几个月一付 + 押金 + 各项杂费”估算，建议额外预留 10%-15% 应对施工延期和试营业波动。',
    })
  }

  const calculateBreakEven = () => {
    const offlineGrossMargin = getNumber(offlineGrossMarginRate) / 100
    const deliveryGrossMargin = getNumber(deliveryGrossMarginRate) / 100
    const offlineRate = getNumber(offlineSalesRate)
    const deliveryRate = getNumber(deliverySalesRate)
    const salesRateTotal = offlineRate + deliveryRate
    const fixedCost =
      getNumber(fixedRent) + getNumber(fixedLabor) + getNumber(fixedUtilities) + getNumber(fixedOther)
    const blendedGrossMargin = offlineGrossMargin * (offlineRate / 100) + deliveryGrossMargin * (deliveryRate / 100)

    if (!fixedCost || blendedGrossMargin <= 0) {
      Taro.showToast({ title: '请填写毛利率、销售占比和固定成本', icon: 'none' })
      return
    }
    if (Math.abs(salesRateTotal - 100) > 0.001) {
      Taro.showToast({ title: '线下和外卖销售占比合计需为 100%', icon: 'none' })
      return
    }

    const breakEvenRevenue = fixedCost / blendedGrossMargin
    const safetyRevenue = breakEvenRevenue * 1.1
    const extraProfitPerWan = 10000 * blendedGrossMargin
    const offlineRevenue = (breakEvenRevenue * offlineRate) / 100
    const deliveryRevenue = (breakEvenRevenue * deliveryRate) / 100
    const blendedGrossMarginPercent = blendedGrossMargin * 100
    const marginText = formatPercent(blendedGrossMarginPercent)
    const notice =
      blendedGrossMarginPercent < 20
        ? `综合毛利率只有 ${marginText}，保本营业额会被放大；如果你想表达 50%，这里要填 50。`
        : ''

    setHasResult(true)
    setResult({
      primaryLabel: '保本营业额',
      primaryValue: formatMoney(breakEvenRevenue),
      badge: '保本线',
      notice,
      rows: [
        { label: '月固定成本', value: formatMoney(fixedCost) },
        { label: '综合毛利率', value: marginText },
        { label: '保本公式', value: `${formatMoney(fixedCost)} ÷ ${marginText}` },
        { label: '低于保本营业额', value: '通常亏损' },
        { label: '建议安全营业额', value: formatMoney(safetyRevenue) },
        { label: '线下需贡献', value: formatMoney(offlineRevenue) },
        { label: '外卖需贡献', value: formatMoney(deliveryRevenue) },
        {
          label: '月营业额超过保本线后，每多卖 1 万',
          value: `约多赚 ${formatMoney(extraProfitPerWan)}`,
        },
      ],
      tip: `保本营业额 = 月固定成本 ÷ 综合毛利率。按当前数据，月营业额做到 ${formatMoney(breakEvenRevenue)} 左右才是不赚不亏，超过保本线的部分会按 ${marginText} 贡献利润。`,
    })
  }

  const calculateAnalysis = () => {
    const revenue = getNumber(monthlyRevenue)
    const food = getNumber(foodCost)
    const labor = getNumber(laborCost)
    const rent = getNumber(rentCost)
    const platform = getNumber(platformCost)
    const utilities = getNumber(utilityCost)
    const other = getNumber(otherCost)
    const totalCost = food + labor + rent + platform + utilities + other
    const profit = revenue - totalCost

    if (!revenue) {
      Taro.showToast({ title: '请填写月营业额', icon: 'none' })
      return
    }

    const profitRate = (profit / revenue) * 100
    const foodRate = (food / revenue) * 100
    const laborRate = (labor / revenue) * 100
    const rentRate = (rent / revenue) * 100

    setHasResult(true)
    setResult({
      primaryLabel: '月净利润',
      primaryValue: formatMoney(profit),
      badge: getHealthLabel(profitRate),
      notice: '',
      rows: [
        { label: '净利率', value: formatPercent(profitRate) },
        { label: '食材成本率', value: formatPercent(foodRate) },
        { label: '人工成本率', value: formatPercent(laborRate) },
        { label: '房租占比', value: formatPercent(rentRate) },
      ],
      tip: getAnalysisTip(profitRate, foodRate, laborRate, rentRate),
    })
  }

  const onCalculate = () => {
    if (activeModule === 'cost') {
      calculateCost()
      return
    }
    if (activeModule === 'breakEven') {
      calculateBreakEven()
      return
    }
    calculateAnalysis()
  }

  const renderField = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    unit: string,
    placeholder: string,
    type: 'digit' | 'number' = 'digit'
  ) => (
    <View className='field-row'>
      <View className='field-main'>
        <Text className='field-label'>{label}</Text>
        <Input
          className='field-input'
          type={type}
          value={value}
          placeholder={placeholder}
          placeholderClass='input-placeholder'
          onInput={(e) => onChange(e.detail.value)}
        />
      </View>
      <Text className='field-unit'>{unit}</Text>
    </View>
  )

  return (
    <View className='shell'>
      <NavigationBar title='餐饮投资计算' background='var(--s-1-weak, #f5f7fa)' />
      <ScrollView className='page-scroll' scrollY enhanced showScrollbar={false}>
        <View className='page'>
          <ToolIntroCard
            title='先算清开店成本和保本线'
            description='可估算启动成本、保本营业额和经营收益，结果仅供测算参考。'
          />

          <View className='card'>
            <View className='module-tabs'>
              {modules.map((item) => (
                <View
                  key={item.value}
                  className={`module-tab ${activeModule === item.value ? 'is-active' : ''}`}
                  onClick={() => {
                    setActiveModule(item.value)
                    setHasResult(false)
                    setResult(getEmptyResult(item.value))
                  }}
                >
                  {item.label}
                </View>
              ))}
            </View>

            <View className='field-list'>
              {activeModule === 'cost' ? (
                <>
                  {renderField('每月房租', monthlyRent, setMonthlyRent, '万元', '请输入每月房租')}
                  {renderField('几个月一付', rentPayMonths, setRentPayMonths, '个月', '请输入付款月数', 'number')}
                  {renderField('押金', rentDeposit, setRentDeposit, '万元', '请输入押金')}
                  {renderField('转让费/中介费', transferFee, setTransferFee, '万元', '没有可不填')}
                  {renderField('加盟费/学习费', franchiseFee, setFranchiseFee, '万元', '没有可不填')}
                  {renderField('装修费/广告费', decorationAdCost, setDecorationAdCost, '万元', '请输入装修和广告费用')}
                  {renderField('设备费', equipmentCost, setEquipmentCost, '万元', '请输入设备费用')}
                  {renderField('首批物料', openingStock, setOpeningStock, '万元', '请输入首批物料费用')}
                </>
              ) : null}

              {activeModule === 'breakEven' ? (
                <>
                  {renderField('线下毛利率', offlineGrossMarginRate, setOfflineGrossMarginRate, '%', '请输入线下毛利率')}
                  {renderField('外卖毛利率', deliveryGrossMarginRate, setDeliveryGrossMarginRate, '%', '请输入外卖毛利率')}
                  {renderField(
                    '线下销售占比',
                    offlineSalesRate,
                    (v) => {
                      setOfflineSalesRate(v)
                      setDeliverySalesRate(getComplementRate(v))
                    },
                    '%',
                    '请输入线下销售占比'
                  )}
                  {renderField(
                    '外卖销售占比',
                    deliverySalesRate,
                    (v) => {
                      setDeliverySalesRate(v)
                      setOfflineSalesRate(getComplementRate(v))
                    },
                    '%',
                    '请输入外卖销售占比'
                  )}
                  {renderField('月租金', fixedRent, setFixedRent, '元', '请输入月租金')}
                  {renderField('月人工', fixedLabor, setFixedLabor, '元', '请输入月人工成本')}
                  {renderField('水电杂费', fixedUtilities, setFixedUtilities, '元', '请输入水电杂费')}
                  {renderField('其他固定成本', fixedOther, setFixedOther, '元', '没有可不填')}
                </>
              ) : null}

              {activeModule === 'analysis' ? (
                <>
                  {renderField('月营业额', monthlyRevenue, setMonthlyRevenue, '元', '请输入月营业额')}
                  {renderField('食材成本', foodCost, setFoodCost, '元', '请输入食材成本')}
                  {renderField('人工成本', laborCost, setLaborCost, '元', '请输入人工成本')}
                  {renderField('房租成本', rentCost, setRentCost, '元', '请输入房租成本')}
                  {renderField('平台费用', platformCost, setPlatformCost, '元', '外卖佣金等，没有可不填')}
                  {renderField('水电杂费', utilityCost, setUtilityCost, '元', '请输入水电杂费')}
                  {renderField('其他支出', otherCost, setOtherCost, '元', '没有可不填')}
                </>
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
                <Text className='result-label'>{result.primaryLabel}</Text>
                <Text className='result-value result-value-sm'>{result.primaryValue}</Text>
              </View>
              <Text className='result-badge'>{result.badge}</Text>
            </View>
            {hasResult && result.notice ? <Text className='result-notice'>{result.notice}</Text> : null}
            {hasResult
              ? result.rows.map((row) => (
                  <View key={row.label} className='detail-row'>
                    <Text className='detail-label'>{row.label}</Text>
                    <Text className='detail-value'>{row.value}</Text>
                  </View>
                ))
              : null}
            <Text className='result-tip'>{result.tip}</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  )
}
