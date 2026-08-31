import { describe, expect, it, vi } from 'vitest'
import { chooseIndex, cloneTemplate, createTimerRegistry, createWheelResult, validateChoices } from './choice-helper.logic'

describe('选择困难助手', () => {
  it('模板深克隆不污染源数组', () => { const source = ['吃饭', '散步']; const cloned = cloneTemplate(source); cloned[0] = '睡觉'; expect(source[0]).toBe('吃饭') })
  it('至少两个选项，保留重复选项', () => { expect(validateChoices([' A ', 'A', ''])).toEqual(['A', 'A']); expect(() => validateChoices(['only'])).toThrow() })
  it('固定随机数命中指定项并计算最终滚轮位置', () => { expect(chooseIndex(4, () => 0.5)).toBe(2); expect(createWheelResult(['a', 'b', 'c'], () => 0.99, 4)).toEqual({ index: 2, choice: 'c', finalOffset: -672 }) })
  it('清理所有定时器', () => { const callback = vi.fn(); const timers = createTimerRegistry(); timers.add(setTimeout(callback, 100) as unknown as NodeJS.Timeout); timers.add(setTimeout(callback, 200) as unknown as NodeJS.Timeout); expect(timers.size).toBe(2); timers.clear(); expect(timers.size).toBe(0); vi.advanceTimersByTime(500); expect(callback).not.toHaveBeenCalled() })
})
