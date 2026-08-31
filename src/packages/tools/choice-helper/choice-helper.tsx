import { useEffect, useRef, useState } from 'react'
import { Input, ScrollView, Text, View } from '@tarojs/components'
import Taro, { useShareAppMessage, useShareTimeline } from '@tarojs/taro'

import NavigationBar from '@/components/NavigationBar'
import ToolIntroCard from '@/packages/tools/components/ToolIntroCard'
import { cloneTemplate } from './choice-helper.logic'

import './choice-helper.scss'

type OptionItem = { id: string; label: string; builtIn: boolean }
type ReelItem = { id: string; label: string }

const templates = [
  { id: 'custom', title: '我命由我不由天', desc: '从空白开始自己填', options: [] as string[] },
  {
    id: 'meal',
    title: '今天吃什么',
    desc: '午饭晚饭都能用',
    options: ['麻辣烫', '盖饭', '粉面', '水饺', '炒饭', '黄焖鸡', '轻食', '汉堡'],
  },
  {
    id: 'drink',
    title: '喝什么',
    desc: '咖啡奶茶都可以',
    options: ['美式', '拿铁', '奶茶', '果茶', '气泡水', '豆浆', '酸奶', '柠檬水'],
  },
  {
    id: 'dessert',
    title: '下午茶吃什么',
    desc: '小点心快速决定',
    options: ['蛋挞', '面包', '蛋糕', '薯条', '鸡块', '水果杯', '饼干', '冰淇淋'],
  },
  {
    id: 'weekend',
    title: '周末做什么',
    desc: '宅家还是出门',
    options: ['睡觉', '看电影', '散步', '打游戏', '收拾房间', '去商场', '短途出门', '约朋友'],
  },
  {
    id: 'who',
    title: '谁来做',
    desc: '轮流也算答案',
    options: ['我来', '你来', '一起做', '轮流来', '今天先你', '今天先我'],
  },
  {
    id: 'movie',
    title: '看什么类型',
    desc: '先定类型再去选片',
    options: ['喜剧', '悬疑', '动作', '动画', '纪录片', '爱情', '科幻', '治愈'],
  },
]

const REEL_ITEM_HEIGHT = 48
const REEL_REPEAT_COUNT = 14
const REEL_TRANSITION_MS = 4200

const cloneTemplateOptions = (templateId: string): OptionItem[] => {
  const target = templates.find((item) => item.id === templateId) || templates[0]
  return cloneTemplate(target.options).map((label, index) => ({
    id: `${target.id}_${index}`,
    label,
    builtIn: true,
  }))
}

