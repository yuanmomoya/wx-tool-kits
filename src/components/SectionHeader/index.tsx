import { Text, View } from '@tarojs/components'

import './SectionHeader.scss'

export interface SectionHeaderProps {
  title: string
  moreText?: string
  onMore?: () => void
  className?: string
}

export default function SectionHeader({
  title,
  moreText,
  onMore,
  className = '',
}: SectionHeaderProps) {
  return (
    <View className={`section-header ${className}`}>
      <Text className='section-header__title'>{title}</Text>
      {moreText ? (
        <View className='section-header__more' onClick={onMore}>
          <Text>{moreText}</Text>
          <Text className='section-header__chevron'>›</Text>
        </View>
      ) : null}
    </View>
  )
}
