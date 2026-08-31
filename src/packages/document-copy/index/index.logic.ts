/** 证件材料复印排版：毫米/DPI 换算、模板槽位、图片变换与水印纯逻辑 */

export type PaperOrientation = 'portrait' | 'landscape'
export type CopyMode = 'id-card' | 'materials'
export type MaterialRole = 'front' | 'back' | 'material'
export type PairLayout = 'vertical' | 'horizontal'
export type WatermarkOpacityId = 'light' | 'medium' | 'strong'
export type RotationDeg = 0 | 90 | 180 | 270
export type ImageFit = 'contain' | 'cover'

export interface CropState {
  /** 图片适配槽位的基础方式 */
  fit: ImageFit
  /** 图片中心相对槽位宽度的归一化水平偏移 */
  offsetX: number
  /** 图片中心相对槽位高度的归一化垂直偏移 */
  offsetY: number
  /** 相对基础适配尺寸的缩放倍数 */
  scale: number
  rotation: RotationDeg
}

export interface MaterialItem {
  id: string
  path: string
  width: number
  height: number
  role: MaterialRole
  crop: CropState
}

export interface LayoutSlot {
  index: number
  x: number
  y: number
  width: number
  height: number
  role?: MaterialRole
}

export interface ImagePlacement {
  /** 图片中心，相对槽位左上角的坐标 */
  centerX: number
  centerY: number
  /** 旋转前图片在槽位坐标系中的绘制尺寸 */
  drawWidth: number
  drawHeight: number
  /** 旋转后包围盒尺寸，用于偏移钳制 */
  rotatedWidth: number
  rotatedHeight: number
  offsetX: number
  offsetY: number
  rotation: RotationDeg
}

export interface WatermarkPlan {
  enabled: boolean
  text: string
  opacity: number
  rotationRadians: number
  fontSize: number
  stepX: number
  stepY: number
  positions: Array<{ x: number; y: number }>
}

export interface LazyPdfCache {
  invalidate: () => void
  ensure: (sourcePath: string, generate: (sourcePath: string) => Promise<string>) => Promise<string>
}

export const DPI = 200
export const MM_PER_INCH = 25.4
export const A4_WIDTH_MM = 210
export const A4_HEIGHT_MM = 297
export const PAGE_MARGIN_MM = 15
export const SLOT_GAP_MM = 10
export const ID_CARD_WIDTH_MM = 85.6
export const ID_CARD_HEIGHT_MM = 53.98
export const JPG_QUALITY = 0.95
export const MAX_MATERIALS = 4
export const MIN_CROP_SCALE = 1
export const MAX_CROP_SCALE = 4
export const DEFAULT_CROP: CropState = {
  fit: 'cover',
  offsetX: 0,
  offsetY: 0,
  scale: 1,
  rotation: 0,
}

export const WATERMARK_OPACITY: Record<WatermarkOpacityId, number> = {
  light: 0.12,
  medium: 0.18,
  strong: 0.26,
}

export const WATERMARK_PRESETS = [
  { id: 'off', title: '关闭', text: '' },
  { id: 'business', title: '仅用于办理业务', text: '仅用于办理业务' },
  { id: 'copy', title: '仅用于复印使用', text: '仅用于复印使用' },
  { id: 'custom', title: '自定义', text: '' },
] as const

export function mmToPx(mm: number, dpi = DPI): number {
  return Math.round((mm / MM_PER_INCH) * dpi)
}

export function getA4PixelSize(orientation: PaperOrientation, dpi = DPI) {
  const width = mmToPx(A4_WIDTH_MM, dpi)
  const height = mmToPx(A4_HEIGHT_MM, dpi)
  if (orientation === 'portrait') {
    return { width, height }
  }
  return { width: height, height: width }
}

export function getIdCardPixelSize(dpi = DPI) {
  return {
    width: mmToPx(ID_CARD_WIDTH_MM, dpi),
    height: mmToPx(ID_CARD_HEIGHT_MM, dpi),
  }
}

export function getPageInsets(dpi = DPI) {
  return {
    margin: mmToPx(PAGE_MARGIN_MM, dpi),
    gap: mmToPx(SLOT_GAP_MM, dpi),
  }
}

