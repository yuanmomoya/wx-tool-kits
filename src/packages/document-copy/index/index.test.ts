import { describe, expect, it } from 'vitest'
import {
  computeImagePlacement,
  createDefaultCrop,
  createLazyPdfCache,
  createIdCardSlots,
  createLayoutSlots,
  createMaterialSlots,
  createSlotWatermarkPlan,
  getA4PixelSize,
  getIdCardPixelSize,
  getPageInsets,
  getPdfPageSizePoints,
  getResultNote,
  getRotatedImageSize,
  JPG_QUALITY,
  mmToPx,
  panCrop,
  resetCrop,
  resolveWatermarkText,
  rotateCrop,
  validateMaterialsForExport,
  WATERMARK_OPACITY,
  zoomCrop,
} from './index.logic'

describe('证件材料复印排版', () => {
  it('按 200 DPI 换算 A4 与身份证真实尺寸', () => {
    expect(mmToPx(210)).toBe(1654)
    expect(mmToPx(297)).toBe(2339)
    expect(getA4PixelSize('portrait')).toEqual({ width: 1654, height: 2339 })
    expect(getA4PixelSize('landscape')).toEqual({ width: 2339, height: 1654 })
    expect(getIdCardPixelSize()).toEqual({ width: 674, height: 425 })
    expect(getPageInsets()).toEqual({ margin: 118, gap: 79 })
    expect(JPG_QUALITY).toBe(0.95)
  })

  it('身份证模板位于页边距内、无重叠且间距正确', () => {
    for (const orientation of ['portrait', 'landscape'] as const) {
      const slots = createIdCardSlots(orientation)
      expect(slots).toHaveLength(2)
      expect(slots[0].role).toBe('front')
      expect(slots[1].role).toBe('back')
      expect(slots[0].width).toBe(674)
      expect(slots[0].height).toBe(425)
      const page = getA4PixelSize(orientation)
      const { margin, gap } = getPageInsets()
      for (const slot of slots) {
        expect(slot.x).toBeGreaterThanOrEqual(margin)
        expect(slot.y).toBeGreaterThanOrEqual(margin)
        expect(slot.x + slot.width).toBeLessThanOrEqual(page.width - margin)
        expect(slot.y + slot.height).toBeLessThanOrEqual(page.height - margin)
      }
      if (orientation === 'portrait') {
        expect(slots[1].y - (slots[0].y + slots[0].height)).toBe(gap)
        expect(slots[0].x).toBe(slots[1].x)
      } else {
        expect(slots[1].x - (slots[0].x + slots[0].width)).toBe(gap)
        expect(slots[0].y).toBe(slots[1].y)
      }
    }
  })

  it('1–4 张材料模板全部位于页面内且无重叠', () => {
    for (const orientation of ['portrait', 'landscape'] as const) {
      for (let count = 1; count <= 4; count += 1) {
        const pairLayouts = count === 2 ? (['vertical', 'horizontal'] as const) : (['vertical'] as const)
        for (const pairLayout of pairLayouts) {
          const slots = createMaterialSlots(count, orientation, pairLayout)
          expect(slots).toHaveLength(count)
          const page = getA4PixelSize(orientation)
          const { margin } = getPageInsets()
          for (const slot of slots) {
            expect(slot.x).toBeGreaterThanOrEqual(margin - 0.5)
            expect(slot.y).toBeGreaterThanOrEqual(margin - 0.5)
            expect(slot.x + slot.width).toBeLessThanOrEqual(page.width - margin + 0.5)
            expect(slot.y + slot.height).toBeLessThanOrEqual(page.height - margin + 0.5)
          }
          for (let i = 0; i < slots.length; i += 1) {
            for (let j = i + 1; j < slots.length; j += 1) {
              const a = slots[i]
              const b = slots[j]
              const overlapX = a.x < b.x + b.width && a.x + a.width > b.x
              const overlapY = a.y < b.y + b.height && a.y + a.height > b.y
              expect(overlapX && overlapY).toBe(false)
            }
          }
        }
      }
    }
  })

  it('单张材料使用完整 A4 内容区域', () => {
    for (const orientation of ['portrait', 'landscape'] as const) {
      const page = getA4PixelSize(orientation)
      const { margin } = getPageInsets()
      const slot = createMaterialSlots(1, orientation)[0]
      expect(slot).toMatchObject({
        x: margin,
        y: margin,
        width: page.width - margin * 2,
        height: page.height - margin * 2,
      })
    }
  })

  it('createLayoutSlots 按模式分发，并拒绝非法数量', () => {
    expect(createLayoutSlots({ mode: 'id-card', orientation: 'portrait', count: 2 })).toHaveLength(2)
    expect(createLayoutSlots({ mode: 'materials', orientation: 'portrait', count: 3 })).toHaveLength(3)
    expect(() => createLayoutSlots({ mode: 'id-card', orientation: 'portrait', count: 1 })).toThrow()
    expect(() => createMaterialSlots(0, 'portrait')).toThrow()
    expect(() => createMaterialSlots(5, 'portrait')).toThrow()
  })

  it('完整显示不裁边，铺满模式覆盖槽位', () => {
    const contain = computeImagePlacement(1000, 2000, 1000, 1000, createDefaultCrop({ fit: 'contain' }))
    expect(contain.drawWidth).toBe(500)
    expect(contain.drawHeight).toBe(1000)
    expect(contain.centerX).toBe(500)
    expect(contain.centerY).toBe(500)

    const cover = computeImagePlacement(1000, 2000, 1000, 1000, createDefaultCrop({ fit: 'cover' }))
    expect(cover.drawWidth).toBe(1000)
    expect(cover.drawHeight).toBe(2000)
    expect(cover.rotatedWidth).toBeGreaterThanOrEqual(1000)
    expect(cover.rotatedHeight).toBeGreaterThanOrEqual(1000)
  })

  it('旋转后尺寸交换，缩放边界、偏移钳制和重置生效', () => {
    expect(getRotatedImageSize(1000, 500, 90)).toEqual({ width: 500, height: 1000 })
    expect(getRotatedImageSize(1000, 500, 180)).toEqual({ width: 1000, height: 500 })
    expect(() => getRotatedImageSize(0, 100, 0)).toThrow()

    const crop = createDefaultCrop({ fit: 'cover' })
    expect(zoomCrop(crop, 0.5).scale).toBe(1)
    expect(zoomCrop(crop, 9).scale).toBe(4)
    expect(rotateCrop(crop, 90).rotation).toBe(90)
    expect(rotateCrop(rotateCrop(crop, 90), 270).rotation).toBe(0)

    const panned = panCrop(createDefaultCrop({ scale: 2 }), 5000, 5000, 1000, 500, 400, 300)
    const placement = computeImagePlacement(1000, 500, 400, 300, panned)
    expect(placement.centerX + placement.rotatedWidth / 2).toBeGreaterThanOrEqual(400)
    expect(placement.centerY + placement.rotatedHeight / 2).toBeGreaterThanOrEqual(300)

    expect(resetCrop({ fit: 'contain', rotation: 90, scale: 3, offsetX: 0.2, offsetY: 0.8 })).toEqual({
      fit: 'contain',
      offsetX: 0,
      offsetY: 0,
      scale: 1,
      rotation: 90,
    })
  })

  it('结果提示按目标模式计算，不依赖旧页面状态', () => {
    expect(getResultNote('materials', 0)).toBe('等待生成')
    expect(getResultNote('materials', 1)).toBe('可生成排版')
    expect(getResultNote('id-card', 1)).toBe('请选择正反面两张')
    expect(getResultNote('id-card', 2)).toBe('可生成排版')
  })

  it('PDF 按需生成、并发复用并在排版变化后失效', async () => {
    const cache = createLazyPdfCache()
    let generateCount = 0
    const generate = async (sourcePath: string) => {
      generateCount += 1
      return `${sourcePath}.${generateCount}.pdf`
    }

    const [first, concurrent] = await Promise.all([
      cache.ensure('result-a.jpg', generate),
      cache.ensure('result-a.jpg', generate),
    ])
    expect(first).toBe(concurrent)
    expect(generateCount).toBe(1)
    expect(await cache.ensure('result-a.jpg', generate)).toBe(first)
    expect(generateCount).toBe(1)

    cache.invalidate()
    expect(await cache.ensure('result-a.jpg', generate)).not.toBe(first)
    expect(generateCount).toBe(2)
  })

  it('水印默认关闭，模板/自定义文本与三档透明度可用', () => {
    expect(resolveWatermarkText({ enabled: false, presetId: 'business' })).toBe('')
    expect(resolveWatermarkText({ enabled: true, presetId: 'off' })).toBe('')
    expect(resolveWatermarkText({ enabled: true, presetId: 'business' })).toBe('仅用于办理业务')
    expect(resolveWatermarkText({ enabled: true, presetId: 'copy' })).toBe('仅用于复印使用')
    expect(
      resolveWatermarkText({ enabled: true, presetId: 'custom', customText: '  自定义用途\n第二行\n第三行' }),
    ).toBe('自定义用途 第二行')

    expect(WATERMARK_OPACITY.light).toBe(0.12)
    expect(WATERMARK_OPACITY.medium).toBe(0.18)
    expect(WATERMARK_OPACITY.strong).toBe(0.26)

    const slot = createMaterialSlots(1, 'portrait')[0]
    const off = createSlotWatermarkPlan(slot, '', 'medium')
    expect(off.enabled).toBe(false)
    const on = createSlotWatermarkPlan(slot, '仅用于办理业务', 'strong')
    expect(on.enabled).toBe(true)
    expect(on.opacity).toBe(0.26)
    expect(on.positions.length).toBeGreaterThan(0)
  })

  it('非法图片尺寸、图片不足、超过四张时拒绝导出', () => {
    expect(() => validateMaterialsForExport('materials', [])).toThrow(/至少/)
    expect(() => validateMaterialsForExport('id-card', [{ width: 1, height: 1 }])).toThrow(/正反面/)
    expect(() =>
      validateMaterialsForExport('id-card', [
        { width: 1, height: 1 },
        { width: 1, height: 1 },
        { width: 1, height: 1 },
      ]),
    ).toThrow(/两张/)
    expect(() =>
      validateMaterialsForExport('materials', [
        { width: 1, height: 1 },
        { width: 1, height: 1 },
        { width: 1, height: 1 },
        { width: 1, height: 1 },
        { width: 1, height: 1 },
      ]),
    ).toThrow(/最多/)
    expect(() => validateMaterialsForExport('materials', [{ width: 0, height: 10 }])).toThrow(/尺寸/)
    expect(() => computeImagePlacement(0, 10, 100, 100, createDefaultCrop())).toThrow(/尺寸/)
  })

  it('PDF 页面使用标准 A4 点尺寸', () => {
    expect(getPdfPageSizePoints('portrait')).toEqual({ width: 595.28, height: 841.89 })
    expect(getPdfPageSizePoints('landscape')).toEqual({ width: 841.89, height: 595.28 })
  })
})
