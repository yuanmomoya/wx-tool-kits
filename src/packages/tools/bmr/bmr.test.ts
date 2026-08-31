import { describe, expect, it } from 'vitest'
import { ACTIVITY_FACTORS, calculateBmr, calculateEnergyPlan } from './bmr.logic'

describe('基础代谢率', () => {
  it('使用男女 Mifflin–St Jeor 公式并取整', () => { expect(calculateBmr('male', 30, 175, 70)).toBe(1649); expect(calculateBmr('female', 30, 165, 55)).toBe(1270) })
  it.each(ACTIVITY_FACTORS)('支持活动系数 %s', (factor) => expect(calculateEnergyPlan('male', 30, 175, 70, factor).maintenance).toBe(Math.round(1649 * factor)))
  it('减脂热量不低于 BMR，并拒绝异常输入', () => { expect(calculateEnergyPlan('female', 30, 165, 55, 1.2).fatLoss).toBe(1270); expect(() => calculateBmr('male', 0, 175, 70)).toThrow(); expect(() => calculateEnergyPlan('male', 30, 175, 70, 2)).toThrow() })
})