export function createDefaultCrop(partial?: Partial<CropState>): CropState {
  return {
    ...DEFAULT_CROP,
    ...partial,
    fit: partial?.fit === 'contain' ? 'contain' : 'cover',
    offsetX: Number.isFinite(partial?.offsetX) ? Number(partial?.offsetX) : DEFAULT_CROP.offsetX,
    offsetY: Number.isFinite(partial?.offsetY) ? Number(partial?.offsetY) : DEFAULT_CROP.offsetY,
    scale: clamp(partial?.scale ?? DEFAULT_CROP.scale, MIN_CROP_SCALE, MAX_CROP_SCALE),
    rotation: normalizeRotation(partial?.rotation ?? DEFAULT_CROP.rotation),
  }
}

export function normalizeRotation(value: number): RotationDeg {
  const normalized = ((Math.round(value / 90) * 90) % 360 + 360) % 360
  if (normalized === 90 || normalized === 180 || normalized === 270) return normalized
  return 0
}

export function rotateCrop(crop: CropState, delta = 90): CropState {
  return createDefaultCrop({
    ...crop,
    rotation: normalizeRotation(crop.rotation + delta),
  })
}

export function resetCrop(crop?: Partial<CropState>): CropState {
  return createDefaultCrop({
    fit: crop?.fit ?? DEFAULT_CROP.fit,
    rotation: crop?.rotation ?? DEFAULT_CROP.rotation,
  })
}

export function getRotatedImageSize(width: number, height: number, rotation: RotationDeg) {
  if (width <= 0 || height <= 0) throw new RangeError('图片尺寸无效')
  if (rotation === 90 || rotation === 270) {
    return { width: height, height: width }
  }
  return { width, height }
}

export function computeImagePlacement(
  sourceWidth: number,
  sourceHeight: number,
  slotWidth: number,
  slotHeight: number,
  crop: CropState,
): ImagePlacement {
  if ([sourceWidth, sourceHeight, slotWidth, slotHeight].some((value) => value <= 0)) {
    throw new RangeError('图片尺寸无效')
  }

  const normalized = createDefaultCrop(crop)
  const rotated = getRotatedImageSize(sourceWidth, sourceHeight, normalized.rotation)
  const containScale = Math.min(slotWidth / rotated.width, slotHeight / rotated.height)
  const coverScale = Math.max(slotWidth / rotated.width, slotHeight / rotated.height)
  const effectiveScale = (normalized.fit === 'contain' ? containScale : coverScale) * normalized.scale
  const rotatedWidth = rotated.width * effectiveScale
  const rotatedHeight = rotated.height * effectiveScale
  const maxOffsetX = Math.max(0, (rotatedWidth - slotWidth) / 2) / slotWidth
  const maxOffsetY = Math.max(0, (rotatedHeight - slotHeight) / 2) / slotHeight
  const offsetX = clamp(normalized.offsetX, -maxOffsetX, maxOffsetX)
  const offsetY = clamp(normalized.offsetY, -maxOffsetY, maxOffsetY)

  return {
    centerX: slotWidth / 2 + offsetX * slotWidth,
    centerY: slotHeight / 2 + offsetY * slotHeight,
    drawWidth: sourceWidth * effectiveScale,
    drawHeight: sourceHeight * effectiveScale,
    rotatedWidth,
    rotatedHeight,
    offsetX,
    offsetY,
    rotation: normalized.rotation,
  }
}

export function normalizeCropForSlot(
  crop: CropState,
  sourceWidth: number,
  sourceHeight: number,
  slotWidth: number,
  slotHeight: number,
): CropState {
  const placement = computeImagePlacement(sourceWidth, sourceHeight, slotWidth, slotHeight, crop)
  return createDefaultCrop({
    ...crop,
    offsetX: placement.offsetX,
    offsetY: placement.offsetY,
  })
}

