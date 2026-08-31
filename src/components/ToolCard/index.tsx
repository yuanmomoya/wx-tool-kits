import { Image, Text, View } from '@tarojs/components'

import type { ToolItem } from '@/utils/tool-catalog'

import './ToolCard.scss'

export interface ToolCardProps {
  item: ToolItem
  onClick?: () => void
}

export default function ToolCard({ item, onClick }: ToolCardProps) {
  return (
    <View className='tool-card' onClick={onClick} hoverClass='tool-card--press'>
      <View className={`tool-card__icon ${item.iconBg === 'white' ? 'is-branded' : ''}`}>
        <Image className='tool-card__image' src={item.iconImage} mode='aspectFit' />
      </View>
      <View className='tool-card__copy'>
        <Text className='tool-card__title'>{item.title}</Text>
        <Text className='tool-card__desc'>{item.desc}</Text>
      </View>
    </View>
  )
}
