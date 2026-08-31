import { describe, expect, it } from 'vitest'
import { DEFAULT_PX_PER_MM, buildTicks, clampPanelHeight, getPxPerMm, parseCalibration } from './ruler.logic'

describe('校准尺子', () => {
  it('提供默认估算和校准比例', () => { expect(DEFAULT_PX_PER_MM).toBeCloseTo(3.7795); expect(getPxPerMm(324, 85.6)).toBeCloseTo(3.785) })
  it('限制面板高度并生成主/中/小刻度', () => { expect(clampPanelHeight(10, 1000)).toBe(120); expect(clampPanelHeight(900, 1000)).toBe(800); const ticks = buildTicks(2, 4); expect(ticks).toHaveLength(21); expect(ticks[0].major).toBe(true); expect(ticks[5].medium).toBe(true); expect(ticks[20].px).toBe(8) })
  it('兼容异常或损坏的存储数据', () => { expect(parseCalibration({ pxPerMm: 4 })).toBe(4); expect(parseCalibration({ pxPerMm: -1 })).toBe(DEFAULT_PX_PER_MM); expect(parseCalibration('broken')).toBe(DEFAULT_PX_PER_MM); expect(() => getPxPerMm(0, 85)).toThrow() })
})
