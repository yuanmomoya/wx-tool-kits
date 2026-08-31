export function validateQrContent(content: string, maxLength = 1000) {
  const normalized = content.trim()
  if (!normalized) throw new RangeError('二维码内容不能为空')
  if (normalized.length > maxLength) throw new RangeError('二维码内容过长')
  return normalized
}

type TextEncoderLike = {
  encode: (input?: string) => Uint8Array
}

type TextEncoderConstructor = new () => TextEncoderLike

type TextEncoderScope = {
  TextEncoder?: TextEncoderConstructor
}

/** 微信部分真机 JSCore 没有 TextEncoder，按 WHATWG 规则编码 UTF-8。 */
export function encodeUtf8(input = ''): Uint8Array {
  const bytes: number[] = []

  for (let index = 0; index < input.length; index += 1) {
    let codePoint = input.charCodeAt(index)

    if (codePoint >= 0xd800 && codePoint <= 0xdbff) {
      const next = input.charCodeAt(index + 1)
      if (next >= 0xdc00 && next <= 0xdfff) {
        codePoint = ((codePoint - 0xd800) << 10) + (next - 0xdc00) + 0x10000
        index += 1
      } else {
        codePoint = 0xfffd
      }
    } else if (codePoint >= 0xdc00 && codePoint <= 0xdfff) {
      codePoint = 0xfffd
    }

    if (codePoint <= 0x7f) {
      bytes.push(codePoint)
    } else if (codePoint <= 0x7ff) {
      bytes.push(
        0xc0 | (codePoint >> 6),
        0x80 | (codePoint & 0x3f),
      )
    } else if (codePoint <= 0xffff) {
      bytes.push(
        0xe0 | (codePoint >> 12),
        0x80 | ((codePoint >> 6) & 0x3f),
        0x80 | (codePoint & 0x3f),
      )
    } else {
      bytes.push(
        0xf0 | (codePoint >> 18),
        0x80 | ((codePoint >> 12) & 0x3f),
        0x80 | ((codePoint >> 6) & 0x3f),
        0x80 | (codePoint & 0x3f),
      )
    }
  }

  return new Uint8Array(bytes)
}

class MiniProgramTextEncoder implements TextEncoderLike {
  encode(input = '') {
    return encodeUtf8(input)
  }
}

export function ensureTextEncoder(
  scope: TextEncoderScope = globalThis as unknown as TextEncoderScope,
) {
  if (typeof scope.TextEncoder !== 'function') {
    scope.TextEncoder = MiniProgramTextEncoder
  }
  return scope.TextEncoder
}

export function createQrPlan(moduleCount: number, size: number, options: { quietModules?: number; logoRatio?: number } = {}) {
  if (!Number.isInteger(moduleCount) || moduleCount <= 0 || size <= 0) throw new RangeError('二维码参数无效')
  const quiet = Math.max(4, options.quietModules ?? 4)
  const totalModules = moduleCount + quiet * 2
  const moduleSize = size / totalModules
  const logoSize = options.logoRatio ? Math.min(size * 0.3, size * options.logoRatio) : 0
  return { moduleCount, quiet, moduleSize, contentSize: moduleCount * moduleSize, logoSize, logoClearSize: logoSize ? logoSize * 1.18 : 0 }
}

export function createQrPosterPlan(qrSize: number) {
  if (qrSize <= 0) throw new RangeError('二维码尺寸无效')
  return { width: qrSize + 96, height: qrSize + 240, qrX: 48, qrY: 48, qrSize }
}
