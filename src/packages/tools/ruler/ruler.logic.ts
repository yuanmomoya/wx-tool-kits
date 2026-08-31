export const DEFAULT_PX_PER_MM = 96 / 25.4

export function getPxPerMm(referencePixels: number, referenceMm: number) {
  if (referencePixels <= 0 || referenceMm <= 0) throw new RangeError('校准参数无效')
  return referencePixels / referenceMm
}

export function clampPanelHeight(value: number, viewportHeight: number) {
  if (viewportHeight <= 0) throw new RangeError('屏幕高度无效')
  return Math.min(Math.max(value, 120), viewportHeight * 0.8)
}

export function buildTicks(lengthMm: number, pxPerMm: number) {
  if (lengthMm <= 0 || pxPerMm <= 0) throw new RangeError('刻度参数无效')
  return Array.from({ length: Math.floor(lengthMm) * 10 + 1 }, (_, index) => ({
    mm: index / 10, px: index / 10 * pxPerMm, major: index % 10 === 0, medium: index % 5 === 0,
  }))
}

export function parseCalibration(value: unknown) {
  if (typeof value !== 'object' || value === null) return DEFAULT_PX_PER_MM
  const pxPerMm = Number((value as { pxPerMm?: unknown }).pxPerMm)
  return Number.isFinite(pxPerMm) && pxPerMm > 0 ? pxPerMm : DEFAULT_PX_PER_MM
}
