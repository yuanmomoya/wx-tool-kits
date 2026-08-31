import { describe, expect, it } from 'vitest'
import { createLongImagePlan } from './long-image.logic'

describe('长图拼接', () => {
  it('统一宽度并保持绘制顺序和 Y 坐标', () => { const plan = createLongImagePlan([{ width: 1000, height: 500 }, { width: 500, height: 1000 }, { width: 800, height: 800 }]); expect(plan.width).toBe(500); expect(plan.draws.map((item) => item.index)).toEqual([0, 1, 2]); expect(plan.draws.map((item) => item.y)).toEqual([0, 250, 1250]); expect(plan.height).toBe(1750) })
  it('限制最大高度并保留最小输出宽度', () => { const min = createLongImagePlan([{ width: 100, height: 100 }, { width: 100, height: 100 }]); expect(min.width).toBe(320); const limited = createLongImagePlan([{ width: 1000, height: 10_000 }, { width: 1000, height: 10_000 }], 1000, 10_000); expect(limited.height).toBeLessThanOrEqual(10_000); expect(limited.width).toBeGreaterThanOrEqual(320); expect(() => createLongImagePlan([{ width: 1000, height: 20_000 }, { width: 1000, height: 20_000 }], 1000, 10_000)).toThrow() })
  it('少于两张或尺寸异常时拒绝', () => { expect(() => createLongImagePlan([{ width: 1, height: 1 }])).toThrow(); expect(() => createLongImagePlan([{ width: 1, height: 1 }, { width: 0, height: 1 }])).toThrow() })
})
