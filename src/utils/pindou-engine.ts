import { MARD_PALETTE, type MardColor } from './pindou-palette'

export interface LabColor {
  l: number
  a: number
  b: number
}

export interface PatternStat extends MardColor {
  paletteIndex: number
  count: number
}

export interface Pattern {
  width: number
  height: number
  cells: number[]
  stats: PatternStat[]
  totalBeads: number
}

interface Pixel {
  r: number
  g: number
  b: number
  a: number
}

interface Sample extends Pixel {
  lab: LabColor
}

interface PaletteWithLab extends MardColor {
  lab: LabColor
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

const pivotRgb = (value: number) => {
  const normalized = value / 255
  return normalized > 0.04045
    ? Math.pow((normalized + 0.055) / 1.055, 2.4)
    : normalized / 12.92
}

const pivotXyz = (value: number) => (
  value > 0.008856
    ? Math.pow(value, 1 / 3)
    : (7.787 * value) + (16 / 116)
)

export const rgbToLab = (r: number, g: number, b: number): LabColor => {
  const red = pivotRgb(r)
  const green = pivotRgb(g)
  const blue = pivotRgb(b)
  const x = ((red * 0.4124) + (green * 0.3576) + (blue * 0.1805)) / 0.95047
  const y = (red * 0.2126) + (green * 0.7152) + (blue * 0.0722)
  const z = ((red * 0.0193) + (green * 0.1192) + (blue * 0.9505)) / 1.08883
  const fx = pivotXyz(x)
  const fy = pivotXyz(y)
  const fz = pivotXyz(z)

  return {
    l: (116 * fy) - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  }
}

const PALETTE_WITH_LAB: PaletteWithLab[] = MARD_PALETTE.map((color) => ({
  ...color,
  lab: rgbToLab(color.r, color.g, color.b),
}))

const labDistanceSquared = (left: LabColor, right: LabColor) => {
  const dl = left.l - right.l
  const da = left.a - right.a
  const db = left.b - right.b
  return (dl * dl) + (da * da) + (db * db)
}

const findNearestColor = (
  lab: LabColor,
  palette: PaletteWithLab[] = PALETTE_WITH_LAB,
  excluded: Set<number> | null = null,
): PaletteWithLab | null => {
  let best: PaletteWithLab | null = null
  let bestDistance = Infinity

  palette.forEach((color) => {
    if (excluded && excluded.has(color.index)) return

    const distance = labDistanceSquared(lab, color.lab)
    if (distance < bestDistance) {
      best = color
      bestDistance = distance
    }
  })

  return best
}

const isNearWhite = (pixel: Pixel, threshold: number) => (
  pixel.a > 31 &&
  pixel.r >= threshold &&
  pixel.g >= threshold &&
  pixel.b >= threshold
)

const getPixels = (imageData: ImageData, width: number, height: number) => {
  const pixels: Pixel[] = []
  const source = imageData.data

  for (let index = 0; index < width * height; index += 1) {
    const offset = index * 4
    pixels.push({
      r: source[offset],
      g: source[offset + 1],
      b: source[offset + 2],
      a: source[offset + 3],
    })
  }

  return pixels
}

const findBackgroundMask = (pixels: Pixel[], width: number, height: number, threshold: number) => {
  const mask = pixels.map(() => false)
  const queued = new Uint8Array(pixels.length)
  const queue: number[] = []

  const enqueue = (index: number) => {
    if (index < 0 || index >= pixels.length || queued[index]) return
    const pixel = pixels[index]
    if (pixel.a > 31 && !isNearWhite(pixel, threshold)) return
    queued[index] = 1
    queue.push(index)
  }

  for (let x = 0; x < width; x += 1) {
    enqueue(x)
    enqueue(((height - 1) * width) + x)
  }

  for (let y = 0; y < height; y += 1) {
    enqueue(y * width)
    enqueue((y * width) + width - 1)
  }

  let cursor = 0
  while (cursor < queue.length) {
    const index = queue[cursor]
    cursor += 1
    mask[index] = true
    const x = index % width
    const y = Math.floor(index / width)

    if (x > 0) enqueue(index - 1)
    if (x < width - 1) enqueue(index + 1)
    if (y > 0) enqueue(index - width)
    if (y < height - 1) enqueue(index + width)
  }

  return mask
}

const cropPixels = (pixels: Pixel[], mask: boolean[], width: number, height: number) => {
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1

  pixels.forEach((pixel, index) => {
    if (mask[index] || pixel.a <= 31) return
    const x = index % width
    const y = Math.floor(index / width)
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
  })

  if (maxX < minX || maxY < minY) return null

  const nextWidth = maxX - minX + 1
  const nextHeight = maxY - minY + 1
  const nextPixels: Pixel[] = []
  const nextMask: boolean[] = []

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const index = (y * width) + x
      nextPixels.push(pixels[index])
      nextMask.push(mask[index])
    }
  }

  return {
    pixels: nextPixels,
    mask: nextMask,
    width: nextWidth,
    height: nextHeight,
  }
}

