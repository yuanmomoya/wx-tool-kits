import { ReactNode, useMemo, useState } from 'react'
import { Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'

import './NavigationBar.scss'

export interface NavigationBarProps {
  title?: string
  background?: string
  color?: string
  back?: boolean
  homeButton?: boolean
  children?: ReactNode
}

function readLayout() {
  const rect = Taro.getMenuButtonBoundingClientRect()
  const windowInfo = (Taro.getWindowInfo?.() || Taro.getSystemInfoSync()) as {
    windowWidth: number
    safeArea?: { top?: number }
  }
  const device = (Taro.getDeviceInfo?.() || Taro.getSystemInfoSync()) as { platform?: string }
  const platform = device.platform || ''
  const isAndroid = platform === 'android'
  const isDevtools = platform === 'devtools'
  const windowWidth = windowInfo.windowWidth
  const top = windowInfo.safeArea?.top ?? 0

  return {
    ios: !isAndroid,
    innerPaddingRight: `padding-right: ${windowWidth - rect.left}px`,
    leftWidth: `width: ${windowWidth - rect.left}px`,
    safeAreaTop:
      isDevtools || isAndroid
        ? `height: calc(var(--nav-height, 44px) + ${top}px); padding-top: ${top}px`
        : '',
  }
}

export default function NavigationBar({
  title = '',
  background = 'transparent',
  color = 'var(--c-33, #1f2329)',
  back = true,
  homeButton = false,
}: NavigationBarProps) {
  const layout = useMemo(() => readLayout(), [])
  const [showBack, setShowBack] = useState(false)
  const [showHome, setShowHome] = useState(false)

  useDidShow(() => {
    const pages = Taro.getCurrentPages()
    const canGoBack = Boolean(back && pages.length > 1)
    setShowBack(canGoBack)
    setShowHome(Boolean(homeButton || (back && !canGoBack)))
  })

  const onBack = () => {
    const pages = Taro.getCurrentPages()
    if (pages.length > 1) {
      Taro.navigateBack({ delta: 1 })
    } else {
      Taro.reLaunch({ url: '/pages/index/index' })
    }
  }

  const onHome = () => {
    Taro.reLaunch({ url: '/pages/index/index' })
  }

  return (
    <View className='nav-bar'>
      <View
        className={`nav-bar__inner ${layout.ios ? 'ios' : 'android'}`}
        style={`color: ${color}; background: ${background}; ${layout.innerPaddingRight}; ${layout.safeAreaTop};`}
      >
        <View className='nav-bar__left' style={layout.leftWidth}>
          {showBack ? (
            <View className='nav-bar__btn' onClick={onBack} hoverClass='nav-bar__btn--active'>
              <View className='nav-bar__back-icon' />
            </View>
          ) : null}
          {showHome ? (
            <View className='nav-bar__btn nav-bar__home' onClick={onHome} hoverClass='nav-bar__btn--active'>
              <Text className='nav-bar__home-text'>首页</Text>
            </View>
          ) : null}
        </View>
        <View className='nav-bar__center'>
          {title ? <Text className='nav-bar__title'>{title}</Text> : null}
        </View>
        <View className='nav-bar__right' />
      </View>
    </View>
  )
}
