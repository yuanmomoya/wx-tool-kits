import { describe, expect, it } from 'vitest'
import { createCanvasRecorder } from '@/test/setup'
import { createWatermarkPlan, executeWatermarkPlan, normalizeWatermarkText, scaleWatermarkImage } from './image-watermark.logic'

describe('图片加水印', () => {
  it('清理空行并最多保留三行', () => expect(normalizeWatermarkText(' 第一行 \n\n第二行\r\n 第三行 \n第四行')).toEqual(['第一行', '第二行', '第三行']))
  it('超大图等比缩放并限制透明度', () => { expect(scaleWatermarkImage(8000, 4000)).toEqual({ width: 4096, height: 2048, scale: 0.512 }); expect(createWatermarkPlan(100, 100, { opacity: 2, rotation: 90, tiled: false })).toMatchObject({ opacity: 1, rotationRadians: Math.PI / 2, positions: [{ x: 50, y: 50 }] }) })
  it('生成平铺坐标且每次绘制保存/恢复 Canvas 状态', () => { const plan = createWatermarkPlan(200, 100, { opacity: 0.3, rotation: -30, tiled: true, gap: 50 }); expect(plan.positions.length).toBeGreaterThan(4); const { context, calls } = createCanvasRecorder(); executeWatermarkPlan(context as any, '测试', plan); expect(calls.filter((call) => call.method === 'save')).toHaveLength(plan.positions.length); expect(calls.filter((call) => call.method === 'restore')).toHaveLength(plan.positions.length); expect(calls.filter((call) => call.method === 'fillText')).toHaveLength(plan.positions.length) })
})
