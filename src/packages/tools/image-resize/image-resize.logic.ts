export type FitMode = 'cover' | 'contain' | 'stretch'
export interface DrawPlan { sx: number; sy: number; sw: number; sh: number; dx: number; dy: number; dw: number; dh: number }

export function normalizeResizeSize(width: number, height: number) {
  if (![width, height].every(Number.isFinite)) throw new RangeError('尺寸无效')
  return { width: Math.round(Math.min(4096, Math.max(50, width))), height: Math.round(Math.min(4096, Math.max(50, height))) }
}

export function createResizePlan(sourceWidth: number, sourceHeight: number, targetWidth: number, targetHeight: number, mode: FitMode): DrawPlan {
  if ([sourceWidth, sourceHeight, targetWidth, targetHeight].some((value) => value <= 0)) throw new RangeError('尺寸无效')
  if (mode === 'stretch') return { sx: 0, sy: 0, sw: sourceWidth, sh: sourceHeight, dx: 0, dy: 0, dw: targetWidth, dh: targetHeight }
  if (mode === 'contain') {
    const scale = Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight)
    const dw = sourceWidth * scale; const dh = sourceHeight * scale
    return { sx: 0, sy: 0, sw: sourceWidth, sh: sourceHeight, dx: (targetWidth - dw) / 2, dy: (targetHeight - dh) / 2, dw, dh }
  }
  const sourceRatio = sourceWidth / sourceHeight; const targetRatio = targetWidth / targetHeight
  const sw = sourceRatio > targetRatio ? sourceHeight * targetRatio : sourceWidth
  const sh = sourceRatio > targetRatio ? sourceHeight : sourceWidth / targetRatio
  return { sx: (sourceWidth - sw) / 2, sy: (sourceHeight - sh) / 2, sw, sh, dx: 0, dy: 0, dw: targetWidth, dh: targetHeight }
}

export function getResizeExport(format: 'jpg' | 'png') { return { fileType: format, quality: format === 'jpg' ? 0.92 : 1 } }
