import Taro from '@tarojs/taro'

export type CanvasNode = {
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

export function getCanvasNode(selector: string): Promise<{ canvas: CanvasNode; ctx: CanvasRenderingContext2D }> {
  return new Promise((resolve, reject) => {
    Taro.createSelectorQuery()
      .select(selector)
      .fields({ node: true, size: true })
      .exec((res) => {
        const canvas = res?.[0]?.node as CanvasNode | undefined
        if (!canvas) {
          reject(new Error('canvas not found'))
          return
        }
        resolve({ canvas, ctx: canvas.getContext('2d') })
      })
  })
}

export function loadCanvasImage(canvas: CanvasNode, src: string) {
  return new Promise<ReturnType<CanvasNode['createImage']>>((resolve, reject) => {
    const image = canvas.createImage()
    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = src
  })
}

export async function getFileSize(filePath: string, fallbackSize?: number): Promise<number> {
  if (fallbackSize) return fallbackSize
  const info = await Taro.getFileInfo({ filePath })
  return (info as { size: number }).size || 0
}

export function exportCanvasToTempFile(
  canvas: CanvasNode,
  options: {
    width: number
    height: number
    fileType?: 'jpg' | 'png'
    quality?: number
  },
): Promise<string> {
  const fileType = options.fileType || 'jpg'
  return new Promise((resolve, reject) => {
    Taro.canvasToTempFilePath({
      canvas: canvas as any,
      destWidth: options.width,
      destHeight: options.height,
      fileType,
      quality: fileType === 'jpg' ? options.quality ?? 0.92 : 1,
      success: (res) => resolve(res.tempFilePath),
      fail: reject,
    } as any)
  })
}

/** 与原生工具页一致的体积文案 */
export function formatFileSize(size?: number): string {
  if (!size) return '--'
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(2)} MB`
  return `${(size / 1024).toFixed(1)} KB`
}
