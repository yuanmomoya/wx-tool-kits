export function calculateCompound(principal: number, monthlyContribution: number, annualRate: number, years: number) {
  if ([principal, monthlyContribution, years].some((value) => !Number.isFinite(value) || value < 0) || annualRate < -100) {
    throw new RangeError('复利参数无效')
  }
  const months = Math.round(years * 12)
  const monthlyRate = (1 + annualRate / 100) ** (1 / 12) - 1
  const principalFuture = principal * (1 + monthlyRate) ** months
  const contributionsFuture = monthlyRate === 0
    ? monthlyContribution * months
    : monthlyContribution * ((1 + monthlyRate) ** months - 1) / monthlyRate
  const invested = principal + monthlyContribution * months
  const total = principalFuture + contributionsFuture
  return { months, monthlyRate, invested, total, profit: total - invested, principalFuture, contributionsFuture }
}
