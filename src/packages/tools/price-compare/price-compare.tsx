import { useState } from 'react'
import { Input, Picker, ScrollView, Text, View } from '@tarojs/components'
import Taro, { useShareAppMessage, useShareTimeline } from '@tarojs/taro'

import NavigationBar from '@/components/NavigationBar'
import ToolIntroCard from '@/packages/tools/components/ToolIntroCard'

import './price-compare.scss'

type Unit = { label: string; symbol: string; factor: number }

const compareModes: Record<
  string,
  {
    label: string
    unitTargetText: string
    displayAmount: number
    displayUnit: string
    baseUnit: string
    units: Unit[]
  }
> = {
  weight: {
    label: '重量',
    unitTargetText: '元 / 100g',
    displayAmount: 100,
    displayUnit: 'g',
    baseUnit: 'g',
    units: [
      { label: '克', symbol: 'g', factor: 1 },
      { label: '千克', symbol: 'kg', factor: 1000 },
      { label: '斤', symbol: '斤', factor: 500 },
    ],
  },
  volume: {
    label: '容量',
    unitTargetText: '元 / 100ml',
    displayAmount: 100,
    displayUnit: 'ml',
    baseUnit: 'ml',
    units: [
      { label: '毫升', symbol: 'ml', factor: 1 },
      { label: '升', symbol: 'L', factor: 1000 },
    ],
  },
  count: {
    label: '数量',
    unitTargetText: '元 / 件',
    displayAmount: 1,
    displayUnit: '件',
    baseUnit: '件',
    units: [
      { label: '件', symbol: '件', factor: 1 },
      { label: '个', symbol: '个', factor: 1 },
      { label: '包', symbol: '包', factor: 1 },
      { label: '片', symbol: '片', factor: 1 },
    ],
  },
}

const modeTabs = Object.keys(compareModes).map((value) => ({
  value,
  label: compareModes[value].label,
}))

const PRICE_EPSILON = 0.000001

type CompareItem = {
  id: string
  name: string
  price: string
  amount: string
  unitIndex: number
  unitName: string
  unitSymbol: string
  unitPrice: number
  unitPriceText: string
  amountText: string
  savingText: string
  hasValid: boolean
  isBest: boolean
  itemNumber?: number
  displayName?: string
}

function formatNumber(value: number, digits = 2) {
  if (!Number.isFinite(value)) return '--'
  return String(Number(value.toFixed(digits)))
}

function formatPrice(value: number) {
  if (!Number.isFinite(value)) return '--'
  if (value >= 100) return formatNumber(value, 2)
  if (value >= 10) return formatNumber(value, 3)
  return formatNumber(value, 4)
}

