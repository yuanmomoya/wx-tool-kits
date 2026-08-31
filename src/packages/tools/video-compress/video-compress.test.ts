import { describe, expect, it, vi } from 'vitest'
import { QUALITY_ORDER, qualityFallbacks, selectCompressedVideo, shouldCopyBeforeSave } from './video-compress.logic'

describe('视频压缩', () => {
  it('质量顺序固定并从所选质量自动降级', () => { expect(QUALITY_ORDER).toEqual(['high', 'medium', 'low']); expect(qualityFallbacks('high')).toEqual(['high', 'medium', 'low']); expect(qualityFallbacks('medium')).toEqual(['medium', 'low']) })
  it('选中首个变小结果', async () => { const sizes = { high: 1100, medium: 900, low: 500 }; const compress = vi.fn(async (quality: keyof typeof sizes) => ({ path: quality, size: sizes[quality] })); const result = await selectCompressedVideo(1000, 'high', compress); expect(result.quality).toBe('medium'); expect(compress).toHaveBeenCalledTimes(2) })
  it('所有结果变大时选择最小文件，并透传 API 失败', async () => { const sizes = { high: 1300, medium: 1200, low: 1100 }; const result = await selectCompressedVideo(1000, 'high', async (quality) => ({ path: quality, size: sizes[quality] })); expect(result.quality).toBe('low'); await expect(selectCompressedVideo(1000, 'high', async () => { throw new Error('api failed') })).rejects.toThrow('api failed') })
  it('保存前识别需要复制的临时文件', () => { expect(shouldCopyBeforeSave('wxfile://tmp/a.mp4')).toBe(true); expect(shouldCopyBeforeSave('/tmp/a.mp4')).toBe(true); expect(shouldCopyBeforeSave('/user/a.mp4')).toBe(false) })
})
