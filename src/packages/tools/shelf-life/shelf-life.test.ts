import { describe, expect, it } from 'vitest'
import { calculateExpiry, getShelfStatus } from './shelf-life.logic'

describe('保质期计算', () => {
  it('生产日按第 1 天计算日/月/年', () => { expect(calculateExpiry('2026-08-01', 1, 'day')).toBe('2026-08-01'); expect(calculateExpiry('2026-08-01', 30, 'day')).toBe('2026-08-30'); expect(calculateExpiry('2026-01-31', 1, 'month')).toBe('2026-02-27'); expect(calculateExpiry('2024-02-29', 1, 'year')).toBe('2025-02-27') })
  it('区分今天到期、7 天临期和已过期', () => { expect(getShelfStatus('2026-08-01', '2026-08-01')).toEqual({ remainingDays: 0, status: 'soon' }); expect(getShelfStatus('2026-08-08', '2026-08-01').status).toBe('soon'); expect(getShelfStatus('2026-08-09', '2026-08-01').status).toBe('fresh'); expect(getShelfStatus('2026-07-31', '2026-08-01').status).toBe('expired') })
  it('拒绝非正整数保质期', () => { expect(() => calculateExpiry('2026-01-01', 0, 'day')).toThrow(); expect(() => calculateExpiry('2026-01-01', 1.5, 'month')).toThrow() })
})
