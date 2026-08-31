import { useState } from 'react'
import { Input, Picker, ScrollView, Text, View } from '@tarojs/components'
import { useShareAppMessage, useShareTimeline } from '@tarojs/taro'

import NavigationBar from '@/components/NavigationBar'
import ToolIntroCard from '@/packages/tools/components/ToolIntroCard'
import { convertTemperature as convertTemperatureValue } from './converter.logic'

import './converter.scss'

type Unit = { label: string; symbol: string; factor?: number; key?: string }

const unitGroups: Record<
  string,
  { label: string; defaults: number[]; units: Unit[]; commonRows: { label: string; value: string }[] }
> = {
  length: {
    label: '长度',
    defaults: [2, 1],
    units: [
      { label: '毫米', symbol: 'mm', factor: 0.001 },
      { label: '厘米', symbol: 'cm', factor: 0.01 },
      { label: '米', symbol: 'm', factor: 1 },
      { label: '千米', symbol: 'km', factor: 1000 },
      { label: '英寸', symbol: 'in', factor: 0.0254 },
      { label: '英尺', symbol: 'ft', factor: 0.3048 },
    ],
    commonRows: [
      { label: '1 米', value: '100 厘米' },
      { label: '1 千米', value: '1000 米' },
      { label: '1 英寸', value: '2.54 厘米' },
    ],
  },
  area: {
    label: '面积',
    defaults: [0, 3],
    units: [
      { label: '平方米', symbol: 'm²', factor: 1 },
      { label: '平方厘米', symbol: 'cm²', factor: 0.0001 },
      { label: '平方千米', symbol: 'km²', factor: 1000000 },
      { label: '亩', symbol: '亩', factor: 666.6666667 },
      { label: '公顷', symbol: 'ha', factor: 10000 },
      { label: '平方英尺', symbol: 'ft²', factor: 0.09290304 },
    ],
    commonRows: [
      { label: '1 亩', value: '约 666.67 平方米' },
      { label: '1 公顷', value: '15 亩' },
      { label: '1 平方千米', value: '100 公顷' },
    ],
  },
  weight: {
    label: '重量',
    defaults: [2, 1],
    units: [
      { label: '毫克', symbol: 'mg', factor: 0.000001 },
      { label: '克', symbol: 'g', factor: 0.001 },
      { label: '千克', symbol: 'kg', factor: 1 },
      { label: '吨', symbol: 't', factor: 1000 },
      { label: '斤', symbol: '斤', factor: 0.5 },
      { label: '磅', symbol: 'lb', factor: 0.45359237 },
    ],
    commonRows: [
      { label: '1 千克', value: '2 斤' },
      { label: '1 吨', value: '1000 千克' },
      { label: '1 磅', value: '约 0.4536 千克' },
    ],
  },
  volume: {
    label: '体积',
    defaults: [2, 1],
    units: [
      { label: '毫升', symbol: 'ml', factor: 0.001 },
      { label: '升', symbol: 'L', factor: 1 },
      { label: '立方米', symbol: 'm³', factor: 1000 },
      { label: '茶匙', symbol: 'tsp', factor: 0.00492892 },
      { label: '汤匙', symbol: 'tbsp', factor: 0.0147868 },
      { label: '液量盎司', symbol: 'fl oz', factor: 0.0295735 },
    ],
    commonRows: [
      { label: '1 升', value: '1000 毫升' },
      { label: '1 立方米', value: '1000 升' },
      { label: '1 汤匙', value: '约 15 毫升' },
    ],
  },
  temperature: {
    label: '温度',
    defaults: [0, 1],
    units: [
      { label: '摄氏度', symbol: '°C', key: 'celsius' },
      { label: '华氏度', symbol: '°F', key: 'fahrenheit' },
      { label: '开尔文', symbol: 'K', key: 'kelvin' },
    ],
    commonRows: [
      { label: '0 °C', value: '32 °F' },
      { label: '100 °C', value: '212 °F' },
      { label: '273.15 K', value: '0 °C' },
    ],
  },
}

