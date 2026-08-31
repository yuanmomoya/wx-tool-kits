import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, Image, ScrollView, Text, View } from '@tarojs/components'
import Taro, { useShareAppMessage, useShareTimeline } from '@tarojs/taro'

import NavigationBar from '@/components/NavigationBar'
import MediaResultActions from '@/packages/tools/components/MediaResultActions'
import ToolIntroCard from '@/packages/tools/components/ToolIntroCard'
import {
  CanvasNode,
  exportCanvasToTempFile,
  formatFileSize,
  getCanvasNode,
  getFileSize,
  loadCanvasImage,
} from '@/utils/canvas'
import { chooseImages } from '@/utils/image-picker'
import { isSaveCancel, saveImageToAlbum } from '@/utils/image-save'
import {
  generatePattern,
  getPatternStats,
  replacePatternColor,
  type Pattern,
  type PatternStat,
} from '@/utils/pindou-engine'
import { MARD_PALETTE, type MardColor } from '@/utils/pindou-palette'

import './pindou.scss'

const DEFAULT_GRID_WIDTH = 32
const MAX_GRID_HEIGHT = 120
const MAX_HISTORY = 20
const MAX_EXPORT_SIDE = 4096
const MAX_EDITOR_BACKING_SIDE = 3072
const BASE_EDITOR_CELL = 18
const EDITOR_FIT_PADDING = 12
const MIN_EDITOR_ZOOM = 0.6
const MAX_EDITOR_ZOOM = 6
const EDITOR_ZOOM_STEP = 0.5

const gridPresets = [16, 24, 32, 40, 52, 72].map((value) => ({
  label: `${value} 格`,
  value,
}))

const colorOptions = [8, 12, 16, 20, 24, 0].map((value) => ({
  label: value ? `${value} 色` : '不限',
  value,
}))

type ActiveTool = 'pan' | 'pen' | 'eraser'

interface ColorStatView extends PatternStat {
  percent: string
  textColor: string
}

interface DisplayPaletteColor extends MardColor {
  textColor: string
}

interface TouchCell {
  column: number
  row: number
}

interface PanTouch {
  x: number
  y: number
  left: number
  top: number
}

interface Viewport {
  width: number
  height: number
}

const getContrastColor = (color: { r: number; g: number; b: number }) => {
  const luminance = (color.r * 0.299) + (color.g * 0.587) + (color.b * 0.114)
  return luminance > 165 ? '#20302b' : '#ffffff'
}

const getPixelRatio = () => {
  try {
    if (Taro.getWindowInfo) return Taro.getWindowInfo().pixelRatio || 1
    return Taro.getSystemInfoSync().pixelRatio || 1
  } catch {
    return 1
  }
}

