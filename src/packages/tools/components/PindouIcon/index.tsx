import { View } from '@tarojs/components'

import './PindouIcon.scss'

interface PindouIconProps {
  size?: string
}

export default function PindouIcon({ size = '108rpx' }: PindouIconProps) {
  return (
    <View className='pindou-icon' style={{ width: size, height: size }}>
      <View className='bead-row'>
        <View className='bead bead-one' />
        <View className='bead bead-two' />
      </View>
      <View className='bead-row'>
        <View className='bead bead-three' />
        <View className='bead bead-four' />
      </View>
    </View>
  )
}
