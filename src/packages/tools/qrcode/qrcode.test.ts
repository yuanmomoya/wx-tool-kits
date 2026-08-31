import { describe, expect, it } from 'vitest'
import QRCode from 'qrcode'
import {
  createQrPlan,
  createQrPosterPlan,
  encodeUtf8,
  ensureTextEncoder,
  validateQrContent,
} from './qrcode.logic'

describe('二维码生成', () => {
  it('拒绝空内容和超长内容', () => { expect(validateQrContent(' hello ')).toBe('hello'); expect(() => validateQrContent(' ')).toThrow(); expect(() => validateQrContent('a'.repeat(1001))).toThrow() })
  it('在缺少 TextEncoder 的真机环境编码中文和 emoji', () => {
    const content = '二维码😀\ud800'
    expect(Array.from(encodeUtf8(content))).toEqual(Array.from(new TextEncoder().encode(content)))

    const scope: { TextEncoder?: new () => { encode: (input?: string) => Uint8Array } } = {}
    const Encoder = ensureTextEncoder(scope)
    expect(Array.from(new Encoder().encode('微信二维码'))).toEqual(
      Array.from(new TextEncoder().encode('微信二维码')),
    )
  })
  it('安装后备实现后 qrcode 库可以在无 TextEncoder 环境生成矩阵', () => {
    const mutableGlobal = globalThis as { TextEncoder?: typeof TextEncoder }
    const nativeTextEncoder = globalThis.TextEncoder
    try {
      mutableGlobal.TextEncoder = undefined
      ensureTextEncoder()
      expect(QRCode.create('微信二维码😀').modules.size).toBeGreaterThan(20)
    } finally {
      mutableGlobal.TextEncoder = nativeTextEncoder
    }
  })
  it('生成二维码矩阵及含静区和 logo 留白的计划', () => { const matrix = QRCode.create('https://example.com'); expect(matrix.modules.size).toBeGreaterThan(20); const plan = createQrPlan(matrix.modules.size, 300, { quietModules: 4, logoRatio: 0.2 }); expect(plan.quiet).toBe(4); expect(plan.contentSize).toBeLessThan(300); expect(plan.logoSize).toBe(60); expect(plan.logoClearSize).toBeGreaterThan(plan.logoSize) })
  it('规划海报合成尺寸并暴露导出失败', async () => { expect(createQrPosterPlan(300)).toEqual({ width: 396, height: 540, qrX: 48, qrY: 48, qrSize: 300 }); const exportImage = async () => { throw new Error('canvas export failed') }; await expect(exportImage()).rejects.toThrow('canvas export failed'); await expect(Promise.reject(new Error('share failed'))).rejects.toThrow('share failed') })
})
