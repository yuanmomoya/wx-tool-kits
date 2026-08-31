import { useState } from 'react'
import { Picker, ScrollView, Text, View } from '@tarojs/components'
import { useShareAppMessage, useShareTimeline } from '@tarojs/taro'

import NavigationBar from '@/components/NavigationBar'
import ToolIntroCard from '@/packages/tools/components/ToolIntroCard'
import { getZodiac } from './zodiac.logic'

import './zodiac.scss'

type Zodiac = {
  id: string
  name: string
  enName: string
  range: string
  start: string
  end: string
  icon: string
  element: string
  ruler: string
  keywords: string[]
  luckyColor: string
  desc: string
}

const zodiacList: Zodiac[] = [
  {
    id: 'capricorn',
    name: '摩羯座',
    enName: 'Capricorn',
    range: '12.22 - 01.19',
    start: '12-22',
    end: '01-19',
    icon: '♑',
    element: '土象星座',
    ruler: '土星',
    keywords: ['踏实', '自律', '目标感', '可靠', '长期主义'],
    luckyColor: '岩石棕',
    desc: '摩羯座通常给人沉稳、可靠的印象，做事有节奏，也很清楚自己想把事情做到什么程度。你们的优势往往不在“瞬间爆发”，而在持续投入、稳步推进和把目标真正落到结果上。很多时候，别人觉得难坚持的事，摩羯反而能一步一步做成。',
  },
  {
    id: 'aquarius',
    name: '水瓶座',
    enName: 'Aquarius',
    range: '01.20 - 02.18',
    start: '01-20',
    end: '02-18',
    icon: '♒',
    element: '风象星座',
    ruler: '天王星',
    keywords: ['独立', '新奇', '理性', '有主见', '思路开阔'],
    luckyColor: '湖水蓝绿',
    desc: '水瓶座通常有很强的独立思考能力，面对问题时不太愿意照搬标准答案，更擅长从新角度找到突破口。你们往往理性、清醒，也有自己的边界感和判断标准。很多人和事在你们这里，会因为视角不同而被看得更透、更远。',
  },
  {
    id: 'pisces',
    name: '双鱼座',
    enName: 'Pisces',
    range: '02.19 - 03.20',
    start: '02-19',
    end: '03-20',
    icon: '♓',
    element: '水象星座',
    ruler: '海王星',
    keywords: ['共情', '浪漫', '想象力', '温柔', '感受力强'],
    luckyColor: '雾海蓝',
    desc: '双鱼座通常细腻、柔软，也很有想象力，能够很快感知到环境里的情绪变化。你们的优点不只是“感性”，而是很会理解人、安抚人，也容易把普通日子过出一点诗意和故事感。很多时候，双鱼的体贴和共情，正是关系里最难得的部分。',
  },
  {
    id: 'aries',
    name: '白羊座',
    enName: 'Aries',
    range: '03.21 - 04.19',
    start: '03-21',
    end: '04-19',
    icon: '♈',
    element: '火象星座',
    ruler: '火星',
    keywords: ['直接', '行动力', '热情', '果断', '有冲劲'],
    luckyColor: '炽焰红',
    desc: '白羊座通常很有冲劲，遇到想做的事情时反应快、启动也快，不喜欢在原地犹豫太久。你们的魅力在于直接、真诚和有感染力，能把周围人的节奏都带起来。很多新机会、新计划，往往都是白羊最先迈出第一步。',
  },
  {
    id: 'taurus',
    name: '金牛座',
    enName: 'Taurus',
    range: '04.20 - 05.20',
    start: '04-20',
    end: '05-20',
    icon: '♉',
    element: '土象星座',
    ruler: '金星',
    keywords: ['稳定', '审美', '耐心', '务实', '有品位'],
    luckyColor: '橄榄青绿',
    desc: '金牛座通常稳定、耐心，也很懂得什么是真正值得长期投入的东西。你们重视品质、节奏和安全感，不喜欢表面的热闹，更看重真实可持续的价值。无论是生活还是关系，金牛往往都能把普通日常经营得很扎实，也很有质感。',
  },
  {
    id: 'gemini',
    name: '双子座',
    enName: 'Gemini',
    range: '05.21 - 06.21',
    start: '05-21',
    end: '06-21',
    icon: '♊',
    element: '风象星座',
    ruler: '水星',
    keywords: ['好奇', '表达', '灵活', '反应快', '会聊天'],
    luckyColor: '柠檬黄',
    desc: '双子座通常聪明、灵活，反应很快，对信息和变化非常敏感。你们擅长表达，也擅长理解不同的人和不同的语境，所以很容易在沟通、学习和连接新事物上展现优势。和双子相处，常常会感受到轻松、有趣和脑子转得很快的那种魅力。',
  },
  {
    id: 'cancer',
    name: '巨蟹座',
    enName: 'Cancer',
    range: '06.22 - 07.22',
    start: '06-22',
    end: '07-22',
    icon: '♋',
    element: '水象星座',
    ruler: '月亮',
    keywords: ['温柔', '守护', '细腻', '有分寸', '重感情'],
    luckyColor: '月光白',
    desc: '巨蟹座通常很重感情，也很懂得照顾人。你们不一定总把关心挂在嘴边，但常常会通过细节、分寸和行动去让别人感到安心。巨蟹的强项在于建立温度和归属感，让关系变得稳妥、柔和，也更有被珍惜的感觉。',
  },
  {
    id: 'leo',
    name: '狮子座',
    enName: 'Leo',
    range: '07.23 - 08.22',
    start: '07-23',
    end: '08-22',
    icon: '♌',
    element: '火象星座',
    ruler: '太阳',
    keywords: ['自信', '热烈', '表现力', '大方', '有感染力'],
    luckyColor: '暖金色',
    desc: '狮子座通常自信、大方，也很有感染力，天生就带一点“被看见”的能量。你们在很多场合都能自然成为焦点，不只是因为外放，更因为做事有气场、对人也有热度。狮子的闪光点在于愿意发光，也愿意照亮身边的人。',
  },
  {
    id: 'virgo',
    name: '处女座',
    enName: 'Virgo',
    range: '08.23 - 09.22',
    start: '08-23',
    end: '09-22',
    icon: '♍',
    element: '土象星座',
    ruler: '水星',
    keywords: ['细致', '秩序', '分析', '靠谱', '执行力强'],
    luckyColor: '亚麻白',
    desc: '处女座通常认真、细致，也很擅长把复杂事情拆解清楚。你们的价值常常体现在细节里，别人没注意到的问题、流程中的漏洞、可以优化的小环节，处女座往往一眼就能看出来。很多事情因为你们的认真，会变得更顺、更稳、更值得信任。',
  },
  {
    id: 'libra',
    name: '天秤座',
    enName: 'Libra',
    range: '09.23 - 10.23',
    start: '09-23',
    end: '10-23',
    icon: '♎',
    element: '风象星座',
    ruler: '金星',
    keywords: ['平衡', '审美', '社交', '体面', '会协调'],
    luckyColor: '雾粉色',
    desc: '天秤座通常有很强的平衡感，既懂审美，也懂分寸，在人与人的相处中往往显得自然又舒服。你们很会协调气氛，也很会照顾场面，让不同的人都能被妥善安放。天秤的魅力在于温和、得体，以及一种让人愿意靠近的舒服感。',
  },
  {
    id: 'scorpio',
    name: '天蝎座',
    enName: 'Scorpio',
    range: '10.24 - 11.22',
    start: '10-24',
    end: '11-22',
    icon: '♏',
    element: '水象星座',
    ruler: '冥王星',
    keywords: ['敏锐', '专注', '深度', '有力量', '洞察强'],
    luckyColor: '深酒红',
    desc: '天蝎座通常很有洞察力，能够快速抓到重点，也很擅长看见表面之下真正重要的东西。你们一旦认定目标，就容易进入非常深的专注状态，行动力和韧性都很强。天蝎的吸引力，往往来自那种安静但有力量的存在感。',
  },
  {
    id: 'sagittarius',
    name: '射手座',
    enName: 'Sagittarius',
    range: '11.23 - 12.21',
    start: '11-23',
    end: '12-21',
    icon: '♐',
    element: '火象星座',
    ruler: '木星',
    keywords: ['自由', '乐观', '探索', '坦率', '视野开阔'],
    luckyColor: '星云紫',
    desc: '射手座通常开放、坦率，也很有探索欲，喜欢把眼光放远，不愿意被太小的边界困住。你们身上常有一种轻快的生命力，对未知保持兴趣，对新鲜世界保持热情。很多时候，射手最打动人的地方，就是那种真诚、明亮又向前看的状态。',
  },
]

