import { addCalendarDays, calendarDayDiff, formatCalendarDate, parseCalendarDate } from '../date-diff/date-diff.logic'

export type ShelfUnit = 'day' | 'month' | 'year'

function addMonthsClamped(date: string, months: number) {
  const time = parseCalendarDate(date)
  const source = new Date(time)
  const targetYear = source.getUTCFullYear() + Math.floor((source.getUTCMonth() + months) / 12)
  const targetMonth = ((source.getUTCMonth() + months) % 12 + 12) % 12
  const maxDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate()
  return formatCalendarDate(Date.UTC(targetYear, targetMonth, Math.min(source.getUTCDate(), maxDay)))
}

export function calculateExpiry(productionDate: string, duration: number, unit: ShelfUnit) {
  if (!Number.isInteger(duration) || duration <= 0) throw new RangeError('保质期必须为正整数')
  if (unit === 'day') return addCalendarDays(productionDate, duration - 1)
  const boundary = addMonthsClamped(productionDate, unit === 'year' ? duration * 12 : duration)
  return addCalendarDays(boundary, -1)
}

export function getShelfStatus(expiryDate: string, today: string) {
  const remainingDays = calendarDayDiff(today, expiryDate)
  return { remainingDays, status: remainingDays < 0 ? 'expired' : remainingDays <= 7 ? 'soon' : 'fresh' as 'expired' | 'soon' | 'fresh' }
}
