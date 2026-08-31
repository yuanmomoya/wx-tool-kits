import { describe, expect, it } from 'vitest'
import { normalizePrice, rankPrices } from './price-compare.logic'

describe('比价计算', () => {
  it('统一重量、体积和数量单价并排名', () => { const ranked = rankPrices([{ id: 'a', price: 10, amount: 500, unit: 'g' }, { id: 'b', price: 18, amount: 1, unit: 'kg' }], 'weight'); expect(ranked[0].id).toBe('b'); expect(ranked[0].isBest).toBe(true); expect(ranked[1].advantagePercent).toBeCloseTo(10); expect(normalizePrice({ id: 'v', price: 5, amount: 1, unit: 'l' }, 'volume').baseAmount).toBe(1000); expect(normalizePrice({ id: 'q', price: 5, amount: 2, unit: 'piece' }, 'quantity').unitPrice).toBe(2.5) })
  it('同价容差下可并列最佳', () => { const ranked = rankPrices([{ id: 'a', price: 10, amount: 1, unit: 'kg' }, { id: 'b', price: 5, amount: 500, unit: 'g' }], 'weight'); expect(ranked.every((item) => item.isBest)).toBe(true) })
  it('拒绝无效规格', () => { expect(() => normalizePrice({ id: 'x', price: 1, amount: 0, unit: 'g' }, 'weight')).toThrow(); expect(() => normalizePrice({ id: 'x', price: 1, amount: 1, unit: 'bad' }, 'weight')).toThrow() })
})