const today = new Date()
const maxDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

const toDateValue = (monthDay: string) => Number(monthDay.replace('-', ''))

const formatBirthdayText = (dateValue: string) => {
  const [, month, day] = String(dateValue).split('-')
  return `${month}.${day} 出生`
}

const isDateInRange = (monthDay: string, start: string, end: string) => {
  const value = toDateValue(monthDay)
  const startValue = toDateValue(start)
  const endValue = toDateValue(end)
  if (startValue <= endValue) return value >= startValue && value <= endValue
  return value >= startValue || value <= endValue
}

const getZodiacByDate = (dateValue: string) => {
  const [, month, day] = String(dateValue).split('-')
  const name = getZodiac(Number(month), Number(day))
  return zodiacList.find((item) => item.name === name) || zodiacList[0]
}

export default function ZodiacPage() {
  const [birthday, setBirthday] = useState('')
  const [birthdayText, setBirthdayText] = useState('')
  const [hasResult, setHasResult] = useState(false)
  const [zodiac, setZodiac] = useState<Zodiac | null>(null)

  useShareAppMessage(() => ({
    title: '输入公历生日，快速查询自己的星座',
    path: '/packages/tools/zodiac/zodiac',
  }))

  useShareTimeline(() => ({
    title: '星座计算器：按阳历生日一查就知道',
  }))

  const onDateChange = (value: string) => {
    setBirthday(value)
    setBirthdayText(formatBirthdayText(value))
    setHasResult(true)
    setZodiac(getZodiacByDate(value))
  }

  return (
    <View className='shell'>
      <NavigationBar title='星座查询' background='var(--s-1-weak, #f5f7fa)' />
      <ScrollView className='page-scroll' scrollY enhanced showScrollbar={false}>
        <View className='page'>
          <ToolIntroCard
            title='输入生日查询星座'
            description='按公历生日匹配十二星座，并查看对应日期范围。'
          />

          <View className='card'>
            <Text className='card__title'>选择公历生日</Text>
            <Picker mode='date' value={birthday || maxDate} end={maxDate} onChange={(e) => onDateChange(e.detail.value)}>
              <View className='field-row'>
                <View className='field-main'>
                  <Text className='field-label'>出生日期</Text>
                  <Text className={`picker-value ${birthday ? '' : 'is-placeholder'}`}>
                    {birthday || '请选择出生日期'}
                  </Text>
                </View>
              </View>
            </Picker>
          </View>

          <View className='result-card'>
            {hasResult && zodiac ? (
              <>
                <View className='result-head'>
                  <View>
                    <Text className='result-label'>{birthdayText}</Text>
                    <Text className='result-value'>{zodiac.name}</Text>
                    <Text className='helper-note'>
                      {zodiac.enName} · {zodiac.range}
                    </Text>
                  </View>
                  <Text className='zodiac-icon'>{zodiac.icon}</Text>
                </View>
                <View className='summary-grid'>
                  <View className='summary-item'>
                    <Text className='summary-label'>元素</Text>
                    <Text className='summary-value'>{zodiac.element}</Text>
                  </View>
                  <View className='summary-item'>
                    <Text className='summary-label'>守护星</Text>
                    <Text className='summary-value'>{zodiac.ruler}</Text>
                  </View>
                </View>
                <View className='detail-row'>
                  <Text className='detail-label'>幸运色</Text>
                  <Text className='detail-value'>{zodiac.luckyColor}</Text>
                </View>
                <View className='keyword-row'>
                  {zodiac.keywords.map((item) => (
                    <Text key={item} className='keyword-chip'>
                      {item}
                    </Text>
                  ))}
                </View>
                <Text className='detail-desc'>{zodiac.desc}</Text>
                <Text
                  className='reset-link'
                  onClick={() => {
                    setBirthday('')
                    setBirthdayText('')
                    setHasResult(false)
                    setZodiac(null)
                  }}
                >
                  重新选择
                </Text>
              </>
            ) : (
              <Text className='result-empty'>选择出生日期后，这里会显示对应星座和简介。</Text>
            )}
          </View>

          <View className='card'>
            <Text className='card__title'>十二星座速览</Text>
            <View className='zodiac-list'>
              {zodiacList.map((item) => (
                <View key={item.id} className='zodiac-item'>
                  <Text className='zodiac-name'>
                    {item.icon} {item.name}
                  </Text>
                  <Text className='zodiac-range'>{item.range}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  )
}
