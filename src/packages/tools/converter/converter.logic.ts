export const UNIT_GROUPS = {
  length: { m: 1, km: 1000, cm: 0.01, mm: 0.001, in: 0.0254 },
  area: { m2: 1, km2: 1_000_000, cm2: 0.0001, mu: 666.6666667 },
  weight: { kg: 1, g: 0.001, t: 1000, lb: 0.45359237 },
  volume: { l: 1, ml: 0.001, m3: 1000, gal: 3.785411784 },
} as const

export function convertUnit(group: keyof typeof UNIT_GROUPS, value: number, from: string, to: string) {
  const units = UNIT_GROUPS[group] as Record<string, number>
  if (!Number.isFinite(value) || !units[from] || !units[to]) throw new RangeError('换算参数无效')
  return value * units[from] / units[to]
}

export function convertTemperature(value: number, from: 'c' | 'f' | 'k', to: 'c' | 'f' | 'k') {
  if (!Number.isFinite(value)) throw new RangeError('温度无效')
  const celsius = from === 'c' ? value : from === 'f' ? (value - 32) * 5 / 9 : value - 273.15
  const output = to === 'c' ? celsius : to === 'f' ? celsius * 9 / 5 + 32 : celsius + 273.15
  if (to === 'k' && output < 0) throw new RangeError('温度低于绝对零度')
  return output
}

export function formatConverted(value: number) {
  if (!Number.isFinite(value)) return '--'
  return Number(value.toPrecision(10)).toString()
}
