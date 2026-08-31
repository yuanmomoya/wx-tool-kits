/**
 * 本地 Canvas 压缩：质量模式 / 目标体积（二分质量 + 必要时缩尺寸）。
 * 仅支持 JPG / PNG；大图边长上限 4096。
 */
import Taro from '@tarojs/taro'

import {
  CompressParams,
  CompressResult,
  LocalImage,
  SUPPORTED_INPUT,
} from '@/types/compress'

const MAX_EDGE = 4096
const CANVAS_SELECTOR = '#compressCanvas'

export class CompressCancelledError extends Error {
  constructor() {
    super('已取消')
    this.name = 'CompressCancelledError'
  }
}

export class LocalCompressError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LocalCompressError'
  }
}

export type ProgressCb = (progress: number, stepLabel: string) => void

type CanvasNode = {
  width: number
  height: number
  getContext: (type: '2d') => CanvasRenderingContext2D
  createImage: () => {
    src: string
    width: number
    height: number
    onload: (() => void) | null
    onerror: ((err?: unknown) => void) | null
  }
}

export function normalizeFmt(fmt?: string): string {
  const f = (fmt || '').toLowerCase().replace(/^\./, '')
  if (f === 'jpeg' || f === 'jfif') return 'jpg'
  return f
}

export function parseHexColor(hex: string): { r: number; g: number; b: number } {
  const raw = (hex || '#FFFFFF').trim().replace(/^#/, '')
  const full =
    raw.length === 3
      ? raw
          .split('')
          .map((c) => c + c)
          .join('')
      : raw
  if (!/^[0-9a-fA-F]{6}$/.test(full)) {
    return { r: 255, g: 255, b: 255 }
  }
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  }
}

export function resolveOutputFormat(image: LocalImage, params: CompressParams): 'jpg' | 'png' {
  if (params.output_format === 'jpg') return 'jpg'
  if (params.output_format === 'png') return 'png'
  const src = normalizeFmt(image.format)
  return src === 'png' ? 'png' : 'jpg'
}

export function calcTargetSize(
  srcW: number,
  srcH: number,
  params: CompressParams,
): { width: number; height: number } {
  let width = srcW
  let height = srcH

  if (params.size_mode === 'scale') {
    const p = Math.max(1, Math.min(100, params.scale_percent || 50)) / 100
    width = Math.max(1, Math.round(srcW * p))
    height = Math.max(1, Math.round(srcH * p))
  } else if (params.size_mode === 'custom') {
    const tw = params.custom_width || 0
    const th = params.custom_height || 0
    if (tw > 0 && th > 0) {
      if (params.lock_aspect) {
        const scale = Math.min(tw / srcW, th / srcH)
        width = Math.max(1, Math.round(srcW * scale))
        height = Math.max(1, Math.round(srcH * scale))
      } else {
        width = Math.max(1, Math.round(tw))
        height = Math.max(1, Math.round(th))
      }
    } else if (tw > 0) {
      width = Math.max(1, Math.round(tw))
      height = Math.max(1, Math.round((srcH * width) / srcW))
    } else if (th > 0) {
      height = Math.max(1, Math.round(th))
      width = Math.max(1, Math.round((srcW * height) / srcH))
    }
  }

  const edge = Math.max(width, height)
  if (edge > MAX_EDGE) {
    const scale = MAX_EDGE / edge
    width = Math.max(1, Math.round(width * scale))
    height = Math.max(1, Math.round(height * scale))
  }

  return { width, height }
}

export function targetBytesOf(params: CompressParams): number {
  const v = params.target_size_value
  return params.target_size_unit === 'MB' ? v * 1024 * 1024 : v * 1024
}

