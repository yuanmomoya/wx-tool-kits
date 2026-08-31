import { describe, expect, it } from 'vitest'
import { generatePattern, getPatternStats, replacePatternColor, rgbToLab } from '@/utils/pindou-engine'
import { createPatternHistory } from './pindou.logic'

const imageData = (pixels: number[]) => ({ data: new Uint8ClampedArray(pixels) } as ImageData)

describe('拼豆', () => {
  it('将 RGB 转 Lab 并匹配最近色', () => { const white = rgbToLab(255, 255, 255); const black = rgbToLab(0, 0, 0); expect(white.l).toBeGreaterThan(black.l); const pattern = generatePattern(imageData([255, 0, 0, 255]), 1, 1); expect(pattern.cells[0]).toBeGreaterThanOrEqual(0); expect(pattern.totalBeads).toBe(1) })
  it('裁除白色背景并限制颜色数量', () => { const data = imageData([255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 0, 0, 255]); const cropped = generatePattern(data, 2, 2, { removeWhite: true, colorLimit: 1 }); expect(cropped.width).toBe(1); expect(cropped.height).toBe(1); expect(cropped.stats).toHaveLength(1); expect(cropped.totalBeads).toBe(1) })
  it('统计色号、整版换色并保留空格', () => { const stats = getPatternStats([1, 1, 2, -1]); expect(stats.totalBeads).toBe(3); expect(stats.stats[0].count).toBe(2); expect(replacePatternColor([1, 2, -1], 1, 3)).toEqual([3, 2, -1]) })
  it('透明或纯白背景可得到空网格', () => { expect(generatePattern(imageData([0, 0, 0, 0]), 1, 1).width).toBe(0); expect(generatePattern(imageData([255, 255, 255, 255]), 1, 1, { removeWhite: true }).cells).toEqual([]) })
  it('核心状态支持撤销、重做和新操作清空重做栈', () => { const history = createPatternHistory([1, 2]); history.apply([2, 2]); expect(history.canUndo).toBe(true); expect(history.undo()).toEqual([1, 2]); expect(history.canRedo).toBe(true); expect(history.redo()).toEqual([2, 2]); history.undo(); history.apply([3, 3]); expect(history.canRedo).toBe(false) })
  it('撤销栈有上限，空栈操作保持当前状态', () => { const history = createPatternHistory([0], 1); expect(history.undo()).toEqual([0]); expect(history.redo()).toEqual([0]); history.apply([1]); history.apply([2]); expect(history.undo()).toEqual([1]); expect(history.undo()).toEqual([1]) })
  it('处理透明像素、多个限色及不规则白色边缘裁切', () => { const pixels = imageData([
    255,255,255,255, 255,255,255,255, 255,255,255,255,
    255,255,255,255, 255,0,0,255, 0,0,0,0,
    255,255,255,255, 0,0,255,255, 255,255,255,255,
  ]); const pattern = generatePattern(pixels, 3, 3, { removeWhite: true, colorLimit: 2, whiteThreshold: 999 }); expect(pattern.width).toBe(1); expect(pattern.height).toBe(2); expect(pattern.totalBeads).toBe(2); expect(pattern.stats.length).toBeLessThanOrEqual(2) })
  it('色号数量相同按编码稳定排序，未知替换色不影响其他格', () => { const result = getPatternStats([2, 1]); expect(result.stats.map((item) => item.code)).toEqual([...result.stats.map((item) => item.code)].sort()); expect(replacePatternColor([-1, 1, 2], 99, 3)).toEqual([-1, 1, 2]) })
})
