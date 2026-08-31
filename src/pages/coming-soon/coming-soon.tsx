import { Text, View } from '@tarojs/components'
import { useRouter } from '@tarojs/taro'

import NavigationBar from '@/components/NavigationBar'

import './coming-soon.scss'

export default function ComingSoonPage() {
  const router = useRouter()
  const title = decodeURIComponent(router.params.title || '该工具')

  return (
    <View className='shell'>
      <NavigationBar title='迁移中' background='var(--s-1-weak, #f5f7fa)' />
      <View className='card'>
        <Text className='card__badge'>即将上线</Text>
        <Text className='card__title'>{title}</Text>
        <Text className='card__desc'>
          该工具正在从原生工程迁移到 Taro + Skyline。首页与搜索已可用，功能页将按计划分批上线。
        </Text>
      </View>
    </View>
  )
}
