export const ACTIVITY_FACTORS = [1.2, 1.375, 1.55, 1.725] as const

export function calculateBmr(gender: 'male' | 'female', age: number, heightCm: number, weightKg: number) {
  if (!['male', 'female'].includes(gender) || age <= 0 || heightCm <= 0 || weightKg <= 0) {
    throw new RangeError('基础代谢参数无效')
  }
  const offset = gender === 'male' ? 5 : -161
  return Math.round(10 * weightKg + 6.25 * heightCm - 5 * age + offset)
}

export function calculateEnergyPlan(
  gender: 'male' | 'female', age: number, heightCm: number, weightKg: number, activityFactor: number,
) {
  if (!ACTIVITY_FACTORS.includes(activityFactor as typeof ACTIVITY_FACTORS[number])) {
    throw new RangeError('活动系数无效')
  }
  const bmr = calculateBmr(gender, age, heightCm, weightKg)
  const maintenance = Math.round(bmr * activityFactor)
  return { bmr, maintenance, fatLoss: Math.max(bmr, Math.round(maintenance - 500)) }
}