function createItem(mode = 'weight'): CompareItem {
  const unit = compareModes[mode].units[0]
  return {
    id: `item_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: '',
    price: '',
    amount: '',
    unitIndex: 0,
    unitName: unit.label,
    unitSymbol: unit.symbol,
    unitPrice: 0,
    unitPriceText: '--',
    amountText: '填写后自动换算',
    savingText: '',
    hasValid: false,
    isBest: false,
  }
}

function normalizeItem(item: CompareItem, modeKey: string) {
  const mode = compareModes[modeKey]
  const unit = mode.units[item.unitIndex] || mode.units[0]
  const price = Number(item.price)
  const amount = Number(item.amount)
  const baseAmount = amount * unit.factor
  const hasValid = price > 0 && amount > 0 && Number.isFinite(price) && Number.isFinite(amount)
  const unitPrice = hasValid ? (price / baseAmount) * mode.displayAmount : 0
  return {
    ...item,
    unitName: unit.label,
    unitSymbol: unit.symbol,
    unitPrice,
    unitPriceText: hasValid ? formatPrice(unitPrice) : '--',
    amountText: hasValid ? `折合 ${formatNumber(baseAmount, 2)} ${mode.baseUnit}` : '填写后自动换算',
    hasValid,
    isBest: false,
    savingText: '',
  }
}

export default function PriceComparePage() {
  const [activeMode, setActiveMode] = useState('weight')
  const [items, setItems] = useState<CompareItem[]>([createItem(), createItem()])
  const [comparedCount, setComparedCount] = useState(0)
  const [hasResult, setHasResult] = useState(false)
  const [resultTitle, setResultTitle] = useState('至少填写 2 个商品的价格和规格')
  const [resultSummary, setResultSummary] = useState('')
  const [resultRows, setResultRows] = useState([
    { label: '最低单价', value: '--' },
    { label: '相比第二名', value: '--' },
  ])

  useShareAppMessage(() => ({
    title: '同类商品哪个更划算？填价格和规格算单价',
    path: '/packages/tools/price-compare/price-compare',
  }))

  useShareTimeline(() => ({
    title: '比价计算器：快速比较哪个规格更便宜',
  }))

  const getAdvantageText = (diffPrice: number, diffPercent: number, unitTargetText: string) => {
    if (Math.abs(diffPrice) < PRICE_EPSILON) return '和第二名单价相同'
    const percentText = formatNumber(diffPercent, diffPercent >= 10 ? 0 : 1)
    return `便宜 ${formatPrice(diffPrice)} ${unitTargetText}，约 ${percentText}%`
  }

  const applyCompareState = (modeKey: string, sourceItems: CompareItem[]) => {
    const mode = compareModes[modeKey]
    const itemsWithName = sourceItems.map((item, index) => {
      const normalized = normalizeItem(item, modeKey)
      return {
        ...normalized,
        itemNumber: index + 1,
        displayName: normalized.name || `第 ${index + 1} 个商品`,
      }
    })
    const validItems = itemsWithName.filter((item) => item.hasValid)
    const rankedItems = [...validItems].sort((a, b) => a.unitPrice - b.unitPrice)
    const bestItem = rankedItems[0]
    const secondItem = rankedItems[1]
    const nextHasResult = validItems.length >= 2
    const bestPrice = bestItem ? bestItem.unitPrice : 0
    const tiedBestCount = nextHasResult
      ? validItems.filter((item) => Math.abs(item.unitPrice - bestPrice) < PRICE_EPSILON).length
      : 0
    const secondDiff = nextHasResult && secondItem ? secondItem.unitPrice - bestPrice : 0
    const secondDiffPercent = nextHasResult && bestPrice > 0 ? (secondDiff / bestPrice) * 100 : 0
    const advantageText = getAdvantageText(secondDiff, secondDiffPercent, mode.unitTargetText)

    const nextItems = itemsWithName.map((item) => {
      const isBest = nextHasResult && item.hasValid && Math.abs(item.unitPrice - bestPrice) < PRICE_EPSILON
      let savingText = ''
      if (isBest) savingText = tiedBestCount > 1 ? '并列最低' : '最划算'
      else if (nextHasResult && item.hasValid) {
        const percent = (item.unitPrice / bestPrice - 1) * 100
        savingText = `贵 ${formatNumber(percent, percent >= 10 ? 0 : 1)}%`
      }
      return { ...item, isBest, savingText }
    })

    let title = '至少填写 2 个商品的价格和规格'
    if (nextHasResult) {
      title = tiedBestCount > 1 ? `${tiedBestCount} 个商品单价持平` : `建议选第 ${bestItem.itemNumber} 个商品`
    }

    setActiveMode(modeKey)
    setItems(nextItems)
    setComparedCount(validItems.length)
    setHasResult(nextHasResult)
    setResultTitle(title)
    setResultSummary(nextHasResult ? advantageText : '')
    setResultRows([
      {
        label: '最低单价',
        value: nextHasResult ? `${formatPrice(bestItem.unitPrice)} ${mode.unitTargetText}` : '--',
      },
      {
        label: '相比第二名',
        value: nextHasResult ? advantageText : '--',
      },
    ])
  }

  const updateItem = (id: string, patch: Partial<CompareItem>) => {
    const next = items.map((item) => (item.id === id ? { ...item, ...patch } : item))
    applyCompareState(activeMode, next)
  }

  const unitOptions = compareModes[activeMode].units

  return (
    <View className='shell'>
      <NavigationBar title='比价计算' background='var(--s-1-weak, #f5f7fa)' />
      <ScrollView className='page-scroll' scrollY enhanced showScrollbar={false}>
        <View className='page'>
          <ToolIntroCard
            title='算出哪个商品更划算'
            description='输入价格和规格，统一换算单价后进行比较。'
          />

          <View className='card'>
            <Text className='card__title'>比较方式</Text>
            <View className='segment-row'>
              {modeTabs.map((item) => (
                <View
                  key={item.value}
                  className={`segment-item ${activeMode === item.value ? 'is-active' : ''}`}
                  onClick={() => {
                    if (item.value === activeMode) return
                    const mode = compareModes[item.value]
                    const firstUnit = mode.units[0]
                    const nextItems = items.map((row) => ({
                      ...row,
                      unitIndex: 0,
                      unitName: firstUnit.label,
                      unitSymbol: firstUnit.symbol,
                    }))
                    applyCompareState(item.value, nextItems)
                  }}
                >
                  {item.label}
                </View>
              ))}
            </View>

            {items.map((item) => (
              <View key={item.id} className={`item-card ${item.isBest ? 'is-best' : ''}`}>
                <View className='item-head'>
                  <Text className='item-title'>{item.displayName || `商品`}</Text>
                  <Text
                    className='item-remove'
                    onClick={() => {
                      if (items.length <= 2) {
                        Taro.showToast({ title: '至少保留 2 个商品', icon: 'none' })
                        return
                      }
                      applyCompareState(
                        activeMode,
                        items.filter((row) => row.id !== item.id)
                      )
                    }}
                  >
                    删除
                  </Text>
                </View>
                <View className='field-list'>
                  <View className='field-row'>
                    <View className='field-main'>
                      <Text className='field-label'>名称（可选）</Text>
                      <Input
                        className='field-input'
                        value={item.name}
                        placeholder='例如 A 品牌'
                        placeholderClass='input-placeholder'
                        onInput={(e) => updateItem(item.id, { name: e.detail.value })}
                      />
                    </View>
                  </View>
                  <View className='field-row'>
                    <View className='field-main'>
                      <Text className='field-label'>价格</Text>
                      <Input
                        className='field-input'
                        type='digit'
                        value={item.price}
                        placeholder='请输入价格'
                        placeholderClass='input-placeholder'
                        onInput={(e) => updateItem(item.id, { price: e.detail.value })}
                      />
                    </View>
                    <Text className='field-unit'>元</Text>
                  </View>
                  <View className='field-row'>
                    <View className='field-main'>
                      <Text className='field-label'>规格数量</Text>
                      <Input
                        className='field-input'
                        type='digit'
                        value={item.amount}
                        placeholder='请输入数量'
                        placeholderClass='input-placeholder'
                        onInput={(e) => updateItem(item.id, { amount: e.detail.value })}
                      />
                    </View>
                  </View>
                  <Picker
                    mode='selector'
                    range={unitOptions.map((u) => u.label)}
                    value={item.unitIndex}
                    onChange={(e) => {
                      const unitIndex = Number(e.detail.value)
                      const unit = unitOptions[unitIndex]
                      updateItem(item.id, {
                        unitIndex,
                        unitName: unit.label,
                        unitSymbol: unit.symbol,
                      })
                    }}
                  >
                    <View className='field-row'>
                      <View className='field-main'>
                        <Text className='field-label'>单位</Text>
                        <Text className='picker-value'>
                          {item.unitName}（{item.unitSymbol}）
                        </Text>
                      </View>
                    </View>
                  </Picker>
                </View>
                <Text className='item-meta'>
                  单价 {item.unitPriceText} {compareModes[activeMode].unitTargetText} · {item.amountText}
                </Text>
                {item.savingText ? <Text className='saving-text'>{item.savingText}</Text> : null}
              </View>
            ))}

            <View
              className='add-btn'
              onClick={() => {
                if (items.length >= 6) {
                  Taro.showToast({ title: '最多比较 6 个商品', icon: 'none' })
                  return
                }
                applyCompareState(activeMode, [...items, createItem(activeMode)])
              }}
            >
              添加商品
            </View>
          </View>

          <View className='result-card'>
            <View className='result-head'>
              <View>
                <Text className='result-label'>比较结果</Text>
                <Text className='result-value result-value-sm'>{resultTitle}</Text>
              </View>
              <Text className='result-badge'>{hasResult ? `${comparedCount} 个有效` : '待比较'}</Text>
            </View>
            <View className='summary-grid'>
              {resultRows.map((row) => (
                <View key={row.label} className='summary-item'>
                  <Text className='summary-label'>{row.label}</Text>
                  <Text className='summary-value'>{row.value}</Text>
                </View>
              ))}
            </View>
            {hasResult ? (
              <>
                <Text className='detail-desc'>{resultSummary}</Text>
                <Text
                  className='reset-link'
                  onClick={() => applyCompareState(activeMode, [createItem(activeMode), createItem(activeMode)])}
                >
                  重新填写
                </Text>
              </>
            ) : (
              <Text className='result-empty'>至少填写 2 个商品的价格和规格后，会自动比较单价。</Text>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  )
}
