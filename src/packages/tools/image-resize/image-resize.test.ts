import { describe, expect, it } from 'vitest'
import { createResizePlan, getResizeExport, normalizeResizeSize } from './image-resize.logic'

describe('图片改尺寸', () => {
  it('将自定义尺寸限制在 50–4096', () => { expect(normalizeResizeSize(1, 9000)).toEqual({ width: 50, height: 4096 }); expect(normalizeResizeSize(800.4, 600.6)).toEqual({ width: 800, height: 601 }); expect(() => normalizeResizeSize(NaN, 10)).toThrow() })
  it('横图、竖图和方图使用 cover 居中裁切', () => { expect(createResizePlan(1600, 900, 400, 400, 'cover')).toMatchObject({ sx: 350, sy: 0, sw: 900, sh: 900 }); expect(createResizePlan(900, 1600, 400, 400, 'cover')).toMatchObject({ sx: 0, sy: 350, sw: 900, sh: 900 }); expect(createResizePlan(800, 800, 400, 400, 'cover')).toMatchObject({ sx: 0, sy: 0, sw: 800, sh: 800 }) })
  it('contain 留白、stretch 拉伸并选择 JPG/PNG 导出', () => { expect(createResizePlan(1600, 800, 400, 400, 'contain')).toMatchObject({ dx: 0, dy: 100, dw: 400, dh: 200 }); expect(createResizePlan(100, 200, 300, 400, 'stretch')).toMatchObject({ sw: 100, sh: 200, dw: 300, dh: 400 }); expect(getResizeExport('jpg')).toEqual({ fileType: 'jpg', quality: 0.92 }); expect(getResizeExport('png')).toEqual({ fileType: 'png', quality: 1 }) })
})
