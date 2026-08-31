import { describe, expect, it } from 'vitest'
import { calculateMonthlyTax, calculateSalary } from './salary.logic'

describe('工资计算器', () => {
  it.each([[0, 0], [3000, 90], [3000.01, 90.001], [12000, 990], [25000, 3590], [35000, 6090], [55000, 12090], [80000, 20840]])('覆盖月税率临界点 %s', (income, expected) => expect(calculateMonthlyTax(income)).toBeCloseTo(expected, 2))
  it('扣除 5000、五险一金和专项扣除', () => { const result = calculateSalary(20_000, 2000, 1000, 2000); expect(result.taxableIncome).toBe(10_000); expect(result.tax).toBe(790); expect(result.net).toBe(16_210) })
  it('低工资零税额并拒绝负数', () => { expect(calculateSalary(5000).tax).toBe(0); expect(() => calculateSalary(-1)).toThrow(RangeError) })
})
