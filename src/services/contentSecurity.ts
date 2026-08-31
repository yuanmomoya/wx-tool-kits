import Taro from '@tarojs/taro'

import { CLOUD_ENV_ID, IMAGE_SECURITY_FUNCTION } from '@/config/cloud'
import type { ChosenImageFile } from '@/utils/image-picker'

const SECURITY_COPY_MAX_BYTES = 950 * 1024
const RISK_MESSAGE = '所发布内容含违规信息'
const CHECK_FAILED_MESSAGE = '图片安全检测失败，请重试'

type ImageSecurityResult = {
  pass?: boolean
  reason?: 'risky' | 'service_error'
}

const getFileSize = async (filePath: string): Promise<number> => {
  const result = await Taro.getFileInfo({ filePath })
  if ('size' in result) return result.size
  throw new Error('failed to read security copy size')
}

const createSecurityCopy = async (file: ChosenImageFile): Promise<string> => {
  if (file.size > 0 && file.size <= SECURITY_COPY_MAX_BYTES) {
    return file.tempFilePath
  }

  let width: number | undefined = file.width
  let height: number | undefined = file.height

  if (!width || !height) {
    try {
      const info = await Taro.getImageInfo({ src: file.tempFilePath })
      width = info.width
      height = info.height
    } catch {
      // compressImage 仍可只指定目标宽度，按原比例压缩。
    }
  }

  const attempts = [
    { longEdge: 1600, quality: 70 },
    { longEdge: 1200, quality: 55 },
    { longEdge: 900, quality: 40 },
    { longEdge: 640, quality: 30 },
  ]

  for (const attempt of attempts) {
    const longSide = Math.max(width || attempt.longEdge, height || attempt.longEdge)
    const ratio = Math.min(1, attempt.longEdge / longSide)
    const compressed = await Taro.compressImage({
      src: file.tempFilePath,
      quality: attempt.quality,
      compressedWidth: width ? Math.max(1, Math.round(width * ratio)) : attempt.longEdge,
      ...(height ? { compressedHeight: Math.max(1, Math.round(height * ratio)) } : {}),
    })

    if ((await getFileSize(compressed.tempFilePath)) <= SECURITY_COPY_MAX_BYTES) {
      return compressed.tempFilePath
    }
  }

  throw new Error('security copy exceeds image security API limit')
}

const getPathExtension = (filePath: string) => {
  const matched = filePath.toLowerCase().match(/\.(png|jpe?g)(?:$|\?)/)
  return matched?.[1] === 'jpeg' ? 'jpg' : matched?.[1]
}

const getFileExtension = async (filePath: string): Promise<'jpg' | 'png'> => {
  const pathExtension = getPathExtension(filePath)
  if (pathExtension === 'jpg' || pathExtension === 'png') return pathExtension

  try {
    const info = await Taro.getImageInfo({ src: filePath })
    if (info.type?.toLowerCase() === 'png') return 'png'
  } catch {
    // 微信相册图片通常保留扩展名；无法读取时按 JPEG 检测。
  }
  return 'jpg'
}

const removeCloudFile = async (fileID: string) => {
  try {
    await Taro.cloud.deleteFile({
      fileList: [fileID],
      config: { env: CLOUD_ENV_ID },
    })
  } catch (error) {
    console.warn('[content-security] failed to remove temporary file', error)
  }
}

const checkOneImage = async (file: ChosenImageFile): Promise<ImageSecurityResult> => {
  const securityCopyPath = await createSecurityCopy(file)
  const extension = await getFileExtension(securityCopyPath)
  const cloudPath = `content-security/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`
  const uploadResult = await Taro.cloud.uploadFile({
    cloudPath,
    filePath: securityCopyPath,
    config: { env: CLOUD_ENV_ID },
  })

  try {
    const callResult = await Taro.cloud.callFunction({
      name: IMAGE_SECURITY_FUNCTION,
      data: { fileID: uploadResult.fileID },
      config: { env: CLOUD_ENV_ID },
    })
    return (callResult.result || {}) as ImageSecurityResult
  } finally {
    await removeCloudFile(uploadResult.fileID)
  }
}

/**
 * 所有图片工具的发布前安全闸门。
 * 任一图片违规或检测服务异常时均不向业务层返回图片，避免绕过检测。
 */
export const filterSafeImages = async (
  files: ChosenImageFile[],
): Promise<ChosenImageFile[]> => {
  if (!files.length) return []

  // 内容安全要求针对微信小程序；H5 构建没有 wx.cloud 能力。
  if (process.env.TARO_ENV && process.env.TARO_ENV !== 'weapp') {
    return files
  }

  Taro.showLoading({ title: '内容安全检测中', mask: true })

  try {
    for (const file of files) {
      const result = await checkOneImage(file)
      if (!result.pass) {
        Taro.hideLoading()
        Taro.showToast({
          title: result.reason === 'risky' ? RISK_MESSAGE : CHECK_FAILED_MESSAGE,
          icon: 'none',
        })
        return []
      }
    }

    Taro.hideLoading()
    return files
  } catch (error) {
    console.error('[content-security] image check failed', error)
    Taro.hideLoading()
    Taro.showToast({ title: CHECK_FAILED_MESSAGE, icon: 'none' })
    return []
  }
}
