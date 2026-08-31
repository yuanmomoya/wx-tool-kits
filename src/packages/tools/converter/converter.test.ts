import { describe, expect, it } from 'vitest'
import { convertTemperature, convertUnit, formatConverted } from './converter.logic'

describe('单位换算', () => {
  it('双向换算长度、面积、重量和体积', () => { expect(convertUnit('length', 1, 'km', 'm')).toBe(1000); expect(convertUnit('length', 100, 'cm', 'm')).toBe(1); expect(convertUnit('area', 1, 'm2', 'cm2')).toBe(10_000); expect(convertUnit('weight', 1, 'kg', 'g')).toBe(1000); expect(convertUnit('volume', 1000, 'ml', 'l')).toBe(1); expect(convertUnit('volume', 1, 'l', 'ml')).toBe(1000) })
  it('覆盖温标关键点、同单位和负温度', () => { expect(convertTemperature(0, 'c', 'f')).toBe(32); expect(convertTemperature(100, 'c', 'k')).toBe(373.15); expect(convertTemperature(-40, 'f', 'c')).toBeCloseTo(-40); expect(convertTemperature(12, 'c', 'c')).toBe(12); expect(() => convertTemperature(-1, 'k', 'k')).toThrow() })
  it('稳定格式化精度并拒绝单位错误', () => { expect(formatConverted(1 / 3)).toBe('0.3333333333'); expect(formatConverted(Infinity)).toBe('--'); expect(() => convertUnit('length', 1, 'bad', 'm')).toThrow() })
})
