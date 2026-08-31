export const ZODIAC_RANGES = [
  ['摩羯座', 1222, 119], ['水瓶座', 120, 218], ['双鱼座', 219, 320], ['白羊座', 321, 419],
  ['金牛座', 420, 520], ['双子座', 521, 621], ['巨蟹座', 622, 722], ['狮子座', 723, 822],
  ['处女座', 823, 922], ['天秤座', 923, 1023], ['天蝎座', 1024, 1122], ['射手座', 1123, 1221],
] as const

export function getZodiac(month: number, day: number) {
  const test = new Date(Date.UTC(2024, month - 1, day))
  if (test.getUTCMonth() !== month - 1 || test.getUTCDate() !== day) throw new RangeError('生日无效')
  const key = month * 100 + day
  const range = ZODIAC_RANGES.find(([, start, end]) => start > end ? key >= start || key <= end : key >= start && key <= end)
  if (!range) throw new RangeError('生日无效')
  return range[0]
}