const getBucketChannel = (samples: Sample[]) => {
  const ranges = (['l', 'a', 'b'] as const).map((key) => {
    let min = Infinity
    let max = -Infinity
    samples.forEach((sample) => {
      min = Math.min(min, sample.lab[key])
      max = Math.max(max, sample.lab[key])
    })
    const divisor = key === 'l' ? 100 : 255
    return { key, range: (max - min) / divisor }
  })

  ranges.sort((left, right) => right.range - left.range)
  return ranges[0]
}

const splitBucket = (bucket: { samples: Sample[] }) => {
  if (bucket.samples.length < 2) return null
  const channel = getBucketChannel(bucket.samples)
  if (!channel || channel.range <= 0) return null

  const sorted = bucket.samples.slice().sort((left, right) => (
    left.lab[channel.key] - right.lab[channel.key]
  ))
  const middle = Math.ceil(sorted.length / 2)

  return [
    { samples: sorted.slice(0, middle) },
    { samples: sorted.slice(middle) },
  ]
}

const averageLab = (samples: Sample[]): LabColor => {
  const total = samples.reduce((sum, sample) => ({
    l: sum.l + sample.lab.l,
    a: sum.a + sample.lab.a,
    b: sum.b + sample.lab.b,
  }), { l: 0, a: 0, b: 0 })

  return {
    l: total.l / samples.length,
    a: total.a / samples.length,
    b: total.b / samples.length,
  }
}

const selectLimitedPalette = (samples: Sample[], limit: number) => {
  const buckets: Array<{ samples: Sample[] }> = [{ samples }]

  while (buckets.length < limit) {
    let targetIndex = -1
    let targetScore = -1

    buckets.forEach((bucket, index) => {
      const channel = getBucketChannel(bucket.samples)
      const score = channel.range * Math.sqrt(bucket.samples.length)
      if (bucket.samples.length > 1 && score > targetScore) {
        targetIndex = index
        targetScore = score
      }
    })

    if (targetIndex < 0) break
    const split = splitBucket(buckets[targetIndex])
    if (!split) break
    buckets.splice(targetIndex, 1, ...split)
  }

  const selected: PaletteWithLab[] = []
  const used = new Set<number>()

  buckets
    .slice()
    .sort((left, right) => right.samples.length - left.samples.length)
    .forEach((bucket) => {
      const color = findNearestColor(averageLab(bucket.samples), PALETTE_WITH_LAB, used)
      if (!color) return
      used.add(color.index)
      selected.push(color)
    })

  return selected
}

export const getPatternStats = (cells: number[]) => {
  const counts = new Map<number, number>()
  let totalBeads = 0

  cells.forEach((paletteIndex) => {
    if (paletteIndex < 0) return
    counts.set(paletteIndex, (counts.get(paletteIndex) || 0) + 1)
    totalBeads += 1
  })

  const stats: PatternStat[] = Array.from(counts.entries())
    .map(([paletteIndex, count]) => ({
      ...MARD_PALETTE[paletteIndex],
      paletteIndex,
      count,
    }))
    .sort((left, right) => right.count - left.count || left.code.localeCompare(right.code))

  return {
    stats,
    totalBeads,
  }
}

export interface GeneratePatternOptions {
  colorLimit?: number
  removeWhite?: boolean
  whiteThreshold?: number
}

export const generatePattern = (
  imageData: ImageData,
  width: number,
  height: number,
  options: GeneratePatternOptions = {},
): Pattern => {
  const removeWhite = Boolean(options.removeWhite)
  const colorLimit = Number(options.colorLimit) || 0
  const threshold = clamp(Number(options.whiteThreshold) || 245, 220, 255)
  let pixels = getPixels(imageData, width, height)
  let mask = pixels.map((pixel) => pixel.a <= 31)
  let targetWidth = width
  let targetHeight = height

  if (removeWhite) {
    mask = findBackgroundMask(pixels, width, height, threshold)
    const cropped = cropPixels(pixels, mask, width, height)
    if (!cropped) {
      return {
        width: 0,
        height: 0,
        cells: [],
        stats: [],
        totalBeads: 0,
      }
    }
    pixels = cropped.pixels
    mask = cropped.mask
    targetWidth = cropped.width
    targetHeight = cropped.height
  }

  const samples = pixels
    .map((pixel, index) => {
      if (mask[index] || pixel.a <= 31) return null
      return {
        ...pixel,
        lab: rgbToLab(pixel.r, pixel.g, pixel.b),
      }
    })
    .filter((item): item is Sample => Boolean(item))

  if (!samples.length) {
    return {
      width: 0,
      height: 0,
      cells: [],
      stats: [],
      totalBeads: 0,
    }
  }

  const matchingPalette = colorLimit > 0
    ? selectLimitedPalette(samples, colorLimit)
    : PALETTE_WITH_LAB
  let sampleCursor = 0
  const cells = pixels.map((pixel, index) => {
    if (mask[index] || pixel.a <= 31) return -1
    const sample = samples[sampleCursor]
    sampleCursor += 1
    const color = findNearestColor(sample.lab, matchingPalette)
    return color ? color.index : -1
  })
  const usage = getPatternStats(cells)

  return {
    width: targetWidth,
    height: targetHeight,
    cells,
    ...usage,
  }
}

export const replacePatternColor = (
  cells: number[],
  fromPaletteIndex: number,
  toPaletteIndex: number,
) => cells.map((paletteIndex) => (
  paletteIndex === fromPaletteIndex ? toPaletteIndex : paletteIndex
))
