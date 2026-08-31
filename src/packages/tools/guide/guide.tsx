import { ScrollView, Text, View } from '@tarojs/components'
import { useShareAppMessage, useShareTimeline } from '@tarojs/taro'

import NavigationBar from '@/components/NavigationBar'
import ToolIntroCard from '@/packages/tools/components/ToolIntroCard'

import './guide.scss'

const quickSteps = [
  {
    number: '1',
    title: '先找到工具',
    desc: '首页可以直接点主推或热门工具。没看到想要的，就点搜索框，输入“压缩、长图、房贷、日期”等关键词。',
  },
  {
    number: '2',
    title: '按页面提示填写',
    desc: '需要图片就先选图片，需要计算就填写数字。带“可选”的内容可以先不填，必填内容没填完时按钮会保持灰色。',
  },
  {
    number: '3',
    title: '点击开始处理',
    desc: '确认设置后点击蓝色按钮。图片较大、视频较长时会多等一会儿，处理过程中不要连续点击。',
  },
  {
    number: '4',
    title: '保存处理结果',
    desc: '图片和视频处理完成后，可以保存到手机相册，再由你自行使用。',
  },
]

const mediaSteps = [
  {
    title: '从哪里选文件？',
    desc: '图片工具可以从手机相册选择，也可以直接拍照；视频工具请按页面提示选择来源。',
  },
  {
    title: '怎么直接拍照？',
    desc: '在图片选择菜单中点击“拍摄照片”，拍摄完成并确认后即可继续处理。',
  },
  {
    title: '为什么保存失败？',
    desc: '第一次保存时需要允许访问相册。如果之前点了拒绝，请到微信设置中重新开启相册权限。',
  },
]

const categoryTips = [
  {
    title: '图片与视频',
    desc: '适合压缩文件、调整尺寸、加水印、拼接长图、切九宫格和生成二维码。处理前先看清格式、尺寸和数量提示。',
  },
  {
    title: '生活计算',
    desc: '适合快速估算房贷、工资、养老金、日期和商品单价。结果用于参考，实际金额和政策口径以官方信息为准。',
  },
  {
    title: '日常小助手',
    desc: '选择困难、单位换算、校准尺子和打牌记账都在搜索页里。直接搜索名称会比翻列表更快。',
  },
  {
    title: '官方服务入口',
    desc: '电子社保卡、12333 等入口会跳转到对应官方小程序，返回后仍可继续使用当前工具箱。',
  },
]

const commonQuestions = [
  {
    question: '按钮为什么点不了？',
    answer: '通常是必填内容还没填、图片还没选，或者上一次处理还没结束。看看页面上的灰色提示，补齐后按钮会自动变蓝。',
  },
  {
    question: '我的图片和视频会被上传吗？',
    answer: '图片会临时上传到微信云环境进行内容安全检测，检测后立即删除；图片加工和视频处理在手机本地完成，结果只提供保存到相册。',
  },
  {
    question: '计算结果一定准确吗？',
    answer: '计算工具适合快速估算和比较。房贷、工资、退休等结果会受地区、时间和政策影响，办理业务时请以合同或官方结果为准。',
  },
  {
    question: '换手机后记录还在吗？',
    answer: '打牌记账等本地记录只保存在当前设备和当前微信环境。清理微信数据、重装小程序或换手机后，记录可能无法恢复。',
  },
  {
    question: '搜索为什么没有网页结果？',
    answer: '这里的搜索只用来找工具箱中已有的功能，不会联网搜索网页。可以换一个更短的关键词再试。',
  },
]

export default function GuidePage() {
  useShareAppMessage(() => ({
    title: '全能工具箱新手指南：四步学会使用',
    path: '/packages/tools/guide/guide',
  }))

  useShareTimeline(() => ({
    title: '全能工具箱新手指南',
  }))

  return (
    <View className='shell'>
      <NavigationBar title='新手必读' background='var(--s-1-weak, #f5f7fa)' />
      <ScrollView className='page-scroll' scrollY enhanced showScrollbar={false}>
        <View className='page'>
          <ToolIntroCard
            title='四步就能用'
            description='找到工具、填好内容、开始处理、保存结果。大多数功能都按这个顺序操作。'
          />

          <View className='card'>
            <Text className='card__title'>最简单的使用方法</Text>
            <View className='step-list'>
              {quickSteps.map((item) => (
                <View key={item.number} className='step-row'>
                  <View className='step-number'>{item.number}</View>
                  <View className='step-copy'>
                    <Text className='step-title'>{item.title}</Text>
                    <Text className='step-desc'>{item.desc}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          <View className='card'>
            <Text className='card__title'>处理图片和视频</Text>
            <Text className='card__lead'>相册、拍摄和处理结果，都在这里说明。</Text>
            <View className='plain-list'>
              {mediaSteps.map((item) => (
                <View key={item.title} className='plain-row'>
                  <Text className='plain-title'>{item.title}</Text>
                  <Text className='plain-desc'>{item.desc}</Text>
                </View>
              ))}
            </View>
          </View>

          <View className='card'>
            <Text className='card__title'>不同工具怎么用</Text>
            <View className='category-list'>
              {categoryTips.map((item) => (
                <View key={item.title} className='category-row'>
                  <Text className='category-title'>{item.title}</Text>
                  <Text className='category-desc'>{item.desc}</Text>
                </View>
              ))}
            </View>
          </View>

          <View className='card'>
            <Text className='card__title'>遇到问题先看这里</Text>
            <View className='faq-list'>
              {commonQuestions.map((item) => (
                <View key={item.question} className='faq-row'>
                  <Text className='faq-question'>{item.question}</Text>
                  <Text className='faq-answer'>{item.answer}</Text>
                </View>
              ))}
            </View>
          </View>

          <View className='notice-card'>
            <Text className='notice-card__title'>放心使用</Text>
            <Text className='notice-card__text'>图片会先进行内容安全检测，加工和视频处理在本地完成；计算结果只作参考；重要记录请自己留好备份。</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  )
}