const categoryTabs = Object.keys(unitGroups).map((value) => ({
  value,
  label: unitGroups[value].label,
}))

function formatNumber(value: number) {
  if (!Number.isFinite(value)) return '--'
  if (Math.abs(value) < 1e-10) return '0'
  const precision = Math.abs(value) >= 1000 ? 2 : 6
  return String(Number(value.toFixed(precision)))
}

function convertTemperature(value: number, fromKey?: string, toKey?: string) {
  const keys = { celsius: 'c', fahrenheit: 'f', kelvin: 'k' } as const
  return convertTemperatureValue(value, keys[fromKey as keyof typeof keys] || 'c', keys[toKey as keyof typeof keys] || 'c')
}

function getCategoryState(category: string, fromValue = '') {
  const group = unitGroups[category]
  const [fromUnitIndex, toUnitIndex] = group.defaults
  const fromUnit = group.units[fromUnitIndex]
  const toUnit = group.units[toUnitIndex]
  return {
    unitOptions: group.units,
    commonRows: group.commonRows,
    fromUnitIndex,
    toUnitIndex,
    fromUnitName: fromUnit.label,
    fromUnitSymbol: fromUnit.symbol,
    toUnitName: toUnit.label,
    toUnitSymbol: toUnit.symbol,
    fromValue,
    toValue: '--',
  }
}