export function allowedError(target: number): number {
  if (target < 100 * 1024) return Math.max(1024, Math.floor(target * 0.08))
  if (target <= 1024 * 1024) return Math.max(1024, Math.floor(target * 0.05))
  return Math.max(1024, Math.floor(target * 0.03))
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

export function assertNotCancelled(signal?: { cancelled: boolean }) {
  if (signal?.cancelled) throw new CompressCancelledError()
}

async function getCanvas(): Promise<CanvasNode> {
  return new Promise((resolve, reject) => {
    Taro.createSelectorQuery()
      .select(CANVAS_SELECTOR)
      .fields({ node: true, size: true })
      .exec((res) => {
        const canvas = res?.[0]?.node as CanvasNode | undefined
        if (!canvas) {
          reject(new LocalCompressError('画布未就绪，请稍后重试'))
          return
        }
        resolve(canvas)
      })
  })
}

async function loadImage(canvas: CanvasNode, src: string) {
  return new Promise<ReturnType<CanvasNode['createImage']>>((resolve, reject) => {
    const img = canvas.createImage()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new LocalCompressError('图片加载失败'))
    img.src = src
  })
}

async function fileSize(path: string): Promise<number> {
  const info = await Taro.getFileInfo({ filePath: path })
  return (info as { size: number }).size
}

async function exportCanvas(
  canvas: CanvasNode,
  width: number,
  height: number,
  fileType: 'jpg' | 'png',
  qualityPercent: number,
): Promise<{ path: string; size: number }> {
  // canvasToTempFilePath quality: 0~1
  const q = Math.max(0.2, Math.min(0.95, qualityPercent / 100))
  const res = await Taro.canvasToTempFilePath({
    canvas: canvas as any,
    x: 0,
    y: 0,
    width,
    height,
    destWidth: width,
    destHeight: height,
    fileType: fileType === 'jpg' ? 'jpg' : 'png',
    quality: fileType === 'jpg' ? q : 1,
  } as any)
  const path = res.tempFilePath
  const size = await fileSize(path)
  return { path, size }
}

function drawFrame(
  canvas: CanvasNode,
  img: ReturnType<CanvasNode['createImage']>,
  width: number,
  height: number,
  outFmt: 'jpg' | 'png',
  params: CompressParams,
) {
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, width, height)

  const needBg = outFmt === 'jpg' || !params.keep_transparency
  if (needBg) {
    const { r, g, b } = parseHexColor(params.background_color)
    ctx.fillStyle = `rgb(${r},${g},${b})`
    ctx.fillRect(0, 0, width, height)
  }

  ctx.drawImage(img as any, 0, 0, width, height)
}

/**
 * 执行本地压缩。页面需放置 `<Canvas type="2d" id="compressCanvas" />`。
 */
