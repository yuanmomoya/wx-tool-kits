import { useMemo, useState } from 'react'
import { Input, ScrollView, Text, View } from '@tarojs/components'
import { useLoad } from '@tarojs/taro'

import NavigationBar from '@/components/NavigationBar'
import ToolCard from '@/components/ToolCard'
import { openTool } from '@/utils/navigate'
import { searchTools, type ToolItem } from '@/utils/tool-catalog'

import './search.scss'

const SEARCH_GROUP_MAP: Record<string, string> = {
  restaurant: '经营测算',
  mortgage: '财务社保',
  salary: '财务社保',
  'retirement-pension': '财务社保',
  'retirement-age': '财务社保',
  compound: '理财计算',
  'price-compare': '日常计算',
  converter: '日常计算',
  'date-diff': '日常计算',
  'shelf-life': '日常计算',
  relationship: '生活辅助',
  'choice-helper': '生活辅助',
  'poker-ledger': '棋牌记账',
}

const SEARCH_GROUP_ORDER = [
  '财务社保',
  '日常计算',
  '图片处理',
  '视频处理',
  '生活健康',
  '生活辅助',
  '理财计算',
  '经营测算',
  '棋牌记账',
  '生活娱乐',
  '民生服务',
  '使用指南',
]

const SEARCH_ITEM_ORDER: Record<string, number> = {
  'national-service-platform': 0,
  'social-security-card': 1,
  'service-12333': 2,
}

const SUGGESTIONS = ['社保', '图片处理', '生活健康', '餐饮开店']

function getDisplayGroup(item: ToolItem) {
  return SEARCH_GROUP_MAP[item.id] || item.category || '其他工具'
}

function groupResults(results: ToolItem[]) {
  const groupMap: Record<string, { category: string; items: ToolItem[] }> = {}
  const groups: { category: string; items: ToolItem[] }[] = []

  results.forEach((item) => {
    const category = getDisplayGroup(item)
    if (!groupMap[category]) {
      groupMap[category] = { category, items: [] }
      groups.push(groupMap[category])
    }
    groupMap[category].items.push(item)
  })

  groups.forEach((group) => {
    group.items.sort((left, right) => {
      const leftOrder = SEARCH_ITEM_ORDER[left.id] ?? 100
      const rightOrder = SEARCH_ITEM_ORDER[right.id] ?? 100
      return leftOrder - rightOrder
    })
  })

  return groups.sort((left, right) => {
    const li = SEARCH_GROUP_ORDER.indexOf(left.category)
    const ri = SEARCH_GROUP_ORDER.indexOf(right.category)
    return (li === -1 ? 999 : li) - (ri === -1 ? 999 : ri)
  })
}

export default function SearchPage() {
  const [inputValue, setInputValue] = useState('')
  const [queryText, setQueryText] = useState('')

  useLoad((options) => {
    const keyword = decodeURIComponent(options.keyword || '')
    setInputValue(keyword)
    setQueryText(keyword.trim())
  })

  const groupedResults = useMemo(
    () => groupResults(searchTools(queryText)),
    [queryText],
  )

  const applyKeyword = (value: string) => {
    const next = (value || '').trim()
    setInputValue(next)
    setQueryText(next)
  }

  return (
    <View className='shell'>
      <NavigationBar title='搜索工具' background='var(--s-1-weak, #f5f7fa)' />
      <View className='search-bar'>
        <Input
          className='search-input'
          type='text'
          confirmType='search'
          placeholder='搜索工具名称、分类或关键词'
          value={inputValue}
          onInput={(e) => {
            const value = e.detail.value || ''
            setInputValue(value)
            setQueryText(value.trim())
          }}
          onConfirm={(e) => applyKeyword(e.detail.value)}
        />
      </View>

      <ScrollView className='page-scroll' scrollY enhanced showScrollbar={false}>
        <View className='page'>
          {!queryText ? (
            <View className='suggest-block'>
              <Text className='suggest-title'>试试这些</Text>
              <View className='suggest-list'>
                {SUGGESTIONS.map((keyword) => (
                  <View key={keyword} className='suggest-chip' onClick={() => applyKeyword(keyword)}>
                    <Text>{keyword}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {groupedResults.length === 0 ? (
            <View className='empty'>
              <Text className='empty__title'>没有找到相关工具</Text>
              <Text className='empty__desc'>换个关键词，或返回首页看看热门入口</Text>
            </View>
          ) : (
            groupedResults.map((group) => (
              <View key={group.category} className='result-group'>
                <Text className='result-group__title'>
                  {group.category}
                  <Text className='result-group__count'> {group.items.length}</Text>
                </Text>
                <View className='tool-grid'>
                  {group.items.map((item) => (
                    <ToolCard
                      key={item.id}
                      item={item}
                      onClick={() =>
                        openTool({
                          name: item.title,
                          path: item.path,
                          shortLink: item.shortLink,
                        })
                      }
                    />
                  ))}
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  )
}
