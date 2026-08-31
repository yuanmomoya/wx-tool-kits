import { describe, expect, it } from 'vitest'
import { ACCOUNT_MONTHS, calculatePension, getAccountMonthsByAge } from './retirement-pension.logic'

describe('养老金估算', () => {
  it('包含人社部 40–70 岁完整计发月数表', () => { expect(Object.keys(ACCOUNT_MONTHS)).toHaveLength(31); expect(getAccountMonthsByAge(40)).toBe(233); expect(getAccountMonthsByAge(61)).toBe(132); expect(getAccountMonthsByAge(62)).toBe(125); expect(getAccountMonthsByAge(63)).toBe(117); expect(getAccountMonthsByAge(64)).toBe(109); expect(getAccountMonthsByAge(70)).toBe(56) })
  it('计算基础养老金、个人账户、未来缴费和额外金额', () => { const result = calculatePension({ currentAge: 50, retireAge: 60, paidYears: 20, accountBalance: 100_000, monthlyPayBase: 12_000, estimateBase: 8000, extraMonthly: 100 }); expect(result.index).toBe(1.5); expect(result.futureAccount).toBe(215_200); expect(result.basePension).toBe(3000); expect(result.monthlyTotal).toBeCloseTo(4648.2, 1) })
  it('将缴费指数限制在 0.6–3，并拒绝倒挂年龄', () => { expect(calculatePension({ currentAge: 50, retireAge: 60, paidYears: 1, accountBalance: 0, monthlyPayBase: 1, estimateBase: 10_000 }).index).toBe(0.6); expect(calculatePension({ currentAge: 50, retireAge: 60, paidYears: 1, accountBalance: 0, monthlyPayBase: 100_000, estimateBase: 10_000 }).index).toBe(3); expect(() => calculatePension({ currentAge: 61, retireAge: 60, paidYears: 1, accountBalance: 0, estimateBase: 8000 })).toThrow(); expect(() => getAccountMonthsByAge(39)).toThrow() })
})