const createOption = (label: string): OptionItem => ({
  id: `custom_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  label,
  builtIn: false,
})

export default function ChoiceHelperPage() {
  const [activeTemplateId, setActiveTemplateId] = useState(templates[0].id)
  const [activeTemplateTitle, setActiveTemplateTitle] = useState(templates[0].title)
  const [activeTemplateDesc, setActiveTemplateDesc] = useState(templates[0].desc)
  const [optionInput, setOptionInput] = useState('')
  const [options, setOptions] = useState(cloneTemplateOptions(templates[0].id))
  const [hasResult, setHasResult] = useState(false)
  const [isPicking, setIsPicking] = useState(false)
  const [resultText, setResultText] = useState('')
  const [reelItems, setReelItems] = useState<ReelItem[]>([])
  const [reelOffset, setReelOffset] = useState(0)
  const [reelDuration, setReelDuration] = useState(0)
  const pickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pickingRef = useRef(false)

  useShareAppMessage(() => ({
    title: '选择困难时，让这个小工具帮你随机决定',
    path: '/packages/tools/choice-helper/choice-helper',
  }))

  useShareTimeline(() => ({
    title: '选择困难助手：今天吃什么、喝什么、做什么',
  }))

  useEffect(() => {
    return () => {
      if (pickTimerRef.current) clearTimeout(pickTimerRef.current)
    }
  }, [])

  const clearPickTimer = () => {
    if (pickTimerRef.current) {
      clearTimeout(pickTimerRef.current)
      pickTimerRef.current = null
    }
  }

  const resetPickState = (extra?: {
    activeTemplateId?: string
    activeTemplateTitle?: string
    activeTemplateDesc?: string
    optionInput?: string
    options?: OptionItem[]
  }) => {
    setHasResult(false)
    setResultText('')
    setReelItems([])
    setReelOffset(0)
    setReelDuration(0)
    if (extra?.activeTemplateId !== undefined) setActiveTemplateId(extra.activeTemplateId)
    if (extra?.activeTemplateTitle !== undefined) setActiveTemplateTitle(extra.activeTemplateTitle)
    if (extra?.activeTemplateDesc !== undefined) setActiveTemplateDesc(extra.activeTemplateDesc)
    if (extra?.optionInput !== undefined) setOptionInput(extra.optionInput)
    if (extra?.options !== undefined) setOptions(extra.options)
  }

  const buildReelData = (list: OptionItem[], finalIndex: number) => {
    const nextReelItems: ReelItem[] = []
    for (let repeat = 0; repeat < REEL_REPEAT_COUNT; repeat += 1) {
      list.forEach((item) => {
        nextReelItems.push({ id: `${item.id}_${repeat}`, label: item.label })
      })
    }
    const finalSlotIndex = list.length * 4 + finalIndex
    const startSlotIndex = finalSlotIndex + list.length * 3
    return { reelItems: nextReelItems, finalSlotIndex, startSlotIndex }
  }

  const getReelOffset = (slotIndex: number) => Math.round(REEL_ITEM_HEIGHT - slotIndex * REEL_ITEM_HEIGHT)

  const onPick = () => {
    if (pickingRef.current || isPicking) return
    if (options.length < 2) {
      Taro.showToast({ title: '至少保留 2 个选项', icon: 'none' })
      return
    }

    const finalIndex = Math.floor(Math.random() * options.length)
    const finalOption = options[finalIndex]
    const { reelItems: nextReelItems, startSlotIndex, finalSlotIndex } = buildReelData(options, finalIndex)

    clearPickTimer()
    pickingRef.current = true
    setIsPicking(true)
    setHasResult(false)
    setResultText('')
    setReelItems(nextReelItems)
    setReelOffset(0)
    setReelDuration(0)

    pickTimerRef.current = setTimeout(() => {
      if (!pickingRef.current) return
      const startOffset = getReelOffset(startSlotIndex)
      const targetOffset = getReelOffset(finalSlotIndex)
      setReelOffset(startOffset)
      setReelDuration(0)

      pickTimerRef.current = setTimeout(() => {
        setReelOffset(targetOffset)
        setReelDuration(REEL_TRANSITION_MS)
        pickTimerRef.current = setTimeout(() => {
          clearPickTimer()
          pickingRef.current = false
          setIsPicking(false)
          setHasResult(true)
          setResultText(finalOption.label)
          setReelOffset(targetOffset)
          setReelDuration(0)
        }, REEL_TRANSITION_MS)
      }, 60)
    }, 30)
  }

  return (
    <View className='shell'>
      <NavigationBar title='选择困难助手' background='var(--s-1-weak, #f5f7fa)' />
      <ScrollView className='page-scroll' scrollY enhanced showScrollbar={false}>
        <View className='page'>
          <ToolIntroCard
            title='帮你从选项里随机挑一个'
            description='选择现成模板或输入自己的选项，交给随机结果做决定。'
          />

          <View className='card'>
            <Text className='card__title'>选择场景</Text>
            <Text className='card__subtitle'>模板只负责缩小范围</Text>
            <ScrollView className='template-strip' scrollX enhanced showScrollbar={false}>
              <View className='template-strip-inner'>
                {templates.map((item) => (
                  <View
                    key={item.id}
                    className={`template-item ${activeTemplateId === item.id ? 'is-active' : ''}`}
                    onClick={() => {
                      if (item.id === activeTemplateId || isPicking) return
                      resetPickState({
                        activeTemplateId: item.id,
                        activeTemplateTitle: item.title,
                        activeTemplateDesc: item.desc,
                        optionInput: '',
                        options: cloneTemplateOptions(item.id),
                      })
                    }}
                  >
                    {item.title}
                  </View>
                ))}
              </View>
            </ScrollView>
            <Text className='helper-note'>
              当前场景：{activeTemplateTitle}，{activeTemplateDesc}
            </Text>
          </View>

          <View className='card'>
            <View className='card-head'>
              <View>
                <Text className='card__title'>{activeTemplateTitle}</Text>
                <Text className='card__subtitle'>{activeTemplateDesc}</Text>
              </View>
              <Text className='option-count'>{options.length} 个选项</Text>
            </View>
            <View className='input-row'>
              <Input
                className='option-input'
                type='text'
                value={optionInput}
                maxlength={18}
                placeholder='补充一个自己的选项'
                placeholderClass='input-placeholder'
                onInput={(e) => setOptionInput(e.detail.value || '')}
              />
              <View
                className='add-action'
                onClick={() => {
                  const value = String(optionInput || '').trim()
                  if (!value) {
                    Taro.showToast({ title: '先输入一个选项', icon: 'none' })
                    return
                  }
                  if (options.some((item) => item.label === value)) {
                    Taro.showToast({ title: '这个选项已经有了', icon: 'none' })
                    return
                  }
                  resetPickState({
                    optionInput: '',
                    options: [...options, createOption(value)],
                  })
                }}
              >
                添加
              </View>
            </View>

            {options.length ? (
              <View className='option-list'>
                {options.map((item) => (
                  <View key={item.id} className='option-chip'>
                    <Text>{item.label}</Text>
                    <Text
                      className='option-chip-remove'
                      onClick={() => {
                        if (isPicking) return
                        resetPickState({
                          options: options.filter((row) => row.id !== item.id),
                        })
                      }}
                    >
                      ×
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text className='result-empty'>当前没有可选项，先添加几个再抽。</Text>
            )}

            <View className='action-links'>
              <Text
                className='action-link'
                onClick={() => {
                  if (isPicking) return
                  const target = templates.find((item) => item.id === activeTemplateId) || templates[0]
                  resetPickState({
                    activeTemplateTitle: target.title,
                    activeTemplateDesc: target.desc,
                    optionInput: '',
                    options: cloneTemplateOptions(target.id),
                  })
                }}
              >
                恢复模板
              </Text>
            </View>
          </View>

          <View className='result-card'>
            <View className='result-head'>
              <Text className='result-label'>抽选结果</Text>
              <Text className='result-badge'>
                {isPicking ? '抽选中' : hasResult ? '已决定' : '点击开始'}
              </Text>
            </View>
            <View className='reel-shell' onClick={onPick}>
              <View className='reel-window'>
                {reelItems.length ? <View className='reel-highlight' /> : null}
                {reelItems.length ? (
                  <View
                    className='reel-track'
                    style={{
                      transform: `translateY(${reelOffset}px)`,
                      transitionDuration: `${reelDuration}ms`,
                    }}
                  >
                    {reelItems.map((item) => (
                      <View key={item.id} className='reel-item'>
                        {item.label}
                      </View>
                    ))}
                  </View>
                ) : hasResult ? (
                  <View className='result-value-center'>{resultText}</View>
                ) : (
                  <View className='result-empty-center'>点击这里开始抽取</View>
                )}
              </View>
            </View>
            <Text className='detail-desc'>
              {hasResult
                ? '这次先听它的。要是不服，再点一次中间抽选窗口。'
                : isPicking
                  ? '正在上下滚动抽选，马上停下来。'
                  : '点击中间抽选窗口直接开始。'}
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  )
}
