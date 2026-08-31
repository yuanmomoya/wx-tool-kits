import Taro from '@tarojs/taro'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { filterSafeImages } from '@/services/contentSecurity'

import { chooseImages } from './image-picker'

vi.mock('@/services/contentSecurity', () => ({
  filterSafeImages: vi.fn(async (files) => files),
}))

const taroMock = Taro as any

describe('图片选择入口', () => {
  beforeEach(() => {
    taroMock.showActionSheet = vi.fn()
    taroMock.chooseMedia = vi.fn((options: any) => {
      options.success({
        tempFiles: [{ tempFilePath: 'picked.jpg', size: 128, width: 100, height: 100 }],
      })
    })
  })

  it('默认只展示相册和拍照', async () => {
    taroMock.showActionSheet.mockResolvedValue({ tapIndex: 0 })

    await expect(chooseImages()).resolves.toHaveLength(1)

    expect(taroMock.showActionSheet).toHaveBeenCalledWith({
      itemList: ['从相册选择', '拍摄照片'],
    })
    expect(taroMock.chooseMedia).toHaveBeenCalledWith(
      expect.objectContaining({ sourceType: ['album'], mediaType: ['image'] }),
    )
    expect(filterSafeImages).toHaveBeenCalledWith([
      expect.objectContaining({ tempFilePath: 'picked.jpg' }),
    ])
  })

  it('选择拍摄照片时调用相机', async () => {
    taroMock.showActionSheet.mockResolvedValue({ tapIndex: 1 })

    await chooseImages()

    expect(taroMock.chooseMedia).toHaveBeenCalledWith(
      expect.objectContaining({ sourceType: ['camera'], mediaType: ['image'] }),
    )
  })

  it('仅允许相册的工具直接打开相册', async () => {
    await chooseImages({ sourceType: ['album'] })

    expect(taroMock.showActionSheet).not.toHaveBeenCalled()
    expect(taroMock.chooseMedia).toHaveBeenCalledWith(
      expect.objectContaining({ sourceType: ['album'] }),
    )
  })
})
