import { describe, expect, it } from 'vitest'
import { addCalendarDays, calendarDayDiff, countWeekdays, parseCalendarDate } from './date-diff.logic'

describe('日期间隔', () => {
  it('覆盖同日、正反向和包含首尾', () => { expect(calendarDayDiff('2026-08-01', '2026-08-01')).toBe(0); expect(calendarDayDiff('2026-08-01', '2026-08-11')).toBe(10); expect(calendarDayDiff('2026-08-11', '2026-08-01')).toBe(-10); expect(calendarDayDiff('2026-08-01', '2026-08-11', true)).toBe(11); expect(calendarDayDiff('2026-08-11', '2026-08-01', true)).toBe(-11) })
  it('覆盖工作日、闰年和跨年偏移', () => { expect(countWeekdays('2026-07-31', '2026-08-03', true)).toBe(2); expect(calendarDayDiff('2024-02-28', '2024-03-01')).toBe(2); expect(addCalendarDays('2025-12-31', 1)).toBe('2026-01-01'); expect(addCalendarDays('2026-01-01', -1)).toBe('2025-12-31') })
  it('纯 UTC 日历运算并拒绝非法日期', () => { expect(parseCalendarDate('2026-08-01')).toBe(Date.UTC(2026, 7, 1)); expect(() => parseCalendarDate('2026-02-30')).toThrow(); expect(() => addCalendarDays('2026-01-01', 0.5)).toThrow() })
})