export default function ConverterPage() {
  const initial = getCategoryState('length')
  const [activeCategory, setActiveCategory] = useState('length')
  const [unitOptions, setUnitOptions] = useState(initial.unitOptions)
  const [commonRows, setCommonRows] = useState(initial.commonRows)
  const [fromUnitIndex, setFromUnitIndex] = useState(initial.fromUnitIndex)
  const [toUnitIndex, setToUnitIndex] = useState(initial.toUnitIndex)
  const [fromUnitName, setFromUnitName] = useState(initial.fromUnitName)
  const [fromUnitSymbol, setFromUnitSymbol] = useState(initial.fromUnitSymbol)
  const [toUnitName, setToUnitName] = useState(initial.toUnitName)
  const [toUnitSymbol, setToUnitSymbol] = useState(initial.toUnitSymbol)
  const [fromValue, setFromValue] = useState('')
  const [toValue, setToValue] = useState('--')

  useShareAppMessage(() => ({
    title: '长度、面积、重量、温度，常用单位快速换算',
    path: '/packages/tools/converter/converter',
  }))

  useShareTimeline(() => ({
    title: '单位换算工具：常用数据一键换算',
  }))

  const updateUnitMeta = (category: string, fromIndex: number, toIndex: number) => {
    const group = unitGroups[category]
    const fromUnit = group.units[fromIndex]
    const toUnit = group.units[toIndex]
    setFromUnitName(fromUnit.label)
    setFromUnitSymbol(fromUnit.symbol)
    setToUnitName(toUnit.label)
    setToUnitSymbol(toUnit.symbol)
  }

  const calculate = (
    category = activeCategory,
    valueStr = fromValue,
    fromIndex = fromUnitIndex,
    toIndex = toUnitIndex
  ) => {
    const value = Number(valueStr)
    if (valueStr === '' || Number.isNaN(value)) {
      setToValue('--')
      return
    }
    const group = unitGroups[category]
    const fromUnit = group.units[fromIndex]
    const toUnit = group.units[toIndex]
    const result =
      category === 'temperature'
        ? convertTemperature(value, fromUnit.key, toUnit.key)
        : (value * (fromUnit.factor || 1)) / (toUnit.factor || 1)
    setToValue(formatNumber(result))
  }

  const applyCategory = (value: string) => {
    const state = getCategoryState(value, fromValue)
    setActiveCategory(value)
    setUnitOptions(state.unitOptions)
    setCommonRows(state.commonRows)
    setFromUnitIndex(state.fromUnitIndex)
    setToUnitIndex(state.toUnitIndex)
    setFromUnitName(state.fromUnitName)
    setFromUnitSymbol(state.fromUnitSymbol)
    setToUnitName(state.toUnitName)
    setToUnitSymbol(state.toUnitSymbol)
    calculate(value, fromValue, state.fromUnitIndex, state.toUnitIndex)
  }

  return (
    <View className='shell'>
      <NavigationBar title='单位换算' background='var(--s-1-weak, #f5f7fa)' />
      <ScrollView className='page-scroll' scrollY enhanced showScrollbar={false}>
        <View className='page'>
          <ToolIntroCard
            title='常用单位快速换算'
            description='支持长度、面积、重量、体积和温度，输入数值即可换算。'
          />

          <View className='card'>
            <Text className='card__title'>换算类型</Text>
            <View className='category-tabs'>
              {categoryTabs.map((item) => (
                <View
                  key={item.value}
                  className={`chip ${activeCategory === item.value ? 'is-active' : ''}`}
                  onClick={() => applyCategory(item.value)}
                >
                  {item.label}
                </View>
              ))}
            </View>

            <View className='field-list'>
              <View className='field-row'>
                <View className='field-main'>
                  <Text className='field-label'>输入数值</Text>
                  <Input
                    className='field-input'
                    type='digit'
                    value={fromValue}
                    placeholder='请输入数值'
                    placeholderClass='input-placeholder'
                    onInput={(e) => {
                      setFromValue(e.detail.value)
                      calculate(activeCategory, e.detail.value)
                    }}
                  />
                </View>
              </View>

              <Picker
                mode='selector'
                range={unitOptions.map((item) => item.label)}
                value={fromUnitIndex}
                onChange={(e) => {
                  const index = Number(e.detail.value)
                  setFromUnitIndex(index)
                  updateUnitMeta(activeCategory, index, toUnitIndex)
                  calculate(activeCategory, fromValue, index, toUnitIndex)
                }}
              >
                <View className='field-row'>
                  <View className='field-main'>
                    <Text className='field-label'>从</Text>
                    <Text className='picker-value'>
                      {fromUnitName}（{fromUnitSymbol}）
                    </Text>
                  </View>
                </View>
              </Picker>

              <View className='swap-btn'
                onClick={() => {
                  const nextValue = toValue !== '--' ? toValue : fromValue
                  setFromUnitIndex(toUnitIndex)
                  setToUnitIndex(fromUnitIndex)
                  setFromValue(nextValue)
                  updateUnitMeta(activeCategory, toUnitIndex, fromUnitIndex)
                  calculate(activeCategory, nextValue, toUnitIndex, fromUnitIndex)
                }}
              >
                交换单位
              </View>

              <Picker
                mode='selector'
                range={unitOptions.map((item) => item.label)}
                value={toUnitIndex}
                onChange={(e) => {
                  const index = Number(e.detail.value)
                  setToUnitIndex(index)
                  updateUnitMeta(activeCategory, fromUnitIndex, index)
                  calculate(activeCategory, fromValue, fromUnitIndex, index)
                }}
              >
                <View className='field-row'>
                  <View className='field-main'>
                    <Text className='field-label'>到</Text>
                    <Text className='picker-value'>
                      {toUnitName}（{toUnitSymbol}）
                    </Text>
                  </View>
                </View>
              </Picker>
            </View>

            <Text className='result-label' style={{ marginTop: '12px' }}>
              换算结果
            </Text>
            <Text className='convert-result'>{toValue}</Text>
            <Text className='helper-note'>
              {toUnitName}（{toUnitSymbol}）
            </Text>
            <View className='action-links'>
              <Text
                className='action-link'
                onClick={() => {
                  setFromValue('')
                  setToValue('--')
                }}
              >
                清空
              </Text>
            </View>
          </View>

          <View className='card'>
            <Text className='card__title'>常用换算</Text>
            {commonRows.map((item) => (
              <View key={item.label} className='common-row'>
                <Text className='common-label'>{item.label}</Text>
                <Text className='common-value'>{item.value}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  )
}
