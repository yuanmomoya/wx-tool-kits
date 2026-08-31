import { useState } from 'react'
import { Image, Input, ScrollView, Swiper, SwiperItem, Text, View } from '@tarojs/components'
import Taro, { useShareAppMessage, useShareTimeline } from '@tarojs/taro'

import NavigationBar from '@/components/NavigationBar'
import SectionHeader from '@/components/SectionHeader'
import ToolCard from '@/components/ToolCard'
import { openTool } from '@/utils/navigate'
import { featuredTools, hotTools, topicCards, type ToolItem } from '@/utils/tool-catalog'

import './index.scss'

const QUICK_TAGS = ['图片', '计算', '生活健康', '比价', '记账', '房贷', '星座']

export default function IndexPage() {
  const [keyword, setKeyword] = useState('')
  const [featuredIndex, setFeaturedIndex] = useState(0)

  useShareAppMessage(() => ({
    title: '日常要用的小工具，这里基本齐了',
    path: '/pages/index/index',
  }))

  useShareTimeline(() => ({
    title: '日常要用的小工具，这里基本齐了',
  }))

  const openSearch = (value: string) => {
    Taro.navigateTo({
      url: `/pages/search/search?keyword=${encodeURIComponent(value)}`,
    })
  }

  const onSearchConfirm = () => {
    const text = keyword.trim()
    if (!text) {
      Taro.showToast({ title: '请输入关键词', icon: 'none' })
      return
    }
    openSearch(text)
  }

  const onTool = (item: ToolItem) => {
    openTool({
      name: item.title,
      path: item.path,
      shortLink: item.shortLink,
    })
  }

  return (
    <View className='shell'>
      <NavigationBar title='' back={false} background='transparent' />
      <ScrollView className='page-scroll' scrollY enhanced showScrollbar={false}>
        <View className='page'>
          <View className='search-box'>
            <Input
              className='search-input'
              type='text'
              confirmType='search'
              placeholder='想用什么工具？搜一下'
              value={keyword}
              onInput={(e) => setKeyword(e.detail.value)}
              onConfirm={onSearchConfirm}
            />
          </View>

          <ScrollView className='quick-tags' scrollX enhanced showScrollbar={false}>
            <View className='quick-tags__inner'>
              {QUICK_TAGS.map((tag) => (
                <View key={tag} className='quick-tag' onClick={() => openSearch(tag)}>
                  <Text>{tag}</Text>
                </View>
              ))}
            </View>
          </ScrollView>

          {featuredTools.length ? (
            <View className='featured-carousel'>
              <Swiper
                className='featured-carousel__track'
                autoplay
                circular
                interval={4000}
                duration={450}
                current={featuredIndex}
                onChange={(event) => setFeaturedIndex(event.detail.current)}
              >
                {featuredTools.map((featured) => (
                  <SwiperItem key={featured.id} className='featured-carousel__item'>
                    <View
                      className='featured-card'
                      onClick={() => onTool(featured)}
                      hoverClass='featured-card--press'
                    >
                      <View className='featured-card__copy'>
                        <Text className='featured-card__badge'>主推工具</Text>
                        <Text className='featured-card__title'>{featured.title}</Text>
                        <Text className='featured-card__desc'>{featured.desc}</Text>
                        <Text className='featured-card__action'>立即体验 ›</Text>
                      </View>
                      <View className='featured-card__visual'>
                        <Image className='featured-card__image' src={featured.iconImage} mode='aspectFit' />
                      </View>
                    </View>
                  </SwiperItem>
                ))}
              </Swiper>
              <View className='featured-carousel__dots'>
                {featuredTools.map((item, index) => (
                  <View
                    key={item.id}
                    className={`featured-carousel__dot ${index === featuredIndex ? 'is-active' : ''}`}
                  />
                ))}
              </View>
            </View>
          ) : null}

          <SectionHeader title='热门工具' moreText='全部' onMore={() => openSearch('')} />

          <View className='tool-grid'>
            {hotTools.map((item) => (
              <ToolCard key={item.id} item={item} onClick={() => onTool(item)} />
            ))}
          </View>

          <SectionHeader title='精选专题' />

          <View className='topic-list'>
            {topicCards.map((item) => (
              <View
                key={item.id}
                className='topic-card'
                onClick={() => onTool(item)}
                hoverClass='topic-card--press'
              >
                <Image className='topic-card__image' src={item.iconImage} mode='aspectFit' />
                <View className='topic-card__copy'>
                  <Text className='topic-card__label'>{item.label}</Text>
                  <Text className='topic-card__title'>{item.title}</Text>
                  <Text className='topic-card__desc'>{item.desc}</Text>
                  <View className='topic-card__btn'>
                    <Text>{item.button || '查看'}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  )
}