export function panCrop(
  crop: CropState,
  deltaX: number,
  deltaY: number,
  sourceWidth: number,
  sourceHeight: number,
  slotWidth: number,
  slotHeight: number,
): CropState {
  const next = normalizeCropForSlot(
    createDefaultCrop({
      ...crop,
      offsetX: crop.offsetX + deltaX / slotWidth,
      offsetY: crop.offsetY + deltaY / slotHeight,
    }),
    sourceWidth,
    sourceHeight,
    slotWidth,
    slotHeight,
  )
  return next
}

export function zoomCrop(crop: CropState, nextScale: number): CropState {
  return createDefaultCrop({
    ...crop,
    scale: nextScale,
  })
}

function contentBox(orientation: PaperOrientation, dpi = DPI) {
  const page = getA4PixelSize(orientation, dpi)
  const { margin } = getPageInsets(dpi)
  return {
    x: margin,
    y: margin,
    width: page.width - margin * 2,
    height: page.height - margin * 2,
    page,
  }
}

function assertNoOverlap(slots: LayoutSlot[], gap: number) {
  for (let i = 0; i < slots.length; i += 1) {
    for (let j = i + 1; j < slots.length; j += 1) {
      const a = slots[i]
      const b = slots[j]
      const overlapX = a.x < b.x + b.width - 0.5 && a.x + a.width > b.x + 0.5
      const overlapY = a.y < b.y + b.height - 0.5 && a.y + a.height > b.y + 0.5
      if (overlapX && overlapY) {
        throw new RangeError('槽位发生重叠')
      }
      if (overlapX) {
        const verticalGap = a.y < b.y ? b.y - (a.y + a.height) : a.y - (b.y + b.height)
        if (verticalGap + 0.5 < gap && verticalGap >= -0.5) {
          // adjacent vertically with insufficient gap
          if (Math.abs(verticalGap) < gap - 0.5 && verticalGap >= 0) {
            throw new RangeError('槽位间距不足')
          }
        }
      }
      if (overlapY) {
        const horizontalGap = a.x < b.x ? b.x - (a.x + a.width) : a.x - (b.x + b.width)
        if (horizontalGap >= 0 && horizontalGap + 0.5 < gap) {
          throw new RangeError('槽位间距不足')
        }
      }
    }
  }
}

function assertInsidePage(slots: LayoutSlot[], pageWidth: number, pageHeight: number, margin: number) {
  for (const slot of slots) {
    if (
      slot.x < margin - 0.5 ||
      slot.y < margin - 0.5 ||
      slot.x + slot.width > pageWidth - margin + 0.5 ||
      slot.y + slot.height > pageHeight - margin + 0.5 ||
      slot.width <= 0 ||
      slot.height <= 0
    ) {
      throw new RangeError('槽位超出页面边距')
    }
  }
}

export function createIdCardSlots(orientation: PaperOrientation, dpi = DPI): LayoutSlot[] {
  const { margin, gap } = getPageInsets(dpi)
  const box = contentBox(orientation, dpi)
  const card = getIdCardPixelSize(dpi)

  let slots: LayoutSlot[]
  if (orientation === 'portrait') {
    const totalHeight = card.height * 2 + gap
    const startY = box.y + (box.height - totalHeight) / 2
    const x = box.x + (box.width - card.width) / 2
    slots = [
      { index: 0, x, y: startY, width: card.width, height: card.height, role: 'front' },
      { index: 1, x, y: startY + card.height + gap, width: card.width, height: card.height, role: 'back' },
    ]
  } else {
    const totalWidth = card.width * 2 + gap
    const startX = box.x + (box.width - totalWidth) / 2
    const y = box.y + (box.height - card.height) / 2
    slots = [
      { index: 0, x: startX, y, width: card.width, height: card.height, role: 'front' },
      { index: 1, x: startX + card.width + gap, y, width: card.width, height: card.height, role: 'back' },
    ]
  }

  assertInsidePage(slots, box.page.width, box.page.height, margin)
  assertNoOverlap(slots, gap)
  return slots
}

