export type BmiLevel = 'underweight' | 'normal' | 'overweight' | 'obese'

export function classifyBmi(bmi: number): BmiLevel {
  if (bmi < 18.5) return 'underweight'
  if (bmi < 24) return 'normal'
  if (bmi < 28) return 'overweight'
  return 'obese'
}

export function calculateBmi(heightCm: number, weightKg: number) {
  if (!Number.isFinite(heightCm) || !Number.isFinite(weightKg) || heightCm <= 0 || weightKg <= 0) {
    throw new RangeError('身高和体重必须为正数')
  }
  const heightM = heightCm / 100
  const bmi = weightKg / heightM ** 2
  return {
    bmi,
    level: classifyBmi(bmi),
    healthyWeight: [18.5 * heightM ** 2, 23.9 * heightM ** 2] as const,
    markerPercent: Math.max(0, Math.min(100, ((bmi - 12) / (40 - 12)) * 100)),
  }
}
