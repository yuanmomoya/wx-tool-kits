const DAY_MS = 86_400_000

export function parseCalendarDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) throw new RangeError('日期格式无效')
  const [year, month, day] = match.slice(1).map(Number)
  const timestamp = Date.UTC(year, month - 1, day)
  const date = new Date(timestamp)
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) throw new RangeError('日期无效')
  return timestamp
}

export function formatCalendarDate(timestamp: number) {
  return new Date(timestamp).toISOString().slice(0, 10)
}

export function calendarDayDiff(start: string, end: string, inclusive = false) {
  const diff = Math.round((parseCalendarDate(end) - parseCalendarDate(start)) / DAY_MS)
  return diff + (inclusive ? (diff >= 0 ? 1 : -1) : 0)
}

export function addCalendarDays(date: string, offset: number) {
  if (!Number.isInteger(offset)) throw new RangeError('偏移天数必须为整数')
  return formatCalendarDate(parseCalendarDate(date) + offset * DAY_MS)
}

export function countWeekdays(start: string, end: string, inclusive = false) {
  const startTime = parseCalendarDate(start)
  const endTime = parseCalendarDate(end)
  const direction = endTime >= startTime ? 1 : -1
  let count = 0
  for (let time = startTime; direction > 0 ? time < endTime : time > endTime; time += direction * DAY_MS) {
    const day = new Date(time).getUTCDay()
    if (day !== 0 && day !== 6) count += direction
  }
  if (inclusive) {
    const day = new Date(endTime).getUTCDay()
    if (day !== 0 && day !== 6) count += direction
  }
  return count
}
