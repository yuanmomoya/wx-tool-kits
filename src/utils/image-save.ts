import Taro from '@tarojs/taro'

const ALBUM_SCOPE = 'scope.writePhotosAlbum'

export type SaveMediaType = 'image' | 'video'

export type SaveError = {
  errMsg?: string
  message?: string
  userMessage?: string
  handled?: boolean
}

const getErrMsg = (error: unknown) =>
  String((error as SaveError)?.errMsg || (error as SaveError)?.message || '')

export const isSaveCancel = (error: unknown) => getErrMsg(error).toLowerCase().includes('cancel')

const getMediaName = (type: SaveMediaType) => (type === 'video' ? '视频' : '图片')

const isPrivacyBannedError = (error: unknown) => {
  const errMsg = getErrMsg(error).toLowerCase()
  return (
    errMsg.includes('privacy api banned') ||
    errMsg.includes('privacy interface is banned') ||
    errMsg.includes('api scope is not declared in the privacy agreement') ||
    errMsg.includes('interface is not declared in the privacy agreement')
  )
}

const isPrivacyUnauthorizedError = (error: unknown) => {
  const errMsg = getErrMsg(error).toLowerCase()
  return (
    errMsg.includes('privacy permission is not authorized') ||
    errMsg.includes('require privacy authorize')
  )
}

const isAlbumPermissionError = (error: unknown) => {
  const errMsg = getErrMsg(error).toLowerCase()
  return (
    errMsg.includes('auth') ||
    errMsg.includes('authorize') ||
    errMsg.includes('permission') ||
    errMsg.includes('deny') ||
    errMsg.includes('denied')
  )
}

const getSaveErrorMessage = (type: SaveMediaType, error: unknown) => {
  const errMsg = getErrMsg(error).toLowerCase()
  const mediaName = getMediaName(type)

  if (isPrivacyBannedError(error)) return '小程序隐私指引未声明相册保存权限'
  if (isPrivacyUnauthorizedError(error)) return '请先同意小程序隐私保护指引'
  if (isAlbumPermissionError(error)) return '相册权限未开启'

  if (
    errMsg.includes('file not found') ||
    errMsg.includes('no such file') ||
    errMsg.includes('not found') ||
    errMsg.includes('fail file')
  ) {
    return `${mediaName}文件已失效，请重新生成后保存`
  }

  if (
    errMsg.includes('invalid file') ||
    errMsg.includes(`invalid ${type}`) ||
    errMsg.includes(`not a ${type}`) ||
    errMsg.includes('format') ||
    errMsg.includes('decode') ||
    errMsg.includes('unsupported')
  ) {
    return `${mediaName}格式暂不支持保存`
  }

  if (errMsg.includes('system')) return '系统相册暂时无法写入'

  return '保存失败，请重试'
}

const normalizeSaveError = (type: SaveMediaType, error: unknown): SaveError => {
  if (error && typeof error === 'object') {
    return {
      ...(error as SaveError),
      userMessage: getSaveErrorMessage(type, error),
    }
  }

  return {
    errMsg: getErrMsg(error),
    userMessage: getSaveErrorMessage(type, error),
  }
}

const showAlbumPermissionModal = (content: string) =>
  new Promise<void>((resolve) => {
    Taro.showModal({
      title: '需要相册权限',
      content,
      confirmText: '去设置',
      success: (res) => {
        if (res.confirm) {
          Taro.openSetting({ complete: () => resolve() })
          return
        }
        resolve()
      },
      fail: () => resolve(),
    })
  })

export const ensurePrivacyAuthorize = () =>
  new Promise<void>((resolve, reject) => {
    const requirePrivacyAuthorize = (Taro as any).requirePrivacyAuthorize
    if (!requirePrivacyAuthorize) {
      resolve()
      return
    }

    requirePrivacyAuthorize({
      success: () => resolve(),
      fail: reject,
    })
  })

export const ensureAlbumPermission = (content = '打开权限后就能保存图片到相册。') =>
  new Promise<void>((resolve, reject) => {
    Taro.getSetting({
      success: (setting) => {
        const authSetting = setting.authSetting || {}

        if (authSetting[ALBUM_SCOPE]) {
          resolve()
          return
        }

        if (authSetting[ALBUM_SCOPE] === false) {
          showAlbumPermissionModal(content).then(() => reject({ handled: true }))
          return
        }

        resolve()
      },
      fail: () => resolve(),
    })
  })

export const saveImageToAlbum = ({
  filePath,
  permissionText,
}: {
  filePath: string
  permissionText?: string
}) => {
  const text = permissionText || '打开权限后就能保存图片到相册。'

  return ensurePrivacyAuthorize()
    .then(() => ensureAlbumPermission(text))
    .then(
      () =>
        new Promise<void>((resolve, reject) => {
          Taro.saveImageToPhotosAlbum({
            filePath,
            success: () => resolve(),
            fail: reject,
          })
        }),
    )
    .catch((error: SaveError) => {
      if (error?.handled) return Promise.reject(error)

      if (isAlbumPermissionError(error)) {
        return showAlbumPermissionModal(text).then(() => Promise.reject({ handled: true }))
      }

      return Promise.reject(normalizeSaveError('image', error))
    })
}

export const saveVideoToAlbum = ({
  filePath,
  permissionText,
}: {
  filePath: string
  permissionText?: string
}) => {
  const text = permissionText || '打开权限后就能保存视频到相册。'

  return ensurePrivacyAuthorize()
    .then(() => ensureAlbumPermission(text))
    .then(
      () =>
        new Promise<void>((resolve, reject) => {
          Taro.saveVideoToPhotosAlbum({
            filePath,
            success: () => resolve(),
            fail: reject,
          })
        }),
    )
    .catch((error: SaveError) => {
      if (error?.handled) return Promise.reject(error)

      if (isAlbumPermissionError(error)) {
        return showAlbumPermissionModal(text).then(() => Promise.reject({ handled: true }))
      }

      return Promise.reject(normalizeSaveError('video', error))
    })
}
