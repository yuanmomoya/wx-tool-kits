import Taro from '@tarojs/taro'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { filterSafeImages } from './contentSecurity'

const taroMock = Taro as any
const file = {
  tempFilePath: 'picked.jpg',
  size: 128,
  width: 100,
  height: 100,
}

describe('图片内容安全校验', () => {
  beforeEach(() => {
    taroMock.showLoading = vi.fn()
    taroMock.hideLoading = vi.fn()
    taroMock.showToast = vi.fn()
    taroMock.getImageInfo = vi.fn()
    taroMock.getFileInfo = vi.fn()
    taroMock.compressImage = vi.fn()
    taroMock.cloud = {
      uploadFile: vi.fn().mockResolvedValue({ fileID: 'cloud://env/content-security/check.jpg' }),
      callFunction: vi.fn().mockResolvedValue({ result: { pass: true } }),
      deleteFile: vi.fn().mockResolvedValue({}),
    }
  })

  it('云函数检测通过后才返回原图片', async () => {
    await expect(filterSafeImages([file])).resolves.toEqual([file])

    expect(taroMock.cloud.callFunction).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'imageSecurityCheck',
        data: { fileID: 'cloud://env/content-security/check.jpg' },
      }),
    )
    expect(taroMock.hideLoading).toHaveBeenCalled()
  })

  it('大图先生成接口限制内的检测副本', async () => {
    taroMock.compressImage.mockResolvedValue({ tempFilePath: 'compressed-file' })
    taroMock.getFileInfo.mockResolvedValue({ size: 800 * 1024 })
    taroMock.getImageInfo.mockResolvedValue({ width: 800, height: 600, type: 'png' })

    await filterSafeImages([{ ...file, tempFilePath: 'large-file', size: 3 * 1024 * 1024 }])

    expect(taroMock.compressImage).toHaveBeenCalledWith(
      expect.objectContaining({ src: 'large-file', compressedWidth: 100, compressedHeight: 100 }),
    )
    expect(taroMock.cloud.uploadFile).toHaveBeenCalledWith(
      expect.objectContaining({ filePath: 'compressed-file', cloudPath: expect.stringMatching(/\.png$/) }),
    )
  })

  it('违规图片不进入业务并只显示统一提示', async () => {
    taroMock.cloud.callFunction.mockResolvedValue({
      result: { pass: false, reason: 'risky' },
    })

    await expect(filterSafeImages([file])).resolves.toEqual([])

    expect(taroMock.showToast).toHaveBeenCalledWith({
      title: '所发布内容含违规信息',
      icon: 'none',
    })
  })

  it('检测服务异常时关闭放行通道', async () => {
    taroMock.cloud.callFunction.mockRejectedValue(new Error('network error'))

    await expect(filterSafeImages([file])).resolves.toEqual([])

    expect(taroMock.showToast).toHaveBeenCalledWith({
      title: '图片安全检测失败，请重试',
      icon: 'none',
    })
    expect(taroMock.cloud.deleteFile).toHaveBeenCalled()
  })
})
