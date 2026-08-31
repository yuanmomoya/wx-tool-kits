// 人社部《个人账户养老金计发月数表》，适用年龄 40–70 岁。
export const ACCOUNT_MONTHS: Record<number, number> = {
  40: 233, 41: 230, 42: 226, 43: 223, 44: 220, 45: 216, 46: 212, 47: 208,
  48: 204, 49: 199, 50: 195, 51: 190, 52: 185, 53: 180, 54: 175, 55: 170,
  56: 164, 57: 158, 58: 152, 59: 145, 60: 139, 61: 132, 62: 125, 63: 117,
  64: 109, 65: 101, 66: 93, 67: 84, 68: 75, 69: 65, 70: 56,
}

export function getAccountMonthsByAge(age: number | string) {
  const normalizedAge = Math.round(Number(age))
  if (!Number.isFinite(normalizedAge) || normalizedAge < 40 || normalizedAge > 70) {
    throw new RangeError('计发年龄必须在 40–70 岁之间')
  }
  return ACCOUNT_MONTHS[normalizedAge]
}

export interface PensionInput {
  currentAge: number; retireAge: number; paidYears: number; accountBalance: number
  monthlyPayBase?: number; estimateBase: number; contributionIndex?: number; accountMonths?: number; extraMonthly?: number
}

export function calculatePension(input: PensionInput) {
  const { currentAge, retireAge, paidYears, accountBalance, monthlyPayBase = 0, estimateBase, extraMonthly = 0 } = input
  if (currentAge <= 0 || retireAge < currentAge || paidYears < 0 || accountBalance < 0 || estimateBase <= 0 || extraMonthly < 0) {
    throw new RangeError('养老金参数无效')
  }
  const futureYears = retireAge - currentAge
  const totalYears = paidYears + futureYears
  if (totalYears <= 0) throw new RangeError('缴费年限必须大于 0')
  const index = Math.max(0.6, Math.min(3, monthlyPayBase > 0 ? monthlyPayBase / estimateBase : (input.contributionIndex ?? 1)))
  const months = input.accountMonths ?? getAccountMonthsByAge(retireAge)
  const futureMonthlyAccount = (monthlyPayBase > 0 ? monthlyPayBase : estimateBase * index) * 0.08
  const futureAccount = accountBalance + futureMonthlyAccount * 12 * futureYears
  const basePension = estimateBase * (1 + index) / 2 * totalYears * 0.01
  const accountPension = futureAccount / months
  return { index, months, futureYears, totalYears, futureAccount, basePension, accountPension, monthlyTotal: basePension + accountPension + extraMonthly }
}
