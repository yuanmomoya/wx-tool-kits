import { useState } from 'react'
import { Input, ScrollView, Text, View } from '@tarojs/components'
import Taro, { useShareAppMessage, useShareTimeline } from '@tarojs/taro'

import NavigationBar from '@/components/NavigationBar'
import ToolIntroCard from '@/packages/tools/components/ToolIntroCard'
import { calculateEnergyPlan } from './bmr.logic'

import './bmr.scss'

const activityOptions = [
  { id: 'sedentary', label: '久坐少动', desc: '办公学习为主，几乎不运动', factor: 1.2 },
  { id: 'light', label: '轻度活动', desc: '每周运动 1 到 3 天', factor: 1.375 },
  { id: 'moderate', label: '中度活动', desc: '每周运动 3 到 5 天', factor: 1.55 },
  { id: 'active', label: '高度活动', desc: '每周运动 6 到 7 天', factor: 1.725 },
]

const defaultResult = {
  bmr: '--',
  tdee: '--',
  cut: '--',
  maintain: '--',
  gain: '--',
  activityLabel: '',
  summary: '',
}

export default function BmrPage() {
  const [gender, setGender] = useState('male')
  const [ageValue, setAgeValue] = useState('')
  const [heightValue, setHeightValue] = useState('')
  const [weightValue, setWeightValue] = useState('')
  const [activityKey, setActivityKey] = useState('sedentary')
  const [hasResult, setHasResult] = useState(false)
  const [result, setResult] = useState(defaultResult)

  useShareAppMessage(() => ({
    title: '算一下每天基础代谢和热量消耗',
    path: '/packages/tools/bmr/bmr',
  }))

  useShareTimeline(() => ({
    title: '基础代谢率计算器：估算每日热量消耗',
  }))

  const clearResult = () => {
    setHasResult(false)
    setResult(defaultResult)
  }

  const onCalculate = () => {
    const age = Number(ageValue)
    const height = Number(heightValue)
    const weight = Number(weightValue)
    const activity = activityOptions.find((item) => item.id === activityKey)

    if (!age || !height || !weight) {
      Taro.showToast({ title: '请填写完整信息', icon: 'none' })
      return
    }
    if (age < 10 || age > 100) {
      Taro.showToast({ title: '年龄范围不太对', icon: 'none' })
      return
    }
    if (height < 100 || height > 250) {
      Taro.showToast({ title: '身高范围不太对', icon: 'none' })
      return
    }
    if (weight < 20 || weight > 300) {
      Taro.showToast({ title: '体重范围不太对', icon: 'none' })
      return
    }
    if (!activity) return

    const plan = calculateEnergyPlan(gender as 'male' | 'female', age, height, weight, activity.factor)
    const { bmr, maintenance: maintain, fatLoss: cut } = plan
    const gain = Math.round(maintain + 250)

    setHasResult(true)
    setResult({
      bmr: String(Math.round(bmr)),
      tdee: String(maintain),
      cut: String(cut),
      maintain: String(maintain),
      gain: String(gain),
      activityLabel: activity.label,
      summary: `按${activity.label}估算，你每天总消耗约 ${maintain} 千卡。`,
    })
  }

  const onReset = () => {
    setGender('male')
    setAgeValue('')
    setHeightValue('')
    setWeightValue('')
    setActivityKey('sedentary')
    clearResult()
  }

  return (
    <View className='shell'>
      <NavigationBar title='基础代谢率' background='var(--s-1-weak, #f5f7fa)' />
      <ScrollView className='page-scroll' scrollY enhanced showScrollbar={false}>
        <View className='page'>
          <ToolIntroCard
            title='估算每天的热量消耗'
            description='输入基础身体数据和活动水平，计算 BMR 与每日总消耗。'
          />

          <View className='card'>
            <Text className='card__title'>基础数据</Text>
            <View className='gender-row'>
              <Text className='gender-label'>性别</Text>
              <View className='gender-selector'>
                <View
                  className={`gender-chip ${gender === 'male' ? 'is-active' : ''}`}
                  onClick={() => {
                    setGender('male')
                    clearResult()
                  }}
                >
                  男性
                </View>
                <View
                  className={`gender-chip ${gender === 'female' ? 'is-active' : ''}`}
                  onClick={() => {
                    setGender('female')
                    clearResult()
                  }}
                >
                  女性
                </View>
              </View>
            </View>

            <View className='field-list'>
              <View className='field-row'>
                <View className='field-main'>
                  <Text className='field-label'>年龄</Text>
                  <Input
                    className='field-input'
                    type='number'
                    value={ageValue}
                    placeholder='请输入年龄'
                    placeholderClass='input-placeholder'
                    onInput={(e) => {
                      setAgeValue(e.detail.value)
                      clearResult()
                    }}
                  />
                </View>
                <Text className='field-unit'>岁</Text>
              </View>
              <View className='field-row'>
                <View className='field-main'>
                  <Text className='field-label'>身高</Text>
                  <Input
                    className='field-input'
                    type='digit'
                    value={heightValue}
                    placeholder='请输入身高'
                    placeholderClass='input-placeholder'
                    onInput={(e) => {
                      setHeightValue(e.detail.value)
                      clearResult()
                    }}
                  />
                </View>
                <Text className='field-unit'>cm</Text>
              </View>
              <View className='field-row'>
                <View className='field-main'>
                  <Text className='field-label'>体重</Text>
                  <Input
                    className='field-input'
                    type='digit'
                    value={weightValue}
                    placeholder='请输入体重'
                    placeholderClass='input-placeholder'
                    onInput={(e) => {
                      setWeightValue(e.detail.value)
                      clearResult()
                    }}
                  />
                </View>
                <Text className='field-unit'>kg</Text>
              </View>
            </View>

            <Text className='card__title' style={{ marginTop: '16px' }}>
              日常活动水平
            </Text>
            <View className='activity-selector'>
              {activityOptions.map((item) => (
                <View
                  key={item.id}
                  className={`activity-btn ${activityKey === item.id ? 'is-active' : ''}`}
                  onClick={() => {
                    setActivityKey(item.id)
                    clearResult()
                  }}
                >
                  <Text className='activity-label'>{item.label}</Text>
                  <Text className='activity-desc'>{item.desc}</Text>
                </View>
              ))}
            </View>
            <Text className='helper-note'>
              BMR 是静息状态的基础消耗，TDEE 会结合你的活动水平一起估算。
            </Text>
            <View className='button-row'>
              <View className='calc-btn' onClick={onCalculate}>
                计算 BMR
              </View>
            </View>
          </View>

          <View className='result-card'>
            <View className='result-head'>
              <View>
                <Text className='result-label'>基础代谢率 BMR</Text>
                <View className='result-value-row'>
                  <Text className='result-value'>{result.bmr}</Text>
                  <Text className='result-unit'>千卡/天</Text>
                </View>
              </View>
              <Text className='result-badge'>{hasResult ? result.activityLabel : '待计算'}</Text>
            </View>

            <View className='summary-grid'>
              <View className='summary-item'>
                <Text className='summary-label'>每日总消耗 TDEE</Text>
                <Text className='summary-value'>{result.tdee}</Text>
              </View>
              <View className='summary-item'>
                <Text className='summary-label'>估算方式</Text>
                <Text className='summary-value'>Mifflin-St Jeor</Text>
                <Text className='summary-note'>根据年龄、身高、体重和性别估算基础代谢</Text>
              </View>
            </View>

            {hasResult ? (
              <View className='detail-card'>
                <Text className='detail-desc'>{result.summary}</Text>
                <View className='goal-grid'>
                  <View className='goal-item'>
                    <Text className='goal-label'>减脂参考</Text>
                    <Text className='goal-value'>{result.cut}</Text>
                    <Text className='goal-unit'>千卡/天</Text>
                  </View>
                  <View className='goal-item'>
                    <Text className='goal-label'>维持当前</Text>
                    <Text className='goal-value'>{result.maintain}</Text>
                    <Text className='goal-unit'>千卡/天</Text>
                  </View>
                  <View className='goal-item'>
                    <Text className='goal-label'>增重参考</Text>
                    <Text className='goal-value'>{result.gain}</Text>
                    <Text className='goal-unit'>千卡/天</Text>
                  </View>
                </View>
                <Text className='detail-tip'>结果适合成年人日常参考，不代替专业营养或医疗建议。</Text>
                <Text className='reset-link' onClick={onReset}>
                  重新填写
                </Text>
              </View>
            ) : (
              <Text className='result-empty'>完成填写后，这里会显示基础代谢、每日总消耗和热量参考。</Text>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  )
}