export async function localCompress(
  image: LocalImage,
  params: CompressParams,
  options?: {
    onProgress?: ProgressCb
    signal?: { cancelled: boolean }
  },
): Promise<CompressResult> {
  const onProgress = options?.onProgress || (() => {})
  const signal = options?.signal
  const started = Date.now()
  const warnings: string[] = []

  const srcFmt = normalizeFmt(image.format)
  if (srcFmt !== 'jpg' && srcFmt !== 'png' && !SUPPORTED_INPUT.has(srcFmt)) {
    throw new LocalCompressError('本地版仅支持 JPG、PNG')
  }

  onProgress(5, '读取图片')
  assertNotCancelled(signal)

  let srcW = image.width || 0
  let srcH = image.height || 0
  try {
    const info = await Taro.getImageInfo({ src: image.path })
    srcW = info.width
    srcH = info.height
  } catch {
    if (!srcW || !srcH) throw new LocalCompressError('无法读取图片尺寸')
  }

  if (Math.max(srcW, srcH) > MAX_EDGE) {
    warnings.push(`原图边长超过 ${MAX_EDGE}，已自动等比缩小后再压缩。`)
  }

  const outFmt = resolveOutputFormat(image, params)
  let { width, height } = calcTargetSize(srcW, srcH, params)

  onProgress(15, '准备画布')
  assertNotCancelled(signal)
  const canvas = await getCanvas()
  const img = await loadImage(canvas, image.path)

  const encodeAt = async (w: number, h: number, quality: number) => {
    assertNotCancelled(signal)
    drawFrame(canvas, img, w, h, outFmt, params)
    // 让出一帧，便于进度刷新
    await sleep(16)
    return exportCanvas(canvas, w, h, outFmt, quality)
  }

  let bestPath = ''
  let bestSize = Number.POSITIVE_INFINITY
  let bestW = width
  let bestH = height
  let reachedTarget = true
  let message: string | null = null

  if (params.mode === 'quality') {
    onProgress(40, '按质量压缩')
    const quality = Math.max(20, Math.min(95, params.quality || 70))
    // PNG 质量参数无效：用略降分辨率模拟「质量」感不合适，保持尺寸只导出
    const out = await encodeAt(width, height, quality)
    bestPath = out.path
    bestSize = out.size
    bestW = width
    bestH = height
    if (outFmt === 'png' && out.size >= image.size * 0.98) {
      warnings.push('PNG 端上压缩空间有限，体积可能变化不大；可改输出为 JPG 或缩小尺寸。')
    }
    onProgress(90, '完成')
  } else {
    const target = targetBytesOf(params)
    const allowed = allowedError(target)
    const upper = target + allowed

    onProgress(25, '逼近目标体积')
    let lo = 20
    let hi = 95
    let found = false

    for (let i = 0; i < 10; i++) {
      assertNotCancelled(signal)
      const mid = Math.round((lo + hi) / 2)
      onProgress(25 + i * 5, `尝试质量 ${mid}%`)
      const out = await encodeAt(width, height, mid)
      if (Math.abs(out.size - target) < Math.abs(bestSize - target)) {
        bestPath = out.path
        bestSize = out.size
        bestW = width
        bestH = height
      }
      if (out.size > upper) {
        hi = mid - 1
      } else {
        lo = mid + 1
        found = out.size <= upper
        if (Math.abs(out.size - target) <= allowed) {
          found = true
          break
        }
      }
      if (lo > hi) break
    }

    // 质量压到最低仍超标：逐步缩小尺寸
    if (bestSize > upper) {
      onProgress(75, '缩小尺寸以逼近目标')
      let curW = width
      let curH = height
      for (let i = 0; i < 12; i++) {
        assertNotCancelled(signal)
        curW = Math.max(1, Math.round(curW * 0.85))
        curH = Math.max(1, Math.round(curH * 0.85))
        if (curW < 32 || curH < 32) break
        onProgress(75 + i, `缩小至 ${curW}×${curH}`)
        const out = await encodeAt(curW, curH, 20)
        if (out.size < bestSize || out.size <= upper) {
          bestPath = out.path
          bestSize = out.size
          bestW = curW
          bestH = curH
        }
        if (bestSize <= upper) {
          found = true
          break
        }
      }
    }

    reachedTarget = found && bestSize <= upper
    if (!reachedTarget) {
      message = `暂未达到目标约 ${(target / 1024).toFixed(0)}KB，已输出最接近结果 ${
        bestSize < 1024 * 1024
          ? `${(bestSize / 1024).toFixed(1)}KB`
          : `${(bestSize / 1024 / 1024).toFixed(2)}MB`
      }。可尝试改输出 JPG 或进一步缩小尺寸。`
    }
    onProgress(92, '整理结果')
  }

  if (!bestPath) {
    throw new LocalCompressError('压缩失败，请重试')
  }

  const baseName =
    image.name.replace(/\.[^.]+$/, '') || `image_${Date.now()}`
  const outName = `${baseName}.${outFmt}`
  const ratio =
    image.size > 0
      ? Math.max(0, Math.round((1 - bestSize / image.size) * 1000) / 10)
      : 0

  onProgress(100, '完成')

  return {
    original: {
      filename: image.name,
      size_bytes: image.size,
      width: srcW,
      height: srcH,
      format: (image.format || srcFmt || 'JPG').toUpperCase(),
    },
    output: {
      filename: outName,
      size_bytes: bestSize,
      width: bestW,
      height: bestH,
      format: outFmt.toUpperCase(),
    },
    ratio_reduced: ratio,
    elapsed_ms: Date.now() - started,
    reached_target: reachedTarget,
    message,
    warnings,
    localPath: bestPath,
  }
}
