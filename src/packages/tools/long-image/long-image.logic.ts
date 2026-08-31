export interface LongImageSource { width: number; height: number }

export function createLongImagePlan(images: LongImageSource[], preferredWidth?: number, maxHeight = 16_384, minWidth = 320) {
  if (images.length < 2) throw new RangeError('至少需要两张图片')
  if (images.some((item) => item.width <= 0 || item.height <= 0)) throw new RangeError('图片尺寸无效')
  const width = Math.max(minWidth, preferredWidth || Math.min(...images.map((item) => item.width)))
  const rawHeights = images.map((item) => item.height * width / item.width)
  const heightScale = Math.min(1, maxHeight / rawHeights.reduce((sum, height) => sum + height, 0))
  const outputWidth = Math.round(width * heightScale)
  if (outputWidth < minWidth) throw new RangeError('图片过长，无法在最小输出宽度内生成')
  let y = 0
  const draws = images.map((item, index) => {
    const height = Math.round(item.height * outputWidth / item.width)
    const draw = { index, x: 0, y, width: outputWidth, height }
    y += height
    return draw
  })
  return { width: outputWidth, height: y, draws }
}
