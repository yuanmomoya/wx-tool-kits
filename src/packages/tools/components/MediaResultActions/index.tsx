import { Text, View } from '@tarojs/components'

import './MediaResultActions.scss'

export interface MediaResultActionsProps {
  available: boolean
  busy?: boolean
  title: string
  desc?: string
  saveText?: string
  onSave: () => void
}

export default function MediaResultActions({
  available,
  busy = false,
  title,
  desc = '结果只在本地处理',
  saveText = '保存到相册',
  onSave,
}: MediaResultActionsProps) {
  const enabled = available && !busy

  return (
    <View className='media-result-actions'>
      <View className='media-result-actions__copy'>
        <Text className='media-result-actions__title'>{title}</Text>
        <Text className='media-result-actions__desc'>{desc}</Text>
      </View>
      <View className='media-result-actions__buttons'>
        <View
          className={`media-result-action media-result-action--save ${enabled ? 'is-enabled' : ''}`}
          onClick={() => enabled && onSave()}
        >
          {busy ? '处理中…' : saveText}
        </View>
      </View>
    </View>
  )
}
