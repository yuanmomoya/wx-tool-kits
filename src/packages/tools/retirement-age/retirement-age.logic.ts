import { formatCalendarDate, parseCalendarDate } from '../date-diff/date-diff.logic'

export type WorkerType = 'male' | 'female55' | 'female50'
export const WORKER_RULES = {
  male: { baseAgeMonths: 720, maxDelayMonths: 36, stepMonths: 4 },
  female55: { baseAgeMonths: 660, maxDelayMonths: 36, stepMonths: 4 },
  female50: { baseAgeMonths: 600, maxDelayMonths: 60, stepMonths: 2 },
} as const

export function addCalendarMonths(value: string, months: number) {
  const source = new Date(parseCalendarDate(value))
  const monthIndex = source.getUTCMonth() + months
  const year = source.getUTCFullYear() + Math.floor(monthIndex / 12)
  const month = ((monthIndex % 12) + 12) % 12
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  return formatCalendarDate(Date.UTC(year, month, Math.min(source.getUTCDate(), lastDay)))
}

export function getPolicyDelayMonths(oldRetireDate: string, workerType: WorkerType) {
  const rule = WORKER_RULES[workerType]
  const oldDate = new Date(parseCalendarDate(oldRetireDate))
  const monthIndex = oldDate.getUTCFullYear() * 12 + oldDate.getUTCMonth()
  const policyStart = 2025 * 12
  if (monthIndex < policyStart) return 0
  return Math.min(Math.floor((monthIndex - policyStart) / rule.stepMonths) + 1, rule.maxDelayMonths)
}

export function calculateRetirementAge(birthDate: string, workerType: WorkerType) {
  const rule = WORKER_RULES[workerType]
  if (!rule) throw new RangeError('人员类型无效')
  const oldRetireDate = addCalendarMonths(birthDate, rule.baseAgeMonths)
  const delayMonths = getPolicyDelayMonths(oldRetireDate, workerType)
  const retireDate = addCalendarMonths(oldRetireDate, delayMonths)
  return {
    oldRetireDate,
    delayMonths,
    retireDate,
    retireAgeMonths: rule.baseAgeMonths + delayMonths,
    flexibleRetireDate: addCalendarMonths(retireDate, 36),
  }
}
