/**
 * 微信平台能力适配：选图（相册/拍照）、预览、保存相册。
 * 本地版不依赖远程下载。
 */
import Taro from '@tarojs/taro'

import { LocalImage, SUPPORTED_INPUT } from '@/types/compress'
import { guessFormat } from '@/utils/format'
import { chooseImages } from '@/utils/image-picker'

const MAX_BYTES = 50 * 1024 * 1024

function normalizeFormat(fmt?: string): string {
  return (fmt || '').toLowerCase().replace(/^jpeg$/, 'jpg').replace(/^\./, '')
}

/** 将临时路径整理为 LocalImage（含 50MB / 格式校验与尺寸读取） */
async function toLocalImage(
  path: string,
  size: number,
  nameHint?: string,
  width?: number,
  height?: number,
): Promise<LocalImage | null> {
  if (size > MAX_BYTES) {
    Taro.showToast({ title: '图片超过 50MB，请选择更小的文件。', icon: 'none' })
    return null
  }

  const name = nameHint || path.split('/').pop() || `image_${Date.now()}.jpg`
  let w = width
  let h = height
  let typeHint = ''
  try {
    const info = await Taro.getImageInfo({ src: path })
    w = info.width
    h = info.height
    typeHint = info.type || ''
  } catch {
    // 尺寸读取失败仍允许继续，后续压缩会再校验
  }

  const fromName = normalizeFormat(guessFormat(name))
  const fromType = normalizeFormat(typeHint)
  let format = ''
  if (SUPPORTED_INPUT.has(fromName)) format = fromName === 'jpeg' ? 'jpg' : fromName
  else if (SUPPORTED_INPUT.has(fromType)) format = fromType === 'jpeg' ? 'jpg' : fromType

  if (!format) {
    Taro.showToast({ title: '本地版仅支持 JPG、PNG', icon: 'none' })
    return null
  }

  return {
    path,
    size,
    name,
    width: w,
    height: h,
    format: format === 'jpg' ? 'JPG' : 'PNG',
  }
}

/**
 * 兼容旧调用方的单图入口；实际选图统一走带内容安全校验的 chooseImages。
 * 取消选择不提示；失败给出明确 Toast。
 */
export async function chooseImage(): Promise<LocalImage | null> {
  try {
    const [file] = await chooseImages({ count: 1, sizeType: ['original'] })
    if (!file) return null
    const name = file.tempFilePath.split('/').pop() || `image_${Date.now()}.jpg`
    return toLocalImage(file.tempFilePath, file.size, name, file.width, file.height)
  } catch (e: any) {
    if (e?.errMsg?.includes('cancel')) return null
    Taro.showToast({ title: '选择图片失败', icon: 'none' })
    return null
  }
}

/** 系统预览大图 */
export async function previewImage(url: string) {
  await Taro.previewImage({ urls: [url], current: url })
}

/** 保存到相册；拒绝权限时引导打开设置 */
export async function saveToAlbum(filePath: string): Promise<void> {
  try {
    await Taro.saveImageToPhotosAlbum({ filePath })
    Taro.showToast({ title: '已保存到相册', icon: 'success' })
  } catch (e: any) {
    const msg = e?.errMsg || ''
    if (msg.includes('auth deny') || msg.includes('authorize')) {
      const { confirm } = await Taro.showModal({
        title: '需要相册权限',
        content: '请在小程序设置中开启相册权限后重新保存。',
        confirmText: '去设置',
      })
      if (confirm) {
        await Taro.openSetting()
      }
      return
    }
    Taro.showToast({ title: '保存失败，请重试', icon: 'none' })
  }
}
