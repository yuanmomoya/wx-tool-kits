export const QUALITY_ORDER = ['high', 'medium', 'low'] as const
export type VideoQuality = typeof QUALITY_ORDER[number]

export function qualityFallbacks(selected: VideoQuality) { return QUALITY_ORDER.slice(QUALITY_ORDER.indexOf(selected)) }

export async function selectCompressedVideo<T extends { path: string; size: number }>(
  originalSize: number,
  selected: VideoQuality,
  compress: (quality: VideoQuality) => Promise<T>,
) {
  if (originalSize <= 0) throw new RangeError('原视频大小无效')
  const attempts: Array<T & { quality: VideoQuality }> = []
  for (const quality of qualityFallbacks(selected)) {
    const result = await compress(quality)
    attempts.push({ ...result, quality })
    if (result.size < originalSize) return { ...result, quality, attempts }
  }
  const smallest = attempts.sort((a, b) => a.size - b.size)[0]
  return { ...smallest, attempts }
}

export function shouldCopyBeforeSave(sourcePath: string) { return /^wxfile:\/\/|\/tmp\//.test(sourcePath) }
