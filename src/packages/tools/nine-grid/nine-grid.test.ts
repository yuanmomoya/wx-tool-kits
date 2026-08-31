import { describe, expect, it } from 'vitest'
import { createNineGridPlan, getSquareCrop, summarizeSaveResults } from './nine-grid.logic'

describe('九宫格切图', () => {
  it('横图支持左中右，竖图支持上中下，方图不裁切', () => { expect(getSquareCrop(1200, 900, 'left')).toEqual({ x: 0, y: 0, size: 900 }); expect(getSquareCrop(1200, 900, 'center')).toEqual({ x: 150, y: 0, size: 900 }); expect(getSquareCrop(1200, 900, 'right')).toEqual({ x: 300, y: 0, size: 900 }); expect(getSquareCrop(900, 1200, 'top').y).toBe(0); expect(getSquareCrop(900, 1200, 'center').y).toBe(150); expect(getSquareCrop(900, 1200, 'bottom').y).toBe(300); expect(getSquareCrop(900, 900)).toEqual({ x: 0, y: 0, size: 900 }) })
  it('9 个切片尺寸一致、不重叠且编号顺序正确', () => { const plans = createNineGridPlan(1200, 900, 'center'); expect(plans).toHaveLength(9); expect(plans.map((item) => item.index)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]); expect(new Set(plans.map((item) => `${item.sx},${item.sy}`)).size).toBe(9); expect(new Set(plans.map((item) => `${item.sw}x${item.sh}`)).size).toBe(1) })
  it('统计部分保存失败', () => { expect(summarizeSaveResults([{ ok: true }, { ok: false }, { ok: true }])).toEqual({ saved: 2, failed: 1, complete: false }); expect(summarizeSaveResults([{ ok: true }]).complete).toBe(true) })
})