export default function PindouPage() {
  const patternRef = useRef<Pattern | null>(null)
  const historyRef = useRef<number[][]>([])
  const futureRef = useRef<number[][]>([])
  const canvasCacheRef = useRef<Record<string, { canvas: CanvasNode; ctx: CanvasRenderingContext2D }>>({})
  const strokeSnapshotRef = useRef<number[] | null>(null)
  const strokeChangedRef = useRef(false)
  const lastStrokeCellRef = useRef<TouchCell | null>(null)
  const patternRevisionRef = useRef(0)
  const imageRequestIdRef = useRef(0)
  const imageInfoRef = useRef<{ width: number; height: number } | null>(null)
  const editorFitCellRef = useRef(BASE_EDITOR_CELL)
  const editorViewportRef = useRef<Viewport | null>(null)
  const editorCanvasLeftRef = useRef<number | null>(null)
  const editorCanvasTopRef = useRef<number | null>(null)
  const panTouchRef = useRef<PanTouch | null>(null)
  const drawTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [selectedGridWidth, setSelectedGridWidth] = useState(DEFAULT_GRID_WIDTH)
  const [colorLimit, setColorLimit] = useState(16)
  const [removeWhite, setRemoveWhite] = useState(false)
  const [originalPath, setOriginalPath] = useState('')
  const [originalSize, setOriginalSize] = useState('--')
  const [originalDimensions, setOriginalDimensions] = useState('--')
  const [hasImage, setHasImage] = useState(false)
  const [isLoadingImage, setIsLoadingImage] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [hasPattern, setHasPattern] = useState(false)
  const [patternDimensions, setPatternDimensions] = useState('--')
  const [totalBeads, setTotalBeads] = useState(0)
  const [colorStats, setColorStats] = useState<ColorStatView[]>([])
  const [activeTool, setActiveTool] = useState<ActiveTool>('pan')
  const [selectedPaletteIndex, setSelectedPaletteIndex] = useState(-1)
  const [selectedColorCode, setSelectedColorCode] = useState('选择颜色')
  const [selectedColorHex, setSelectedColorHex] = useState('#dfe9e5')
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  const [editorZoom, setEditorZoom] = useState(1)
  const [editorWidth, setEditorWidth] = useState(1)
  const [editorHeight, setEditorHeight] = useState(1)
  const [editorCanvasLeft, setEditorCanvasLeft] = useState(0)
  const [editorCanvasTop, setEditorCanvasTop] = useState(0)
  const [showPalette, setShowPalette] = useState(false)
  const [paletteTitle, setPaletteTitle] = useState('选择 MARD 颜色')
  const [replaceFromPaletteIndex, setReplaceFromPaletteIndex] = useState(-1)
  const [hasManualChanges, setHasManualChanges] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [hasExport, setHasExport] = useState(false)
  const [outputPath, setOutputPath] = useState('')
  const [outputSize, setOutputSize] = useState('--')
  const [isSaving, setIsSaving] = useState(false)

  const fullPalette = useMemo<DisplayPaletteColor[]>(() => (
    MARD_PALETTE.map((color) => ({
      ...color,
      textColor: getContrastColor(color),
    }))
  ), [])

  const isPatternLocked = useCallback(() => (
    isLoadingImage || isGenerating || isExporting || isSaving
  ), [isLoadingImage, isGenerating, isExporting, isSaving])

  useEffect(() => () => {
    if (drawTimerRef.current) clearTimeout(drawTimerRef.current)
    canvasCacheRef.current = {}
  }, [])

  const getCanvas = useCallback(async (selector: string) => {
    if (canvasCacheRef.current[selector]) {
      return canvasCacheRef.current[selector]
    }
    const value = await getCanvasNode(selector)
    canvasCacheRef.current[selector] = value
    return value
  }, [])

  const drawPatternGrid = useCallback((
    ctx: CanvasRenderingContext2D,
    options: {
      originX: number
      originY: number
      cellSize: number
      showCodes: boolean
      beadStyle: boolean
    },
  ) => {
    const pattern = patternRef.current
    if (!pattern) return

    const { originX, originY, cellSize, showCodes, beadStyle } = options
    const fontSize = Math.max(7, Math.floor(cellSize * 0.28))
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = `600 ${fontSize}px sans-serif`

    pattern.cells.forEach((paletteIndex, index) => {
      const column = index % pattern.width
      const row = Math.floor(index / pattern.width)
      const x = originX + (column * cellSize)
      const y = originY + (row * cellSize)

      if (paletteIndex < 0) {
        ctx.fillStyle = (column + row) % 2 ? '#f7eee8' : '#ffffff'
        ctx.fillRect(x, y, cellSize, cellSize)
      } else {
        const color = MARD_PALETTE[paletteIndex]
        ctx.fillStyle = color.hex
        ctx.fillRect(x, y, cellSize, cellSize)

        if (beadStyle && cellSize >= 12) {
          ctx.beginPath()
          ctx.fillStyle = 'rgba(255, 255, 255, 0.42)'
          ctx.arc(x + (cellSize / 2), y + (cellSize / 2), Math.max(1.2, cellSize * 0.12), 0, Math.PI * 2)
          ctx.fill()
        }

        if (showCodes) {
          ctx.fillStyle = getContrastColor(color)
          ctx.fillText(color.code, x + (cellSize / 2), y + (cellSize / 2))
        }
      }

      ctx.strokeStyle = (column % 5 === 0 || row % 5 === 0)
        ? 'rgba(112, 56, 40, 0.32)'
        : 'rgba(112, 56, 40, 0.14)'
      ctx.lineWidth = (column % 5 === 0 || row % 5 === 0) ? 1 : 0.5
      ctx.strokeRect(x, y, cellSize, cellSize)
    })
  }, [])

  const drawEditor = useCallback(async () => {
    if (!patternRef.current || !hasPattern) return

    try {
      const { canvas, ctx } = await getCanvas('#editorCanvas')
      const width = editorWidth
      const height = editorHeight
      const renderScale = Math.min(
        getPixelRatio(),
        MAX_EDITOR_BACKING_SIDE / width,
        MAX_EDITOR_BACKING_SIDE / height,
      )
      canvas.width = Math.max(1, Math.round(width * renderScale))
      canvas.height = Math.max(1, Math.round(height * renderScale))
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.scale(renderScale, renderScale)
      drawPatternGrid(ctx, {
        originX: 0,
        originY: 0,
        cellSize: width / patternRef.current.width,
        showCodes: width / patternRef.current.width >= 27,
        beadStyle: true,
      })
    } catch {
      // canvas may not be mounted yet
    }
  }, [drawPatternGrid, editorWidth, editorHeight, getCanvas, hasPattern])

  const getEditorPanBounds = useCallback((canvasWidth: number, canvasHeight: number) => {
    const viewport = editorViewportRef.current || {
      width: canvasWidth,
      height: canvasHeight,
    }
    const horizontalSpace = viewport.width - canvasWidth
    const verticalSpace = viewport.height - canvasHeight
    return {
      minLeft: Math.min(0, horizontalSpace),
      maxLeft: Math.max(0, horizontalSpace),
      minTop: Math.min(0, verticalSpace),
      maxTop: Math.max(0, verticalSpace),
    }
  }, [])

  const refreshPatternView = useCallback((options: {
    anchor?: { x: number; y: number }
    resetPosition?: boolean
    zoom?: number
  } = {}) => {
    const pattern = patternRef.current
    if (!pattern) return

    const usage = getPatternStats(pattern.cells)
    pattern.stats = usage.stats
    pattern.totalBeads = usage.totalBeads

    const nextColorStats: ColorStatView[] = usage.stats.map((item) => ({
      ...item,
      percent: usage.totalBeads
        ? `${(item.count * 100 / usage.totalBeads).toFixed(1)}%`
        : '0%',
      textColor: getContrastColor(item),
    }))

    const zoomValue = options.zoom ?? editorZoom
    const cellSize = (editorFitCellRef.current || BASE_EDITOR_CELL) * zoomValue
    const nextEditorWidth = Math.max(1, Math.round(pattern.width * cellSize))
    const nextEditorHeight = Math.max(1, Math.round(pattern.height * cellSize))
    const viewport = editorViewportRef.current || {
      width: nextEditorWidth,
      height: nextEditorHeight,
    }
    const bounds = getEditorPanBounds(nextEditorWidth, nextEditorHeight)

    let nextLeft = Number.isFinite(editorCanvasLeftRef.current as number)
      ? (editorCanvasLeftRef.current as number)
      : (viewport.width - nextEditorWidth) / 2
    let nextTop = Number.isFinite(editorCanvasTopRef.current as number)
      ? (editorCanvasTopRef.current as number)
      : (viewport.height - nextEditorHeight) / 2

    if (options.anchor) {
      nextLeft = (viewport.width / 2) - (options.anchor.x * nextEditorWidth)
      nextTop = (viewport.height / 2) - (options.anchor.y * nextEditorHeight)
    } else if (options.resetPosition) {
      nextLeft = (viewport.width - nextEditorWidth) / 2
      nextTop = (viewport.height - nextEditorHeight) / 2
    }

    nextLeft = Math.min(Math.max(bounds.minLeft, nextLeft), bounds.maxLeft)
    nextTop = Math.min(Math.max(bounds.minTop, nextTop), bounds.maxTop)
    editorCanvasLeftRef.current = nextLeft
    editorCanvasTopRef.current = nextTop

    setPatternDimensions(`${pattern.width} × ${pattern.height} 格`)
    setTotalBeads(usage.totalBeads)
    setColorStats(nextColorStats)
    setEditorWidth(nextEditorWidth)
    setEditorHeight(nextEditorHeight)
    setEditorCanvasLeft(nextLeft)
    setEditorCanvasTop(nextTop)
    setCanUndo(historyRef.current.length > 0)
    setCanRedo(futureRef.current.length > 0)
  }, [editorZoom, getEditorPanBounds])

  useEffect(() => {
    if (hasPattern) drawEditor()
  }, [hasPattern, editorWidth, editorHeight, editorCanvasLeft, editorCanvasTop, drawEditor])

  const measureEditorViewport = () => new Promise<Viewport>((resolve, reject) => {
    Taro.createSelectorQuery()
      .select('.editor-scroll')
      .fields({ size: true })
      .exec((res) => {
        const rect = res?.[0]
        if (!rect?.width || !rect?.height) {
          reject(new Error('editor viewport not found'))
          return
        }
        resolve({ width: rect.width, height: rect.height })
      })
  })

  const fitEditorView = useCallback(async () => {
    const pattern = patternRef.current
    if (!pattern) return

    try {
      const viewport = await measureEditorViewport()
      if (patternRef.current !== pattern) return
      const availableWidth = Math.max(1, viewport.width - (EDITOR_FIT_PADDING * 2))
      const availableHeight = Math.max(1, viewport.height - (EDITOR_FIT_PADDING * 2))
      editorViewportRef.current = viewport
      editorFitCellRef.current = Math.max(0.1, Math.min(
        availableWidth / pattern.width,
        availableHeight / pattern.height,
      ))
      editorCanvasLeftRef.current = null
      editorCanvasTopRef.current = null
      setEditorZoom(1)
      setEditorCanvasLeft(0)
      setEditorCanvasTop(0)
      refreshPatternView({ resetPosition: true })
    } catch {
      if (patternRef.current !== pattern) return
      editorFitCellRef.current = BASE_EDITOR_CELL
      refreshPatternView()
    }
  }, [refreshPatternView])

  const clearPattern = useCallback(() => {
    patternRef.current = null
    patternRevisionRef.current += 1
    historyRef.current = []
    futureRef.current = []
    delete canvasCacheRef.current['#editorCanvas']
    setHasPattern(false)
    setPatternDimensions('--')
    setTotalBeads(0)
    setColorStats([])
    setHasManualChanges(false)
    setHasExport(false)
    setOutputPath('')
    setOutputSize('--')
    setCanUndo(false)
    setCanRedo(false)
  }, [])

  const markManualChange = useCallback(() => {
    patternRevisionRef.current += 1
    setHasManualChanges(true)
    setHasExport(false)
    setOutputPath('')
    setOutputSize('--')
    setCanUndo(historyRef.current.length > 0)
    setCanRedo(futureRef.current.length > 0)
  }, [])

  const pushHistory = (cells: number[]) => {
    historyRef.current.push(cells)
    if (historyRef.current.length > MAX_HISTORY) historyRef.current.shift()
  }

  const loadImage = async (filePath: string, knownSize: number | undefined, requestId: number) => {
    try {
      const info = await Taro.getImageInfo({ src: filePath })
      const size = await getFileSize(filePath, knownSize)
      if (requestId !== imageRequestIdRef.current) return

      imageInfoRef.current = { width: info.width, height: info.height }
      clearPattern()
      setOriginalPath(filePath)
      setOriginalSize(formatFileSize(size))
      setOriginalDimensions(`${info.width} × ${info.height}`)
      setHasImage(true)
      setIsLoadingImage(false)
    } catch {
      if (requestId !== imageRequestIdRef.current) return
      setIsLoadingImage(false)
      Taro.showToast({ title: '读取图片失败', icon: 'none' })
    }
  }

  const onChooseImage = async () => {
    if (isPatternLocked()) return

    const requestId = imageRequestIdRef.current + 1
    imageRequestIdRef.current = requestId
    setIsLoadingImage(true)

    const files = await chooseImages()
    const file = files[0]
    if (!file?.tempFilePath) {
      if (requestId === imageRequestIdRef.current) setIsLoadingImage(false)
      return
    }

    await loadImage(file.tempFilePath, file.size, requestId)
  }

  const generateNow = async () => {
    if (isPatternLocked()) return
    const gridWidth = Math.round(Number(selectedGridWidth))
    if (gridWidth < 10 || gridWidth > 100) {
      Taro.showToast({ title: '宽度请输入 10–100', icon: 'none' })
      return
    }

    const sourcePath = originalPath
    const imageInfo = imageInfoRef.current
    if (!sourcePath || !imageInfo) {
      Taro.showToast({ title: '请先选择图片', icon: 'none' })
      return
    }

    const gridHeight = Math.max(1, Math.round(gridWidth * imageInfo.height / imageInfo.width))
    if (gridHeight > MAX_GRID_HEIGHT) {
      Taro.showToast({ title: '图片比例过长，请先裁剪原图', icon: 'none' })
      return
    }

    setIsGenerating(true)

    try {
      const { canvas, ctx } = await getCanvas('#sourceCanvas')
      const image = await loadCanvasImage(canvas, sourcePath)
      canvas.width = gridWidth
      canvas.height = gridHeight
      ctx.clearRect(0, 0, gridWidth, gridHeight)
      ctx.drawImage(image as any, 0, 0, gridWidth, gridHeight)
      const imageData = ctx.getImageData(0, 0, gridWidth, gridHeight)
      const pattern = generatePattern(imageData, gridWidth, gridHeight, {
        colorLimit,
        removeWhite,
      })

      if (!pattern.cells.length) {
        throw { userMessage: '去除白底后没有可用内容' }
      }

      patternRef.current = pattern
      patternRevisionRef.current += 1
      historyRef.current = []
      futureRef.current = []
      const firstColor = pattern.stats[0]

      setIsGenerating(false)
      setHasPattern(true)
      setHasManualChanges(false)
      setHasExport(false)
      setOutputPath('')
      setOutputSize('--')
      setActiveTool('pan')
      setSelectedPaletteIndex(firstColor ? firstColor.paletteIndex : -1)
      setSelectedColorCode(firstColor ? firstColor.code : '选择颜色')
      setSelectedColorHex(firstColor ? firstColor.hex : '#dfe9e5')
      setCanUndo(false)
      setCanRedo(false)
      setEditorZoom(1)
      setEditorCanvasLeft(0)
      setEditorCanvasTop(0)
      editorFitCellRef.current = 0
      editorViewportRef.current = null
      editorCanvasLeftRef.current = null
      editorCanvasTopRef.current = null
      await fitEditorView()
    } catch (error: any) {
      setIsGenerating(false)
      Taro.showToast({
        title: error?.userMessage || '生成失败，请重试',
        icon: 'none',
      })
    }
  }

  const onGenerate = () => {
    if (!originalPath || !imageInfoRef.current) {
      Taro.showToast({ title: '请先选择图片', icon: 'none' })
      return
    }
    if (isPatternLocked()) return

    if (hasPattern && hasManualChanges) {
      Taro.showModal({
        title: '重新生成图纸？',
        content: '重新生成会清除当前手工修改和撤销记录。',
        confirmText: '重新生成',
        success: (res) => {
          if (res.confirm) generateNow()
        },
      })
      return
    }

    generateNow()
  }

  const openPalette = (fromPaletteIndex = -1) => {
    const replaceColor = fromPaletteIndex >= 0 ? MARD_PALETTE[fromPaletteIndex] : null
    setShowPalette(true)
    setReplaceFromPaletteIndex(fromPaletteIndex)
    setPaletteTitle(replaceColor ? `将 ${replaceColor.code} 整版替换为` : '选择 MARD 颜色')
  }

  const onPaletteColorTap = (paletteIndex: number) => {
    const color = MARD_PALETTE[paletteIndex]
    if (!color) return

    if (replaceFromPaletteIndex >= 0 && patternRef.current) {
      if (isPatternLocked()) return
      const fromIndex = replaceFromPaletteIndex
      if (fromIndex !== paletteIndex) {
        pushHistory(patternRef.current.cells.slice())
        patternRef.current.cells = replacePatternColor(
          patternRef.current.cells,
          fromIndex,
          paletteIndex,
        )
        futureRef.current = []
        markManualChange()
      }
    }

    setSelectedPaletteIndex(paletteIndex)
    setSelectedColorCode(color.code)
    setSelectedColorHex(color.hex)
    setActiveTool('pen')
    setShowPalette(false)
    setReplaceFromPaletteIndex(-1)
    if (patternRef.current) refreshPatternView()
  }

  const changeZoom = (offset: number) => {
    const next = Math.min(Math.max(editorZoom + offset, MIN_EDITOR_ZOOM), MAX_EDITOR_ZOOM)
    if (next === editorZoom) return

    const viewport = editorViewportRef.current
    const anchor = viewport && editorWidth && editorHeight
      ? {
        x: Math.min(Math.max(((viewport.width / 2) - (editorCanvasLeftRef.current || 0)) / editorWidth, 0), 1),
        y: Math.min(Math.max(((viewport.height / 2) - (editorCanvasTopRef.current || 0)) / editorHeight, 0), 1),
      }
      : null

    const nextZoom = Number(next.toFixed(1))
    setEditorZoom(nextZoom)
    refreshPatternView({ anchor: anchor || undefined, zoom: nextZoom })
  }

  const applyPatternCell = (column: number, row: number) => {
    const pattern = patternRef.current
    if (!pattern) return
    const index = (row * pattern.width) + column
    const nextValue = activeTool === 'eraser' ? -1 : selectedPaletteIndex
    if (nextValue < -1 || pattern.cells[index] === nextValue) return
    pattern.cells[index] = nextValue
    strokeChangedRef.current = true
  }

  const applyStrokeLine = (start: TouchCell, end: TouchCell) => {
    let x = start.column
    let y = start.row
    const dx = Math.abs(end.column - start.column)
    const dy = Math.abs(end.row - start.row)
    const sx = start.column < end.column ? 1 : -1
    const sy = start.row < end.row ? 1 : -1
    let error = dx - dy

    while (true) {
      applyPatternCell(x, y)
      if (x === end.column && y === end.row) break
      const doubled = error * 2
      if (doubled > -dy) {
        error -= dy
        x += sx
      }
      if (doubled < dx) {
        error += dx
        y += sy
      }
    }
  }

  const scheduleEditorDraw = () => {
    if (drawTimerRef.current) return
    drawTimerRef.current = setTimeout(() => {
      drawTimerRef.current = null
      drawEditor()
    }, 16)
  }

  const getEditorTouchPoint = (touch: any) => {
    if (!touch) return null
    const x = [touch.clientX, touch.pageX, touch.x].find(Number.isFinite)
    const y = [touch.clientY, touch.pageY, touch.y].find(Number.isFinite)
    return Number.isFinite(x) && Number.isFinite(y) ? { x: x as number, y: y as number } : null
  }

  const applyTouch = (event: any) => {
    const touch = event.touches?.[0]
    if (!touch || !patternRef.current) return
    const x = Number.isFinite(touch.x) ? touch.x : touch.clientX
    const y = Number.isFinite(touch.y) ? touch.y : touch.clientY
    const column = Math.floor(x * patternRef.current.width / editorWidth)
    const row = Math.floor(y * patternRef.current.height / editorHeight)

    if (column < 0 || row < 0 || column >= patternRef.current.width || row >= patternRef.current.height) return

    const cell = { column, row }
    if (lastStrokeCellRef.current) {
      applyStrokeLine(lastStrokeCellRef.current, cell)
    } else {
      applyPatternCell(column, row)
    }
    lastStrokeCellRef.current = cell
    scheduleEditorDraw()
  }

  const onEditorTouchStart = (event: any) => {
    if (!patternRef.current || isPatternLocked()) return
    if (activeTool === 'pan') {
      const touch = event.touches?.[0]
      const point = getEditorTouchPoint(touch)
      if (!point) return
      panTouchRef.current = {
        x: point.x,
        y: point.y,
        left: editorCanvasLeftRef.current || 0,
        top: editorCanvasTopRef.current || 0,
      }
      return
    }
    strokeSnapshotRef.current = patternRef.current.cells.slice()
    strokeChangedRef.current = false
    lastStrokeCellRef.current = null
    applyTouch(event)
  }

  const onEditorTouchMove = (event: any) => {
    if (activeTool === 'pan') {
      const touch = event.touches?.[0]
      const point = getEditorTouchPoint(touch)
      if (!point || !panTouchRef.current) return
      const bounds = getEditorPanBounds(editorWidth, editorHeight)
      const left = Math.min(Math.max(
        bounds.minLeft,
        panTouchRef.current.left + (point.x - panTouchRef.current.x),
      ), bounds.maxLeft)
      const top = Math.min(Math.max(
        bounds.minTop,
        panTouchRef.current.top + (point.y - panTouchRef.current.y),
      ), bounds.maxTop)
      editorCanvasLeftRef.current = left
      editorCanvasTopRef.current = top
      setEditorCanvasLeft(left)
      setEditorCanvasTop(top)
      return
    }
    applyTouch(event)
  }

  const onEditorTouchEnd = () => {
    if (activeTool === 'pan') {
      panTouchRef.current = null
      return
    }
    if (strokeChangedRef.current && strokeSnapshotRef.current) {
      pushHistory(strokeSnapshotRef.current)
      futureRef.current = []
      markManualChange()
      refreshPatternView()
    }
    strokeSnapshotRef.current = null
    strokeChangedRef.current = false
    lastStrokeCellRef.current = null
  }

  const onUndo = () => {
    if (!patternRef.current || !historyRef.current.length || isPatternLocked()) return
    futureRef.current.push(patternRef.current.cells.slice())
    patternRef.current.cells = historyRef.current.pop() || []
    markManualChange()
    refreshPatternView()
  }

  const onRedo = () => {
    if (!patternRef.current || !futureRef.current.length || isPatternLocked()) return
    pushHistory(patternRef.current.cells.slice())
    patternRef.current.cells = futureRef.current.pop() || []
    markManualChange()
    refreshPatternView()
  }

  const renderExport = async (canvas: CanvasNode, ctx: CanvasRenderingContext2D) => {
    const pattern = patternRef.current
    if (!pattern) throw new Error('no pattern')

    const stats = getPatternStats(pattern.cells).stats
    const margin = 40
    const headerHeight = 94
    const coordinateSize = 34
    const legendColumns = stats.length > 80
      ? 5
      : (stats.length > 36 ? 4 : (pattern.width < 20 ? 2 : 3))
    const legendRowHeight = 42
    const legendRows = Math.ceil(stats.length / legendColumns)
    const legendHeight = stats.length ? 54 + (legendRows * legendRowHeight) : 0
    const verticalRoom = MAX_EXPORT_SIDE - (margin * 2) - headerHeight - coordinateSize - legendHeight
    const horizontalRoom = MAX_EXPORT_SIDE - (margin * 2) - coordinateSize
    const cellSize = Math.floor(Math.min(
      36,
      horizontalRoom / pattern.width,
      verticalRoom / pattern.height,
    ))

    if (cellSize < 12) {
      throw { userMessage: '图纸过大，请减少网格尺寸' }
    }

    const gridWidth = pattern.width * cellSize
    const gridHeight = pattern.height * cellSize
    const legendMinimumWidth = legendColumns * 230
    const width = Math.ceil(Math.min(
      MAX_EXPORT_SIDE,
      Math.max(
        (margin * 2) + coordinateSize + gridWidth,
        (margin * 2) + legendMinimumWidth,
      ),
    ))
    const height = Math.ceil((margin * 2) + headerHeight + coordinateSize + gridHeight + legendHeight)
    const gridX = Math.max(
      margin + coordinateSize,
      Math.round((width - gridWidth + coordinateSize) / 2),
    )
    const gridY = margin + headerHeight + coordinateSize

    canvas.width = width
    canvas.height = height
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
    ctx.fillStyle = '#8f3f2e'
    ctx.font = '700 34px sans-serif'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.fillText('拼豆图纸 · MARD 221 色板', margin, margin)
    ctx.fillStyle = '#806b63'
    ctx.font = '500 18px sans-serif'
    ctx.fillText(
      `${pattern.width} × ${pattern.height} 格  ·  ${pattern.totalBeads} 颗  ·  ${stats.length} 种颜色`,
      margin,
      margin + 48,
    )

    ctx.fillStyle = '#7c6860'
    ctx.font = '600 11px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    for (let column = 0; column < pattern.width; column += 1) {
      if (pattern.width > 52 && column % 5 !== 0) continue
      ctx.fillText(String(column + 1), gridX + (column * cellSize) + (cellSize / 2), gridY - 17)
    }
    ctx.textAlign = 'right'
    for (let row = 0; row < pattern.height; row += 1) {
      if (pattern.height > 52 && row % 5 !== 0) continue
      ctx.fillText(String(row + 1), gridX - 9, gridY + (row * cellSize) + (cellSize / 2))
    }

    drawPatternGrid(ctx, {
      originX: gridX,
      originY: gridY,
      cellSize,
      showCodes: cellSize >= 22,
      beadStyle: false,
    })

    if (stats.length) {
      const legendY = gridY + gridHeight + 34
      const legendX = margin
      const columnWidth = (width - (margin * 2)) / legendColumns
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = '#8f3f2e'
      ctx.font = '700 22px sans-serif'
      ctx.fillText('MARD 色号用量', legendX, legendY)

      stats.forEach((item, index) => {
        const column = index % legendColumns
        const row = Math.floor(index / legendColumns)
        const x = legendX + (column * columnWidth)
        const y = legendY + 34 + (row * legendRowHeight)
        ctx.fillStyle = item.hex
        ctx.fillRect(x, y, 28, 28)
        ctx.strokeStyle = '#ead8ce'
        ctx.lineWidth = 1
        ctx.strokeRect(x, y, 28, 28)
        ctx.fillStyle = '#3d2a25'
        ctx.font = '600 16px sans-serif'
        ctx.fillText(`${item.code}  ${item.count} 颗`, x + 38, y + 14)
      })
    }

    return exportCanvasToTempFile(canvas, {
      width,
      height,
      fileType: 'png',
    })
  }

  const onExport = async () => {
    if (!patternRef.current || isPatternLocked()) {
      if (!patternRef.current) Taro.showToast({ title: '请先生成图纸', icon: 'none' })
      return
    }

    const exportRevision = patternRevisionRef.current
    setIsExporting(true)

    try {
      const { canvas, ctx } = await getCanvas('#exportCanvas')
      const path = await renderExport(canvas, ctx)
      const size = await getFileSize(path)
      if (exportRevision !== patternRevisionRef.current) {
        throw { userMessage: '图纸已变化，请重新导出' }
      }
      setIsExporting(false)
      setHasExport(true)
      setOutputPath(path)
      setOutputSize(formatFileSize(size))
    } catch (error: any) {
      setIsExporting(false)
      Taro.showToast({
        title: error?.userMessage || '导出失败，请重试',
        icon: 'none',
      })
    }
  }

  const onPreviewExport = () => {
    if (!outputPath) return
    Taro.previewImage({ current: outputPath, urls: [outputPath] })
  }

  const onSave = async () => {
    if (!outputPath) {
      Taro.showToast({ title: '请先导出图纸', icon: 'none' })
      return
    }
    if (isSaving || isExporting || isGenerating) return

    setIsSaving(true)
    try {
      await saveImageToAlbum({
        filePath: outputPath,
        permissionText: '打开权限后，就能把拼豆图纸保存到相册。',
      })
      setIsSaving(false)
      Taro.showToast({ title: '已保存到相册', icon: 'success' })
    } catch (error: any) {
      setIsSaving(false)
      if (error?.handled || isSaveCancel(error)) return
      Taro.showToast({
        title: error?.userMessage || '保存失败',
        icon: 'none',
      })
    }
  }

  useShareAppMessage(() => ({
    title: '把图片转换成可编辑的 MARD 拼豆图纸',
    path: '/packages/tools/pindou/pindou',
  }))

  useShareTimeline(() => ({
    title: '拼豆工具：图片本地生成 MARD 色号图纸',
  }))

  const locked = isPatternLocked()

  return (
    <View className='shell'>
      <NavigationBar title='拼豆' background='var(--s-1-weak, #f5f7fa)' />
      <ScrollView className='page-scroll' scrollY enhanced showScrollbar={false}>
        <View className='page'>
          <ToolIntroCard
            title='图片变成拼豆图纸'
            description='导入照片，使用 MARD 221 色板生成可编辑的拼豆图纸。'
          />

          <View className='panel panel--first'>
            <View className='card-head'>
              <View>
                <Text className='card-title'>选择图片</Text>
                <Text className='card-subtitle'>JPG、PNG 等常见格式</Text>
              </View>
            </View>

            {hasImage ? (
              <View className={`image-preview ${locked ? 'is-disabled' : ''}`}>
                <Image className='preview-thumb' src={originalPath} mode='aspectFill' />
                <View className='image-info'>
                  <Text className='image-title'>原图已就绪</Text>
                  <Text className='image-desc'>{originalSize} / {originalDimensions}</Text>
                </View>
                <View className='change-button' onClick={onChooseImage}>更换</View>
              </View>
            ) : (
              <View className='uploader' onClick={onChooseImage}>
                <View className='upload-icon'>
                  <Text className='upload-icon-text'>＋</Text>
                </View>
                <View className='upload-copy'>
                  <Text className='upload-title'>选择一张图片</Text>
                  <Text className='upload-desc'>支持从相册选择或直接拍照</Text>
                </View>
              </View>
            )}
          </View>

          <View className='panel'>
            <View className='card-head'>
              <View>
                <Text className='card-title'>图纸参数</Text>
                <Text className='card-subtitle'>高度会按原图比例自动计算</Text>
              </View>
              <Text className='setting-value'>{selectedGridWidth || '--'} 格宽</Text>
            </View>

            <View className='setting-block'>
              <Text className='setting-label'>宽度格数</Text>
              <View className='chip-grid'>
                {gridPresets.map((item) => (
                  <View
                    key={item.value}
                    className={`option-chip ${selectedGridWidth === item.value ? 'is-active' : ''} ${locked ? 'is-disabled' : ''}`}
                    onClick={() => {
                      if (locked) return
                      setSelectedGridWidth(item.value)
                    }}
                  >
                    {item.label}
                  </View>
                ))}
              </View>
            </View>

            <View className='setting-block'>
              <Text className='setting-label'>限制用色</Text>
              <View className='chip-grid'>
                {colorOptions.map((item) => (
                  <View
                    key={item.value}
                    className={`option-chip ${colorLimit === item.value ? 'is-active' : ''} ${locked ? 'is-disabled' : ''}`}
                    onClick={() => {
                      if (locked) return
                      setColorLimit(item.value)
                    }}
                  >
                    {item.label}
                  </View>
                ))}
              </View>
              <Text className='helper-note'>颜色越少越容易备料；不限色会使用完整 MARD 色板匹配。</Text>
            </View>

            <View
              className={`switch-row ${locked ? 'is-disabled' : ''}`}
              onClick={() => {
                if (locked) return
                setRemoveWhite(!removeWhite)
              }}
            >
              <View className='switch-copy'>
                <Text className='switch-title'>去除纯白背景并自动裁边</Text>
                <Text className='switch-desc'>只从图片边缘移除接近纯白的连续区域</Text>
              </View>
              <View className={`switch-control ${removeWhite ? 'is-on' : ''}`}>
                <View className='switch-dot' />
              </View>
            </View>

            <View
              className={`primary-btn generate-button ${locked ? 'is-disabled' : ''}`}
              onClick={onGenerate}
            >
              {isGenerating ? '正在生成' : (hasPattern ? '重新生成图纸' : '生成拼豆图纸')}
            </View>
          </View>

          <View className='panel editor-panel'>
            <View className='card-head'>
              <View>
                <Text className='card-title'>图纸预览与编辑</Text>
                <Text className='card-subtitle'>{hasPattern ? patternDimensions : '生成后可手动微调每一颗豆'}</Text>
              </View>
              <Text className={`result-badge ${hasPattern ? 'is-ready' : ''}`}>
                {hasPattern ? `${totalBeads} 颗` : '待生成'}
              </Text>
            </View>

            {hasPattern ? (
              <>
                <View className='editor-toolbar'>
                  <View className='tool-group tool-group-primary'>
                    {(['pan', 'pen', 'eraser'] as ActiveTool[]).map((tool) => (
                      <View
                        key={tool}
                        className={`tool-button ${activeTool === tool ? 'is-active' : ''}`}
                        onClick={() => {
                          if (tool === 'pen' && selectedPaletteIndex < 0) {
                            openPalette()
                            return
                          }
                          setActiveTool(tool)
                        }}
                      >
                        <Text>{tool === 'pan' ? '移动' : tool === 'pen' ? '画笔' : '橡皮'}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                <View className='color-picker-card' onClick={() => openPalette()}>
                  <View className='color-preview-shell'>
                    <View className='color-preview' style={{ background: selectedColorHex }} />
                  </View>
                  <View className='color-picker-copy'>
                    <Text className='color-picker-label'>当前拼豆颜色</Text>
                    <Text className='color-picker-value'>{selectedColorCode}</Text>
                  </View>
                  <View className='color-picker-action'>
                    <Text>点击更换</Text>
                    <Text className='chevron'>›</Text>
                  </View>
                </View>

                <View className='editor-toolbar toolbar-secondary'>
                  <View className='tool-group'>
                    <View className={`square-button ${canUndo ? '' : 'is-disabled'}`} onClick={onUndo}>
                      <Text>撤销</Text>
                    </View>
                    <View className={`square-button ${canRedo ? '' : 'is-disabled'}`} onClick={onRedo}>
                      <Text>重做</Text>
                    </View>
                  </View>
                  <View className='zoom-group'>
                    <View className='zoom-button' onClick={() => changeZoom(-EDITOR_ZOOM_STEP)}>－</View>
                    <Text className='zoom-value'>{editorZoom}×</Text>
                    <View className='zoom-button' onClick={() => changeZoom(EDITOR_ZOOM_STEP)}>＋</View>
                  </View>
                </View>

                <View className='editor-scroll'>
                  <View className='editor-stage'>
                    <Canvas
                      type='2d'
                      id='editorCanvas'
                      canvasId='editorCanvas'
                      className='editor-canvas'
                      style={{
                        width: `${editorWidth}px`,
                        height: `${editorHeight}px`,
                        left: `${editorCanvasLeft}px`,
                        top: `${editorCanvasTop}px`,
                      }}
                      onTouchStart={onEditorTouchStart}
                      onTouchMove={onEditorTouchMove}
                      onTouchEnd={onEditorTouchEnd}
                      onTouchCancel={onEditorTouchEnd}
                    />
                  </View>
                </View>
                <Text className='editor-tip'>移动模式可拖动画布；画笔或橡皮支持连续滑动操作。</Text>
              </>
            ) : (
              <Text className='result-empty'>
                选择图片并设置格数后，拼豆网格会显示在这里。所有转换都在当前设备完成。
              </Text>
            )}
          </View>

          {hasPattern ? (
            <View className='panel'>
              <View className='card-head'>
                <View>
                  <Text className='card-title'>MARD 色号用量</Text>
                  <Text className='card-subtitle'>{colorStats.length} 种颜色，共 {totalBeads} 颗</Text>
                </View>
                <Text className='replace-hint'>点色号可整版替换</Text>
              </View>

              <View className='stats-list'>
                {colorStats.map((item) => (
                  <View
                    key={item.paletteIndex}
                    className='stat-item'
                    onClick={() => {
                      if (locked) return
                      openPalette(item.paletteIndex)
                    }}
                  >
                    <View className='stat-swatch' style={{ background: item.hex, color: item.textColor }}>
                      {item.code}
                    </View>
                    <View className='stat-main'>
                      <Text className='stat-code'>MARD {item.code}</Text>
                      <Text className='stat-hex'>{item.hex}</Text>
                    </View>
                    <View className='stat-count'>
                      <Text className='stat-number'>{item.count} 颗</Text>
                      <Text className='stat-percent'>{item.percent}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          <View className='panel export-panel'>
            <View className='card-head'>
              <View>
                <Text className='card-title'>导出图纸</Text>
                <Text className='card-subtitle'>PNG 包含坐标、网格、色号和用量统计</Text>
              </View>
              <Text className={`result-badge ${hasExport ? 'is-ready' : ''}`}>
                {hasExport ? outputSize : '待导出'}
              </Text>
            </View>

            {hasExport ? (
              <View className='export-preview' onClick={onPreviewExport}>
                <Image className='export-image' src={outputPath} mode='aspectFit' />
                <Text className='preview-mask'>点击查看完整图纸</Text>
              </View>
            ) : null}

            <View
              className={`primary-btn export-button ${isExporting ? 'is-disabled' : ''}`}
              onClick={onExport}
            >
              {isExporting ? '正在导出' : (hasExport ? '重新导出 PNG' : '导出高清 PNG')}
            </View>

            <MediaResultActions
              available={hasExport && Boolean(outputPath)}
              busy={isSaving || isExporting || isGenerating}
              title={hasExport ? '高清拼豆图纸已生成' : '导出后可以保存到相册'}
              desc={hasExport ? '屏幕色仅供参考，实体豆可能存在色差' : '图纸会以 PNG 格式生成'}
              onSave={onSave}
            />
          </View>
        </View>
      </ScrollView>

      {showPalette ? (
        <View className='palette-overlay' onClick={() => {
          setShowPalette(false)
          setReplaceFromPaletteIndex(-1)
        }}
        >
          <View className='palette-sheet' onClick={(e) => e.stopPropagation()}>
            <View className='palette-head'>
              <View>
                <Text className='palette-title'>{paletteTitle}</Text>
                <Text className='palette-desc'>MARD 221 标准色 · 屏幕近似值</Text>
              </View>
              <View
                className='palette-close'
                onClick={() => {
                  setShowPalette(false)
                  setReplaceFromPaletteIndex(-1)
                }}
              >
                关闭
              </View>
            </View>
            <ScrollView className='palette-scroll' scrollY enhanced showScrollbar={false}>
              <View className='palette-grid'>
                {fullPalette.map((item) => (
                  <View
                    key={item.index}
                    className={`palette-color ${selectedPaletteIndex === item.index && replaceFromPaletteIndex < 0 ? 'is-selected' : ''}`}
                    onClick={() => onPaletteColorTap(item.index)}
                  >
                    {selectedPaletteIndex === item.index && replaceFromPaletteIndex < 0 ? (
                      <View className='palette-selected-mark'>
                        <Text className='palette-check'>✓</Text>
                      </View>
                    ) : null}
                    <View className='palette-swatch' style={{ background: item.hex, color: item.textColor }}>
                      {item.code}
                    </View>
                    <Text className='palette-hex'>{item.hex}</Text>
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        </View>
      ) : null}

      <Canvas type='2d' id='sourceCanvas' canvasId='sourceCanvas' className='hidden-canvas' />
      <Canvas type='2d' id='exportCanvas' canvasId='exportCanvas' className='hidden-canvas' />
    </View>
  )
}
