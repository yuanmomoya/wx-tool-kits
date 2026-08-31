const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const MAX_IMAGE_BYTES = 1024 * 1024
const RISK_ERR_CODE = 87014

const getErrorCode = (value) => Number(value?.errCode ?? value?.errcode)

const removeTemporaryFile = async (fileID) => {
  try {
    await cloud.deleteFile({ fileList: [fileID] })
  } catch (error) {
    console.warn('[imageSecurityCheck] temporary file cleanup failed', {
      errCode: getErrorCode(error),
    })
  }
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const fileID = typeof event?.fileID === 'string' ? event.fileID : ''

  if (!OPENID || !fileID.startsWith('cloud://') || !fileID.includes('/content-security/')) {
    return { pass: false, reason: 'service_error' }
  }

  try {
    const downloaded = await cloud.downloadFile({ fileID })
    const image = downloaded.fileContent

    if (!Buffer.isBuffer(image) || image.length === 0 || image.length > MAX_IMAGE_BYTES) {
      return { pass: false, reason: 'service_error' }
    }

    const result = await cloud.openapi.security.imgSecCheck({
      media: {
        contentType: fileID.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg',
        value: image,
      },
    })
    const errCode = getErrorCode(result)

    if (errCode === 0) return { pass: true }
    if (errCode === RISK_ERR_CODE) return { pass: false, reason: 'risky' }

    console.error('[imageSecurityCheck] openapi returned an error', { errCode })
    return { pass: false, reason: 'service_error' }
  } catch (error) {
    const errCode = getErrorCode(error)
    if (errCode === RISK_ERR_CODE) return { pass: false, reason: 'risky' }

    console.error('[imageSecurityCheck] check failed', { errCode })
    return { pass: false, reason: 'service_error' }
  } finally {
    await removeTemporaryFile(fileID)
  }
}