export function createMaterialSlots(
  count: number,
  orientation: PaperOrientation,
  pairLayout: PairLayout = 'vertical',
  dpi = DPI,
): LayoutSlot[] {
  if (!Number.isInteger(count) || count < 1 || count > MAX_MATERIALS) {
    throw new RangeError('通用材料仅支持 1–4 张')
  }

  const { margin, gap } = getPageInsets(dpi)
  const box = contentBox(orientation, dpi)
  let slots: LayoutSlot[] = []

  if (count === 1) {
    slots = [
      {
        index: 0,
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        role: 'material',
      },
    ]
  } else if (count === 2) {
    if (pairLayout === 'horizontal') {
      const width = (box.width - gap) / 2
      const height = box.height
      slots = [
        { index: 0, x: box.x, y: box.y, width, height, role: 'material' },
        { index: 1, x: box.x + width + gap, y: box.y, width, height, role: 'material' },
      ]
    } else {
      const width = box.width
      const height = (box.height - gap) / 2
      slots = [
        { index: 0, x: box.x, y: box.y, width, height, role: 'material' },
        { index: 1, x: box.x, y: box.y + height + gap, width, height, role: 'material' },
      ]
    }
  } else if (count === 3) {
    if (orientation === 'portrait') {
      const largeHeight = (box.height - gap) * 0.58
      const smallHeight = box.height - gap - largeHeight
      const smallWidth = (box.width - gap) / 2
      slots = [
        { index: 0, x: box.x, y: box.y, width: box.width, height: largeHeight, role: 'material' },
        {
          index: 1,
          x: box.x,
          y: box.y + largeHeight + gap,
          width: smallWidth,
          height: smallHeight,
          role: 'material',
        },
        {
          index: 2,
          x: box.x + smallWidth + gap,
          y: box.y + largeHeight + gap,
          width: smallWidth,
          height: smallHeight,
          role: 'material',
        },
      ]
    } else {
      const largeWidth = (box.width - gap) * 0.58
      const smallWidth = box.width - gap - largeWidth
      const smallHeight = (box.height - gap) / 2
      slots = [
        { index: 0, x: box.x, y: box.y, width: largeWidth, height: box.height, role: 'material' },
        {
          index: 1,
          x: box.x + largeWidth + gap,
          y: box.y,
          width: smallWidth,
          height: smallHeight,
          role: 'material',
        },
        {
          index: 2,
          x: box.x + largeWidth + gap,
          y: box.y + smallHeight + gap,
          width: smallWidth,
          height: smallHeight,
          role: 'material',
        },
      ]
    }
  } else {
    const width = (box.width - gap) / 2
    const height = (box.height - gap) / 2
    slots = [
      { index: 0, x: box.x, y: box.y, width, height, role: 'material' },
      { index: 1, x: box.x + width + gap, y: box.y, width, height, role: 'material' },
      { index: 2, x: box.x, y: box.y + height + gap, width, height, role: 'material' },
      { index: 3, x: box.x + width + gap, y: box.y + height + gap, width, height, role: 'material' },
    ]
  }

  const rounded = slots.map((slot) => roundSlot(slot, box.page.width, box.page.height, margin))
  assertInsidePage(rounded, box.page.width, box.page.height, margin)
  assertNoOverlap(rounded, gap)
  return rounded
}

function roundSlot(slot: LayoutSlot, pageWidth: number, pageHeight: number, margin: number): LayoutSlot {
  const maxRight = pageWidth - margin
  const maxBottom = pageHeight - margin
  const x = Math.max(margin, Math.round(slot.x))
  const y = Math.max(margin, Math.round(slot.y))
  const width = Math.max(1, Math.min(Math.round(slot.width), maxRight - x))
  const height = Math.max(1, Math.min(Math.round(slot.height), maxBottom - y))
  return { ...slot, x, y, width, height }
}

export function createLayoutSlots(options: {
  mode: CopyMode
  orientation: PaperOrientation
  count: number
  pairLayout?: PairLayout
  dpi?: number
}): LayoutSlot[] {
  const dpi = options.dpi ?? DPI
  if (options.mode === 'id-card') {
    if (options.count !== 2) throw new RangeError('身份证模式需要正反面两张')
    return createIdCardSlots(options.orientation, dpi)
  }
  return createMaterialSlots(options.count, options.orientation, options.pairLayout ?? 'vertical', dpi)
}

