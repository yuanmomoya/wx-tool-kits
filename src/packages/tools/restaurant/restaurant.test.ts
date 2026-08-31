import { describe, expect, it } from 'vitest'
import { analyzeRestaurant, calculateOpeningCost, calculateRestaurantBreakEven } from './restaurant.logic'

describe('餐饮投资', () => {
  it('汇总建店成本并计算安全预算', () => expect(calculateOpeningCost([100_000, 50_000, 20_000], 0.2)).toEqual({ baseCost: 170_000, safeBudget: 204_000 }))
  it('计算混合毛利和保本营业额', () => { const result = calculateRestaurantBreakEven({ offlineShare: 60, deliveryShare: 40, offlineMargin: 65, deliveryMargin: 45, fixedCost: 55_000 }); expect(result.mixedMargin).toBe(0.57); expect(result.breakEvenRevenue).toBeCloseTo(96491.23); expect(() => calculateRestaurantBreakEven({ offlineShare: 50, deliveryShare: 40, offlineMargin: 60, deliveryMargin: 40, fixedCost: 1 })).toThrow() })
  it('输出净利润、成本率和风险提示', () => { expect(analyzeRestaurant(100_000, 40_000, 30_000)).toEqual({ netProfit: 30_000, costRate: 0.7, risk: 'healthy' }); expect(analyzeRestaurant(100_000, 60_000, 35_000).risk).toBe('tight'); expect(analyzeRestaurant(10, 6, 5).risk).toBe('loss'); expect(() => analyzeRestaurant(1, -1, 0)).toThrow() })
})
