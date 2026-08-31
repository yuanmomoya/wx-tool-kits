import { describe, expect, it } from 'vitest'
import { calculateBmi, classifyBmi } from './bmi.logic'

describe('BMI', () => {
  it('计算 BMI、健康体重和仪表位置', () => { const result = calculateBmi(175, 70); expect(result.bmi).toBeCloseTo(22.857); expect(result.level).toBe('normal'); expect(result.healthyWeight[0]).toBeCloseTo(56.66); expect(result.markerPercent).toBeGreaterThan(0) })
  it.each([[18.49, 'underweight'], [18.5, 'normal'], [23.99, 'normal'], [24, 'overweight'], [27.99, 'overweight'], [28, 'obese']] as const)('按国标划分 %s', (value, level) => expect(classifyBmi(value)).toBe(level))
  it('限制仪表并拒绝非法输入', () => { expect(calculateBmi(100, 300).markerPercent).toBe(100); expect(() => calculateBmi(0, 70)).toThrow(RangeError); expect(() => calculateBmi(170, -1)).toThrow(RangeError) })
})