export function validateMaterialsForExport(mode: CopyMode, items: Array<{ width: number; height: number }>) {
  if (items.some((item) => item.width <= 0 || item.height <= 0)) {
    throw new RangeError('图片尺寸无效')
  }
  if (mode === 'id-card') {
    if (items.length < 2) throw new RangeError('请选择身份证正反面两张')
    if (items.length > 2) throw new RangeError('身份证模式仅支持两张')
    return
  }
  if (items.length < 1) throw new RangeError('请至少选择 1 张材料')
  if (items.length > MAX_MATERIALS) throw new RangeError(`最多选择 ${MAX_MATERIALS} 张`)
}

export function getResultNote(mode: CopyMode, count: number): string {
  if (count <= 0) return '等待生成'
  if (mode === 'id-card' && count < 2) return '请选择正反面两张'
  return '可生成排版'
}

export function createLazyPdfCache(): LazyPdfCache {
  let revision = 0
  let cachedSource = ''
  let cachedPdf = ''
  let inFlight: { source: string; revision: number; promise: Promise<string> } | null = null

  return {
    invalidate() {
      revision += 1
      cachedSource = ''
      cachedPdf = ''
    },
    ensure(sourcePath, generate) {
      if (!sourcePath) return Promise.reject(new Error('请先生成排版'))
      if (cachedSource === sourcePath && cachedPdf) return Promise.resolve(cachedPdf)
      if (inFlight && inFlight.source === sourcePath && inFlight.revision === revision) return inFlight.promise

      const currentRevision = revision
      const promise = generate(sourcePath).then((pdfPath) => {
        if (revision === currentRevision) {
          cachedSource = sourcePath
          cachedPdf = pdfPath
        }
        return pdfPath
      })
      inFlight = { source: sourcePath, revision: currentRevision, promise }
      const clearInFlight = () => {
        if (inFlight?.promise === promise) inFlight = null
      }
      void promise.then(clearInFlight, clearInFlight)
      return promise
    },
  }
}

export function resolveWatermarkText(options: {
  enabled: boolean
  presetId: string
  customText?: string
}): string {
  if (!options.enabled || options.presetId === 'off') return ''
  if (options.presetId === 'custom') {
    return String(options.customText || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 2)
      .join(' ')
  }
  const preset = WATERMARK_PRESETS.find((item) => item.id === options.presetId)
  return preset?.text || ''
}

export function createSlotWatermarkPlan(
  slot: LayoutSlot,
  text: string,
  opacityId: WatermarkOpacityId = 'medium',
): WatermarkPlan {
  const opacity = WATERMARK_OPACITY[opacityId] ?? WATERMARK_OPACITY.medium
  if (!text.trim()) {
    return {
      enabled: false,
      text: '',
      opacity,
      rotationRadians: -Math.PI / 6,
      fontSize: 24,
      stepX: 0,
      stepY: 0,
      positions: [],
    }
  }

  const fontSize = Math.max(18, Math.round(Math.min(slot.width, slot.height) * 0.08))
  const stepX = Math.max(160, Math.round(slot.width * 0.55))
  const stepY = Math.max(120, Math.round(slot.height * 0.35))
  const positions: Array<{ x: number; y: number }> = []
  const diagonal = Math.ceil(Math.sqrt(slot.width * slot.width + slot.height * slot.height))

  for (let x = -diagonal; x <= diagonal; x += stepX) {
    for (let y = -diagonal; y <= diagonal; y += stepY) {
      positions.push({ x: slot.x + slot.width / 2 + x, y: slot.y + slot.height / 2 + y })
    }
  }

  return {
    enabled: true,
    text: text.trim(),
    opacity,
    rotationRadians: -Math.PI / 6,
    fontSize,
    stepX,
    stepY,
    positions,
  }
}

export function getPdfPageSizePoints(orientation: PaperOrientation) {
  // 标准 A4，单位 pt（72 DPI）
  const width = 595.28
  const height = 841.89
  return orientation === 'portrait'
    ? { width, height }
    : { width: height, height: width }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}
