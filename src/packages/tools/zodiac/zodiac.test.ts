import { describe, expect, it } from 'vitest'
import { getZodiac } from './zodiac.logic'

describe('星座查询', () => {
  it.each([[1, 1, '摩羯座'], [2, 1, '水瓶座'], [3, 1, '双鱼座'], [4, 1, '白羊座'], [5, 1, '金牛座'], [6, 1, '双子座'], [7, 1, '巨蟹座'], [8, 1, '狮子座'], [9, 1, '处女座'], [10, 1, '天秤座'], [11, 1, '天蝎座'], [12, 1, '射手座']] as const)('识别十二星座 %s/%s', (month, day, result) => expect(getZodiac(month, day)).toBe(result))
  it.each([[1, 19, '摩羯座'], [1, 20, '水瓶座'], [2, 18, '水瓶座'], [2, 19, '双鱼座'], [3, 20, '双鱼座'], [3, 21, '白羊座'], [4, 19, '白羊座'], [4, 20, '金牛座'], [12, 21, '射手座'], [12, 22, '摩羯座']] as const)('覆盖交界日 %s/%s', (month, day, result) => expect(getZodiac(month, day)).toBe(result))
  it('拒绝非法日期', () => { expect(() => getZodiac(2, 30)).toThrow(); expect(() => getZodiac(13, 1)).toThrow() })
})
