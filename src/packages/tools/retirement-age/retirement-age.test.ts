import { describe, expect, it } from 'vitest'
import { addCalendarMonths, calculateRetirementAge, getPolicyDelayMonths } from './retirement-age.logic'

describe('退休年龄', () => {
  it('2025 年前按原年龄退休', () => { const result = calculateRetirementAge('1964-12-15', 'male'); expect(result.oldRetireDate).toBe('2024-12-15'); expect(result.delayMonths).toBe(0) })
  it('按三类人员的渐进步长计算并封顶', () => { expect(getPolicyDelayMonths('2025-01-01', 'male')).toBe(1); expect(getPolicyDelayMonths('2025-05-01', 'female55')).toBe(2); expect(getPolicyDelayMonths('2025-03-01', 'female50')).toBe(2); expect(getPolicyDelayMonths('2200-01-01', 'male')).toBe(36); expect(getPolicyDelayMonths('2200-01-01', 'female50')).toBe(60) })
  it('月末和闰日采用目标月最后一天', () => { expect(addCalendarMonths('2024-02-29', 12)).toBe('2025-02-28'); expect(addCalendarMonths('2026-01-31', 1)).toBe('2026-02-28'); expect(calculateRetirementAge('1975-01-01', 'female50').flexibleRetireDate).toMatch(/^2028-/) })
})
