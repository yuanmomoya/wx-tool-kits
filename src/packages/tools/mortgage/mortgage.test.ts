import { describe, expect, it } from 'vitest'
import { calculateCombinedMortgage, calculateMortgage } from './mortgage.logic'

describe('房贷计算器', () => {
  it('等额本息的月供固定且本金合计等于贷款', () => { const result = calculateMortgage(1_000_000, 3.5, 360, 'equal-interest'); expect(result.schedule[0].payment).toBeCloseTo(result.schedule[100].payment, 6); expect(result.schedule.reduce((s, m) => s + m.principal, 0)).toBeCloseTo(1_000_000, 2); expect(result.totalInterest).toBeGreaterThan(0) })
  it('等额本金月供递减', () => { const result = calculateMortgage(600_000, 3, 120, 'equal-principal'); const last = result.schedule[result.schedule.length - 1]; expect(result.firstPayment).toBeGreaterThan(last.payment); expect(last.balance).toBe(0) })
  it('处理零利率及组合贷', () => { expect(calculateMortgage(120_000, 0, 12, 'equal-interest').firstPayment).toBeCloseTo(10_000); const combined = calculateCombinedMortgage([{ principal: 400_000, annualRate: 3 }, { principal: 200_000, annualRate: 2.6 }], 240, 'equal-interest'); expect(combined.totalPayment).toBeGreaterThan(600_000); expect(() => calculateMortgage(1, -1, 12, 'equal-interest')).toThrow() })
})
