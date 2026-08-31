export function createPrivacyReencodePlan(width: number, height: number, maxSide = 4096, sourceFormat = 'jpg') {
  if (width <= 0 || height <= 0) throw new RangeError('图片尺寸无效')
  const scale = Math.min(1, maxSide / Math.max(width, height))
  return {
    width: Math.round(width * scale), height: Math.round(height * scale),
    fileType: sourceFormat.toLowerCase() === 'png' ? 'png' as const : 'jpg' as const,
    stripsMetadata: true,
  }
}
