import { useState } from 'react'
import { Input, ScrollView, Text, View } from '@tarojs/components'
import Taro, { useShareAppMessage, useShareTimeline } from '@tarojs/taro'

import NavigationBar from '@/components/NavigationBar'
import ToolIntroCard from '@/packages/tools/components/ToolIntroCard'
import { calculateBmi } from './bmi.logic'

import './bmi.scss'

type ResultTone = 'normal' | 'low' | 'high' | 'alert'

function getBmiResult(bmi: number) {
  if (bmi < 18.5) {
    return {
      level: '偏瘦',
      desc: '可以适当增加优质蛋白和力量训练，让身体状态更稳。',
      tone: 'low' as ResultTone,
    }
  }
  if (bmi < 24) {
    return {
      level: '正常',
      desc: '当前 BMI 位于健康区间，继续保持规律饮食和运动。',
      tone: 'normal' as ResultTone,
    }
  }
  if (bmi < 28) {
    return {
      level: '超重',
      desc: '建议关注腰围、饮食结构和日常活动量，慢慢调回舒适区。',
      tone: 'high' as ResultTone,
    }
  }
  return {
    level: '肥胖',
    desc: '建议结合身体状况制定减重计划，必要时咨询专业医生。',
    tone: 'alert' as ResultTone,
  }
}

function getMarkerPercent(bmi: number) {
  const min = 14
  const max = 34
  const clamped = Math.min(Math.max(bmi, min), max)
  return Math.round(((clamped - min) / (max - min)) * 100)
}

export default function BmiPage() {
  const [heightValue, setHeightValue] = useState('')
  const [weightValue, setWeightValue] = useState('')
  const [hasResult, setHasResult] = useState(false)
  const [bmiValue, setBmiValue] = useState('--')
  const [bmiLevel, setBmiLevel] = useState('')
  const [bmiDesc, setBmiDesc] = useState('')
  const [idealRange, setIdealRange] = useState('')
  const [markerPercent, setMarkerPercent] = useState(0)
  const [resultTone, setResultTone] = useState<ResultTone>('normal')

  useShareAppMessage(() => ({
    title: '输入身高体重，快速算一下自己的 BMI',
    path: '/packages/tools/bmi/bmi',
  }))

  useShareTimeline(() => ({
    title: 'BMI 计算器：看看体重状态是否在健康区间',
  }))

  const onCalculate = () => {
    const height = Number(heightValue)
    const weight = Number(weightValue)

    if (!height || !weight) {
      Taro.showToast({ title: '请填写身高和体重', icon: 'none' })
      return
    }
    if (height < 80 || height > 250) {
      Taro.showToast({ title: '身高范围不太对', icon: 'none' })
      return
    }
    if (weight < 20 || weight > 300) {
      Taro.showToast({ title: '体重范围不太对', icon: 'none' })
      return
    }

    const calculation = calculateBmi(height, weight)
    const bmi = calculation.bmi
    const result = getBmiResult(bmi)
    const [minWeight, maxWeight] = calculation.healthyWeight

    setHasResult(true)
    setBmiValue(bmi.toFixed(1))
    setBmiLevel(result.level)
    setBmiDesc(result.desc)
    setResultTone(result.tone)
    setIdealRange(`${minWeight.toFixed(1)} - ${maxWeight.toFixed(1)} kg`)
    setMarkerPercent(Math.round(calculation.markerPercent))
  }

  const onReset = () => {
    setHeightValue('')
    setWeightValue('')
    setHasResult(false)
    setBmiValue('--')
    setBmiLevel('')
    setBmiDesc('')
    setIdealRange('')
    setMarkerPercent(0)
    setResultTone('normal')
  }

  return (
    <View className='shell'>
      <NavigationBar title='BMI 计算' background='var(--s-1-weak, #f5f7fa)' />
      <ScrollView className='page-scroll' scrollY enhanced showScrollbar={false}>
        <View className='page'>
          <ToolIntroCard
            title='看看体重是否在健康区间'
            description='输入身高和体重，计算 BMI 并查看健康体重参考。'
          />

          <View className='card'>
            <Text className='card__title'>基础数据</Text>
            <View className='field-list'>
              <View className='field-row'>
                <View className='field-main'>
                  <Text className='field-label'>身高</Text>
                  <Input
                    className='field-input'
                    type='digit'
                    value={heightValue}
                    placeholder='请输入身高'
                    placeholderClass='input-placeholder'
                    onInput={(e) => setHeightValue(e.detail.value)}
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
                    onInput={(e) => setWeightValue(e.detail.value)}
                  />
                </View>
                <Text className='field-unit'>kg</Text>
              </View>
            </View>
            <View className='button-row'>
              <View className='calc-btn' onClick={onCalculate}>
                计算 BMI
              </View>
            </View>
          </View>

          <View className={`result-card result-${resultTone}`}>
            <View className='result-head'>
              <View>
                <Text className='result-label'>你的 BMI</Text>
                <Text className='result-value'>{bmiValue}</Text>
              </View>
              <Text className='result-badge'>{hasResult ? bmiLevel : '待计算'}</Text>
            </View>

            <View className='gauge'>
              <View className='gauge-track'>
                <View className='gauge-segment segment-low' />
                <View className='gauge-segment segment-normal' />
                <View className='gauge-segment segment-high' />
                <View className='gauge-segment segment-alert' />
                {hasResult ? (
                  <View className='gauge-marker' style={{ left: `${markerPercent}%` }} />
                ) : null}
              </View>
              <View className='gauge-labels'>
                <Text>偏瘦</Text>
                <Text>正常</Text>
                <Text>超重</Text>
                <Text>肥胖</Text>
              </View>
            </View>

            {hasResult ? (
              <View className='result-detail'>
                <Text className='detail-desc'>{bmiDesc}</Text>
                <View className='ideal-card'>
                  <Text className='ideal-title'>健康体重参考</Text>
                  <Text className='ideal-value'>{idealRange}</Text>
                </View>
                <Text className='reset-link' onClick={onReset}>
                  重新填写
                </Text>
              </View>
            ) : (
              <Text className='result-empty'>完成填写后，这里会显示 BMI 结果和健康体重参考。</Text>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  )
}
