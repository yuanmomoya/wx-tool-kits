import { describe, expect, it } from 'vitest'
import { calculateCompound } from './compound.logic'

describe('复利/定投', () => {
  it('零收益率下只有本金和月末定投', () => { expect(calculateCompound(10_000, 1000, 0, 0.5)).toMatchObject({ months: 6, monthlyRate: 0, invested: 16_000, total: 16_000, profit: 0 }); expect(calculateCompound(10_000, 0, 0, 10).total).toBe(10_000) })
  it('使用等效月收益率计算长期收益', () => { const result = calculateCompound(0, 1000, 12, 10); expect((1 + result.monthlyRate) ** 12).toBeCloseTo(1.12); expect(result.total).toBeGreaterThan(result.invested) })
  it('处理边界并拒绝非法输入', () => { expect(calculateCompound(0, 0, 5, 0).total).toBe(0); expect(() => calculateCompound(-1, 0, 5, 1)).toThrow(); expect(() => calculateCompound(0, 0, -101, 1)).toThrow() })
})
