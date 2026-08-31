import Taro from '@tarojs/taro'

import { filterSafeImages } from '@/services/contentSecurity'
import { ensurePrivacyAuthorize } from '@/utils/image-save'

const DEFAULT_SIZE_TYPE: Array<'original' | 'compressed'> = ['original']
const DEFAULT_SOURCE_TYPE: Array<'album' | 'camera'> = ['album', 'camera']

export type ChosenImageFile = {
  tempFilePath: string
  size: number
  width?: number
  height?: number
  fileType?: string
}

export type ChooseImagesOptions = {
  count?: number
  sizeType?: Array<'original' | 'compressed'>
  sourceType?: Array<'album' | 'camera'>
}

const getErrorMessage = (error: unknown) =>
  String((error as { errMsg?: string; message?: string })?.errMsg || (error as { message?: string })?.message || '').toLowerCase()

const getChooseImageErrorMessage = (error: unknown) => {
  const errMsg = getErrorMessage(error)

  if (errMsg.includes('cancel')) return ''

  if (
    errMsg.includes('privacy api banned') ||
    errMsg.includes('privacy interface is banned') ||
    errMsg.includes('api scope is not declared in the privacy agreement') ||
    errMsg.includes('interface is not declared in the privacy agreement')
  ) {
    return '小程序隐私指引未声明图片选择权限'
  }

  if (
    errMsg.includes('privacy permission is not authorized') ||
    errMsg.includes('require privacy authorize')
  ) {
    return '请先同意小程序隐私保护指引'
  }

  if (
    errMsg.includes('permission') ||
    errMsg.includes('auth') ||
    errMsg.includes('deny') ||
    errMsg.includes('denied')
  ) {
    return '相册或相机权限未开启'
  }

  if (errMsg.includes('system') || errMsg.includes('camera') || errMsg.includes('album')) {
    return '系统暂时无法打开相册或相机，请重试'
  }

  return '选择图片失败，请重试'
}

const showError = (title: string) => {
  Taro.showToast({ title, icon: 'none' })
}

const handleChooseFailure = (
  error: unknown,
  resolve: (files: ChosenImageFile[]) => void,
  source = 'media',
) => {
  const userMessage = getChooseImageErrorMessage(error)
  if (userMessage) {
    console.error(`[image-picker] choose from ${source} failed`, error)
    showError(userMessage)
  }
  resolve([])
}

const chooseFromMedia = ({
  count,
  sizeType,
  sourceType,
}: Required<ChooseImagesOptions>): Promise<ChosenImageFile[]> =>
  new Promise((resolve) => {
    try {
      Taro.chooseMedia({
        count,
        mediaType: ['image'],
        sizeType,
        sourceType,
        success: (res) => {
          const files = (Array.isArray(res?.tempFiles) ? res.tempFiles : []) as ChosenImageFile[]
          if (!files.length) showError('未获取到图片，请重试')
          resolve(files)
        },
        fail: (error) => handleChooseFailure(error, resolve, sourceType[0]),
      })
    } catch (error) {
      handleChooseFailure(error, resolve, sourceType[0])
    }
  })

/** 统一图片入口：从相册选择或拍摄照片。 */
export const chooseImages = async (
  options: ChooseImagesOptions = {},
): Promise<ChosenImageFile[]> => {
  const count =
    Number.isInteger(options.count) && (options.count as number) > 0
      ? (options.count as number)
      : 1
  const sizeType =
    Array.isArray(options.sizeType) && options.sizeType.length
      ? options.sizeType
      : DEFAULT_SIZE_TYPE
  const sourceType =
    Array.isArray(options.sourceType) && options.sourceType.length
      ? options.sourceType
      : DEFAULT_SOURCE_TYPE

  const actions: Array<{ label: string; type: 'album' | 'camera' }> = []
  if (sourceType.includes('album')) actions.push({ label: '从相册选择', type: 'album' })
  if (sourceType.includes('camera')) actions.push({ label: '拍摄照片', type: 'camera' })

  try {
    const action = actions.length === 1
      ? actions[0]
      : actions[(await Taro.showActionSheet({ itemList: actions.map((item) => item.label) })).tapIndex]
    if (!action) return []
    await ensurePrivacyAuthorize()

    const files = await chooseFromMedia({
      count,
      sizeType,
      sourceType: [action.type],
    })
    return filterSafeImages(files)
  } catch (error) {
    const userMessage = getChooseImageErrorMessage(error)
    if (userMessage) showError(userMessage)
    return []
  }
}
