export function calculateOpeningCost(costs: number[], reserveRate = 0.2) {
  if (costs.some((cost) => cost < 0) || reserveRate < 0) throw new RangeError('成本参数无效')
  const baseCost = costs.reduce((sum, cost) => sum + cost, 0)
  return { baseCost, safeBudget: baseCost * (1 + reserveRate) }
}

export function calculateRestaurantBreakEven(input: {
  offlineShare: number; deliveryShare: number; offlineMargin: number; deliveryMargin: number; fixedCost: number
}) {
  if (Math.abs(input.offlineShare + input.deliveryShare - 100) > 1e-6) throw new RangeError('渠道占比之和必须为 100%')
  const margin = (input.offlineShare * input.offlineMargin + input.deliveryShare * input.deliveryMargin) / 10_000
  if (margin <= 0 || margin > 1 || input.fixedCost < 0) throw new RangeError('毛利参数无效')
  return { mixedMargin: margin, breakEvenRevenue: input.fixedCost / margin }
}

export function analyzeRestaurant(revenue: number, variableCost: number, fixedCost: number) {
  if ([revenue, variableCost, fixedCost].some((value) => value < 0)) throw new RangeError('经营参数无效')
  const netProfit = revenue - variableCost - fixedCost
  const costRate = revenue === 0 ? 0 : (variableCost + fixedCost) / revenue
  return { netProfit, costRate, risk: netProfit < 0 ? 'loss' : costRate >= 0.9 ? 'tight' : 'healthy' as 'loss' | 'tight' | 'healthy' }
}
