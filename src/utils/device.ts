import Taro from '@tarojs/taro'

export const getPlatform = () => {
  try {
    const deviceInfo = Taro.getDeviceInfo?.() as { platform?: string } | undefined
    if (deviceInfo?.platform) return String(deviceInfo.platform).toLowerCase()

    const systemInfo = Taro.getSystemInfoSync()
    return String(systemInfo.platform || '').toLowerCase()
  } catch {
    return ''
  }
}

export const isDesktopPlatform = () => {
  const platform = getPlatform()
  return ['windows', 'mac', 'devtools'].includes(platform)
}
