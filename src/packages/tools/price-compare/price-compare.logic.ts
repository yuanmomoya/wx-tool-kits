const FACTORS = {
  weight: { kg: 1000, g: 1, jin: 500 },
  volume: { l: 1000, ml: 1 },
  quantity: { piece: 1, pack: 1 },
} as const

export interface PriceItem { id: string; price: number; amount: number; unit: string }

export function normalizePrice(item: PriceItem, mode: keyof typeof FACTORS) {
  const factor = (FACTORS[mode] as Record<string, number>)[item.unit]
  if (item.price < 0 || item.amount <= 0 || !factor) throw new RangeError('比价规格无效')
  return { ...item, baseAmount: item.amount * factor, unitPrice: item.price / (item.amount * factor) }
}

export function rankPrices(items: PriceItem[], mode: keyof typeof FACTORS, tolerance = 1e-9) {
  const ranked = items.map((item) => normalizePrice(item, mode)).sort((a, b) => a.unitPrice - b.unitPrice)
  const best = ranked[0]
  return ranked.map((item) => ({
    ...item,
    isBest: Math.abs(item.unitPrice - best.unitPrice) <= tolerance,
    advantagePercent: item.unitPrice === 0 ? 0 : (item.unitPrice - best.unitPrice) / item.unitPrice * 100,
  }))
}
