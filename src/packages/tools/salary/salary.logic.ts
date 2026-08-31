const BRACKETS = [
  { max: 3000, rate: 0.03, deduction: 0 },
  { max: 12000, rate: 0.1, deduction: 210 },
  { max: 25000, rate: 0.2, deduction: 1410 },
  { max: 35000, rate: 0.25, deduction: 2660 },
  { max: 55000, rate: 0.3, deduction: 4410 },
  { max: 80000, rate: 0.35, deduction: 7160 },
  { max: Infinity, rate: 0.45, deduction: 15160 },
] as const

export function calculateMonthlyTax(taxableIncome: number) {
  if (!Number.isFinite(taxableIncome)) throw new RangeError('应纳税所得额无效')
  if (taxableIncome <= 0) return 0
  const bracket = BRACKETS.find((item) => taxableIncome <= item.max)!
  return Math.max(0, taxableIncome * bracket.rate - bracket.deduction)
}

export function calculateSalary(gross: number, socialInsurance = 0, housingFund = 0, specialDeduction = 0) {
  if ([gross, socialInsurance, housingFund, specialDeduction].some((value) => value < 0 || !Number.isFinite(value))) {
    throw new RangeError('工资参数不能为负数')
  }
  const taxableIncome = Math.max(0, gross - 5000 - socialInsurance - housingFund - specialDeduction)
  const tax = calculateMonthlyTax(taxableIncome)
  return { taxableIncome, tax, net: gross - socialInsurance - housingFund - tax }
}
