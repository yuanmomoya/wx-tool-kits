export type CropMode = 'left' | 'center' | 'right' | 'top' | 'bottom'

export function getSquareCrop(width: number, height: number, mode: CropMode = 'center') {
  if (width <= 0 || height <= 0) throw new RangeError('图片尺寸无效')
  const size = Math.min(width, height)
  const x = width === size ? 0 : mode === 'left' ? 0 : mode === 'right' ? width - size : (width - size) / 2
  const y = height === size ? 0 : mode === 'top' ? 0 : mode === 'bottom' ? height - size : (height - size) / 2
  return { x, y, size }
}

export function createNineGridPlan(width: number, height: number, mode: CropMode = 'center', maxExportSize = 3072) {
  const crop = getSquareCrop(width, height, mode)
  const sourceTileSize = crop.size / 3
  const tileSize = Math.max(300, Math.floor(Math.min(crop.size, maxExportSize) / 3))
  return Array.from({ length: 9 }, (_, index) => ({
    index: index + 1, row: Math.floor(index / 3), column: index % 3,
    sx: crop.x + index % 3 * sourceTileSize, sy: crop.y + Math.floor(index / 3) * sourceTileSize,
    sw: sourceTileSize, sh: sourceTileSize, outputWidth: tileSize, outputHeight: tileSize,
  }))
}

export function summarizeSaveResults(results: Array<{ ok: boolean }>) {
  const saved = results.filter((item) => item.ok).length
  return { saved, failed: results.length - saved, complete: saved === results.length }
}
