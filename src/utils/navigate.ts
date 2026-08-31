/**
 * 打开工具：外链短链 / 站内页面。全量迁移后优先直接 navigate。
 */
import Taro from '@tarojs/taro'

import { migratedPaths } from '@/utils/tool-catalog'

export function openMiniProgram(name: string, shortLink?: string) {
  if (!shortLink) {
    Taro.showToast({ title: `${name} 还没配置好`, icon: 'none' })
    return
  }

  Taro.navigateToMiniProgram({
    shortLink,
    fail: (error) => {
      if (String(error.errMsg || '').includes('cancel')) return
      Taro.showToast({ title: '跳转失败，请稍后再试', icon: 'none' })
    },
  })
}

export function openTool(opts: {
  name: string
  path?: string
  shortLink?: string
}) {
  const { name, path, shortLink } = opts

  if (shortLink) {
    openMiniProgram(name, shortLink)
    return
  }

  if (!path) {
    Taro.showToast({ title: `${name} 即将上线`, icon: 'none' })
    return
  }

  if (migratedPaths.has(path)) {
    Taro.navigateTo({ url: path })
    return
  }

  Taro.navigateTo({
    url: `/pages/coming-soon/coming-soon?title=${encodeURIComponent(name)}`,
  })
}
