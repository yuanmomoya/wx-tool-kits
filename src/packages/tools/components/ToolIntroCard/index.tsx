import { Text, View } from '@tarojs/components'

import './ToolIntroCard.scss'

interface ToolIntroCardProps {
  title: string
  description: string
}

export default function ToolIntroCard({ title, description }: ToolIntroCardProps) {
  return (
    <View className='tool-intro-card'>
      <Text className='tool-intro-card__title'>{title}</Text>
      <Text className='tool-intro-card__description'>{description}</Text>
    </View>
  )
}
