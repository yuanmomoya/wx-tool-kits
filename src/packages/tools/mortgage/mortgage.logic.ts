export type RepaymentMode = 'equal-interest' | 'equal-principal'

export interface MortgageMonth { month: number; payment: number; principal: number; interest: number; balance: number }

export function calculateMortgage(principal: number, annualRate: number, months: number, mode: RepaymentMode) {
  if (principal < 0 || annualRate < 0 || !Number.isInteger(months) || months <= 0) throw new RangeError('贷款参数无效')
  const monthlyRate = annualRate / 12 / 100
  const schedule: MortgageMonth[] = []
  let balance = principal
  const equalPayment = monthlyRate === 0
    ? principal / months
    : principal * monthlyRate * (1 + monthlyRate) ** months / ((1 + monthlyRate) ** months - 1)
  const monthlyPrincipal = principal / months
  for (let month = 1; month <= months; month += 1) {
    const interest = balance * monthlyRate
    const currentPrincipal = mode === 'equal-interest' ? Math.min(balance, equalPayment - interest) : Math.min(balance, monthlyPrincipal)
    const payment = currentPrincipal + interest
    balance = Math.max(0, balance - currentPrincipal)
    schedule.push({ month, payment, principal: currentPrincipal, interest, balance })
  }
  const totalPayment = schedule.reduce((sum, item) => sum + item.payment, 0)
  return { firstPayment: schedule[0]?.payment || 0, totalPayment, totalInterest: totalPayment - principal, schedule }
}

export function calculateCombinedMortgage(parts: Array<{ principal: number; annualRate: number }>, months: number, mode: RepaymentMode) {
  const results = parts.map((part) => calculateMortgage(part.principal, part.annualRate, months, mode))
  return {
    firstPayment: results.reduce((sum, result) => sum + result.firstPayment, 0),
    totalInterest: results.reduce((sum, result) => sum + result.totalInterest, 0),
    totalPayment: results.reduce((sum, result) => sum + result.totalPayment, 0),
  }
}
