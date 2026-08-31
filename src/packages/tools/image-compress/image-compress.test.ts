import Taro from '@tarojs/taro'
import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_PARAMS } from '@/types/compress'
import { CompressCancelledError, LocalCompressError, allowedError, assertNotCancelled, calcTargetSize, localCompress, normalizeFmt, parseHexColor, resolveOutputFormat, targetBytesOf } from '@/services/localCompress'
import { calculateTargetDimensions, chooseOutputFormat, normalizeImageFormat, searchQuality, targetBytes } from './image-compress.logic'

describe('图片压缩', () => {
  const installCanvas = (sizeOfQuality: (quality: number, width: number, height: number) => number, imageLoads = true) => {
    let exportedSize = 0
    const ctx = { clearRect: vi.fn(), fillRect: vi.fn(), drawImage: vi.fn(), fillStyle: '' }
    const canvas = {
      width: 0, height: 0, getContext: vi.fn(() => ctx),
      createImage: vi.fn(() => {
        const image: any = { width: 0, height: 0, onload: null, onerror: null }
        Object.defineProperty(image, 'src', { set() { queueMicrotask(() => imageLoads ? image.onload?.() : image.onerror?.()) } })
        return image
      }),
    }
    const query: any = { select: vi.fn(() => query), fields: vi.fn(() => query), exec: vi.fn((callback) => callback([{ node: canvas }])) }
    vi.mocked(Taro.createSelectorQuery).mockReturnValue(query)
    vi.mocked(Taro.getImageInfo).mockResolvedValue({ width: 8000, height: 4000 } as any)
    vi.mocked(Taro.canvasToTempFilePath).mockImplementation(async (options: any) => { exportedSize = sizeOfQuality(options.quality, canvas.width, canvas.height); return { tempFilePath: `result-${options.quality}.jpg` } as any })
    vi.mocked(Taro.getFileInfo).mockImplementation(async () => ({ size: exportedSize }) as any)
    return { canvas, ctx, query }
  }
  it('选择输出格式并解析背景色', () => { expect(normalizeImageFormat('JPEG')).toBe('jpg'); expect(chooseOutputFormat('auto', 'png')).toBe('png'); expect(normalizeFmt('.jfif')).toBe('jpg'); expect(resolveOutputFormat({ path: 'x', name: 'x', size: 1, format: 'png' }, DEFAULT_PARAMS)).toBe('png'); expect(parseHexColor('#abc')).toEqual({ r: 170, g: 187, b: 204 }); expect(parseHexColor('bad!')).toEqual({ r: 255, g: 255, b: 255 }) })
  it('处理等比、自定义尺寸和 4096 边长限制', () => { expect(calculateTargetDimensions(8000, 4000)).toEqual({ width: 4096, height: 2048 }); expect(calcTargetSize(1000, 500, { ...DEFAULT_PARAMS, size_mode: 'scale', scale_percent: 50 })).toEqual({ width: 500, height: 250 }); expect(calcTargetSize(1000, 500, { ...DEFAULT_PARAMS, size_mode: 'custom', custom_width: 200, custom_height: 200, lock_aspect: true })).toEqual({ width: 200, height: 100 }); expect(calcTargetSize(8000, 1000, DEFAULT_PARAMS).width).toBe(4096) })
  it('换算目标体积与误差容限', () => { expect(targetBytes(200, 'KB')).toBe(204800); expect(targetBytes(1, 'MB')).toBe(1048576); expect(targetBytesOf({ ...DEFAULT_PARAMS, target_size_value: 1, target_size_unit: 'MB' })).toBe(1048576); expect(allowedError(50 * 1024)).toBe(4096); expect(allowedError(2 * 1024 * 1024)).toBeGreaterThan(60_000); expect(() => targetBytes(0, 'KB')).toThrow() })
  it('二分搜索质量、支持取消与编码失败', async () => { const encode = vi.fn(async (quality: number) => Math.round(quality * 1000)); const result = await searchQuality(500, encode); expect(result.bytes).toBeCloseTo(500, -1); await expect(searchQuality(500, encode, () => true)).rejects.toThrow('CANCELLED'); await expect(searchQuality(500, async () => { throw new Error('export failed') })).rejects.toThrow('export failed'); expect(() => assertNotCancelled({ cancelled: true })).toThrow(CompressCancelledError) })
  it('模拟 Canvas 完成质量模式并记录超大图、PNG 提示和进度', async () => { vi.useRealTimers(); const { canvas, ctx } = installCanvas(() => 990); const progress = vi.fn(); const result = await localCompress({ path: 'source.png', name: 'source.png', size: 1000, format: 'png' }, { ...DEFAULT_PARAMS, mode: 'quality', output_format: 'png', quality: 70 }, { onProgress: progress }); expect(result.output.width).toBe(4096); expect(result.output.height).toBe(2048); expect(result.output.format).toBe('PNG'); expect(result.warnings).toHaveLength(2); expect(progress).toHaveBeenLastCalledWith(100, expect.any(String)); expect(canvas.width).toBe(4096); expect(ctx.drawImage).toHaveBeenCalled(); expect(ctx.fillRect).not.toHaveBeenCalled() })
  it('目标体积模式执行质量搜索并在必要时缩小尺寸', async () => { vi.useRealTimers(); installCanvas((quality) => Math.round(quality * 1_000_000)); const reached = await localCompress({ path: 'a.jpg', name: 'a.jpg', size: 2_000_000, format: 'jpg' }, { ...DEFAULT_PARAMS, target_size_value: 500, target_size_unit: 'KB' }); expect(reached.reached_target).toBe(true); expect(reached.output.size_bytes).toBeLessThan(550_000); installCanvas((_quality, width) => width * 500); const missed = await localCompress({ path: 'a.jpg', name: 'a', size: 3_000_000, format: 'jpg' }, { ...DEFAULT_PARAMS, target_size_value: 10, target_size_unit: 'KB' }); expect(missed.reached_target).toBe(false); expect(missed.message).toBeTruthy(); expect(missed.output.width).toBeLessThan(4096) })
  it('模拟取消、图片信息、Canvas、图片加载和平台导出失败', async () => { vi.useRealTimers(); await expect(localCompress({ path: 'x', name: 'x.bmp', size: 1, format: 'bmp' }, DEFAULT_PARAMS)).rejects.toBeInstanceOf(LocalCompressError); installCanvas(() => 100); await expect(localCompress({ path: 'x', name: 'x.jpg', size: 1, format: 'jpg' }, DEFAULT_PARAMS, { signal: { cancelled: true } })).rejects.toBeInstanceOf(CompressCancelledError); vi.mocked(Taro.getImageInfo).mockRejectedValueOnce(new Error('bad info')); await expect(localCompress({ path: 'x', name: 'x.jpg', size: 1, format: 'jpg' }, DEFAULT_PARAMS)).rejects.toBeInstanceOf(LocalCompressError); installCanvas(() => 100); vi.mocked(Taro.createSelectorQuery).mockReturnValueOnce({ select: () => ({ fields: () => ({ exec: (callback: any) => callback([]) }) }) } as any); await expect(localCompress({ path: 'x', name: 'x.jpg', size: 1, width: 10, height: 10, format: 'jpg' }, DEFAULT_PARAMS)).rejects.toBeInstanceOf(LocalCompressError); installCanvas(() => 100, false); await expect(localCompress({ path: 'x', name: 'x.jpg', size: 1, format: 'jpg' }, DEFAULT_PARAMS)).rejects.toBeInstanceOf(LocalCompressError); installCanvas(() => 100); vi.mocked(Taro.canvasToTempFilePath).mockRejectedValueOnce(new Error('export failed')); await expect(localCompress({ path: 'x', name: 'x.jpg', size: 1, format: 'jpg' }, { ...DEFAULT_PARAMS, mode: 'quality' })).rejects.toThrow('export failed') })
})
