export type ImageFormat = 'jpg' | 'png' | 'webp' | 'auto'

export function normalizeImageFormat(value: string): ImageFormat {
  const format = value.toLowerCase().replace('jpeg', 'jpg')
  return ['jpg', 'png', 'webp'].includes(format) ? format as ImageFormat : 'auto'
}

export function chooseOutputFormat(requested: ImageFormat, source: string) {
  if (requested !== 'auto') return requested
  const normalized = normalizeImageFormat(source)
  return normalized === 'auto' ? 'jpg' : normalized
}

export function calculateTargetDimensions(sourceWidth: number, sourceHeight: number, maxWidth?: number, maxHeight?: number) {
  if (sourceWidth <= 0 || sourceHeight <= 0) throw new RangeError('图片尺寸无效')
  const widthLimit = Math.min(4096, maxWidth || 4096)
  const heightLimit = Math.min(4096, maxHeight || 4096)
  const scale = Math.min(1, widthLimit / sourceWidth, heightLimit / sourceHeight)
  return { width: Math.max(1, Math.round(sourceWidth * scale)), height: Math.max(1, Math.round(sourceHeight * scale)) }
}

export function targetBytes(value: number, unit: 'KB' | 'MB') {
  if (value <= 0) throw new RangeError('目标大小无效')
  return Math.round(value * (unit === 'MB' ? 1024 * 1024 : 1024))
}

export function allowedSizeError(bytes: number) { return Math.max(8 * 1024, bytes * 0.05) }

export async function searchQuality(target: number, encode: (quality: number) => Promise<number>, cancelled = () => false) {
  let low = 0.1; let high = 0.95; let best = { quality: low, bytes: Infinity }
  for (let i = 0; i < 8; i += 1) {
    if (cancelled()) throw new Error('CANCELLED')
    const quality = (low + high) / 2
    const bytes = await encode(quality)
    if (Math.abs(bytes - target) < Math.abs(best.bytes - target)) best = { quality, bytes }
    if (bytes > target) high = quality
    else low = quality
  }
  return best
}
