import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, Image, Input, ScrollView, Text, View } from '@tarojs/components'
import Taro, { useShareAppMessage, useShareTimeline, useUnload } from '@tarojs/taro'

import NavigationBar from '@/components/NavigationBar'
import {
  exportCanvasToTempFile,
  formatFileSize,
  getCanvasNode,
  getFileSize,
  loadCanvasImage,
} from '@/utils/canvas'
import { chooseImages } from '@/utils/image-picker'
import { isSaveCancel, saveImageToAlbum } from '@/utils/image-save'
import {
  computeImagePlacement,
  CopyMode,
  createDefaultCrop,
  createLazyPdfCache,
  createLayoutSlots,
  createSlotWatermarkPlan,
  CropState,
  getA4PixelSize,
  getPdfPageSizePoints,
  getResultNote,
  ImageFit,
  JPG_QUALITY,
  MaterialItem,
  MaterialRole,
  MAX_MATERIALS,
  normalizeCropForSlot,
  PairLayout,
  PaperOrientation,
  panCrop,
  resetCrop,
  resolveWatermarkText,
  rotateCrop,
  validateMaterialsForExport,
  WatermarkOpacityId,
  WATERMARK_PRESETS,
  zoomCrop,
} from './index.logic'

import './index.scss'

const PDF_FILE_NAME = 'document-copy-output.pdf'
const EDITOR_FALLBACK_WIDTH = 240
const EDITOR_MAX_HEIGHT = 360

const opacityOptions: Array<{ id: WatermarkOpacityId; title: string }> = [
  { id: 'light', title: '浅' },
  { id: 'medium', title: '中' },
  { id: 'strong', title: '深' },
]

function createItemId() {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`
}

function roleForIndex(mode: CopyMode, index: number): MaterialRole {
  if (mode !== 'id-card') return 'material'
  return index === 0 ? 'front' : 'back'
}

function roleLabel(mode: CopyMode, item: MaterialItem, index: number) {
  if (mode === 'id-card') return item.role === 'front' ? '正面' : '反面'
  return `材料 ${index + 1}`
}

function getPdfOutputPath() {
  const env = (Taro as any).env
  if (!env?.USER_DATA_PATH) return ''
  return `${env.USER_DATA_PATH}/${PDF_FILE_NAME}`
}

async function removeFileQuietly(filePath: string) {
  if (!filePath || !Taro.getFileSystemManager) return
  const fs = Taro.getFileSystemManager()
  await new Promise<void>((resolve) => {
    fs.unlink({
      filePath,
      complete: () => resolve(),
    })
  })
}

function defaultFitForMode(mode: CopyMode): ImageFit {
  return mode === 'materials' ? 'contain' : 'cover'
}

export default function DocumentCopyPage() {
  const [mode, setMode] = useState<CopyMode>('id-card')
  const [orientation, setOrientation] = useState<PaperOrientation>('portrait')
  const [pairLayout, setPairLayout] = useState<PairLayout>('vertical')
  const [items, setItems] = useState<MaterialItem[]>([])
  const [activeId, setActiveId] = useState('')
  const [watermarkPresetId, setWatermarkPresetId] = useState<(typeof WATERMARK_PRESETS)[number]['id']>('off')
  const [customWatermark, setCustomWatermark] = useState('')
  const [opacityId, setOpacityId] = useState<WatermarkOpacityId>('medium')
  const [outputPath, setOutputPath] = useState('')
  const [pdfPath, setPdfPath] = useState('')
  const [outputSize, setOutputSize] = useState('--')
  const [outputDimensions, setOutputDimensions] = useState('--')
  const [resultNote, setResultNote] = useState('等待生成')
  const [generating, setGenerating] = useState(false)
  const [pdfGenerating, setPdfGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [busyAction, setBusyAction] = useState('')
  const [editorHostWidth, setEditorHostWidth] = useState(EDITOR_FALLBACK_WIDTH)

  const pdfPathRef = useRef('')
  const pdfCacheRef = useRef(createLazyPdfCache())
  const panTouchRef = useRef<{ x: number; y: number; crop: CropState } | null>(null)

  const isBusy = generating || pdfGenerating
  const watermarkEnabled = watermarkPresetId !== 'off'
  const maxCount = mode === 'id-card' ? 2 : MAX_MATERIALS
  const remainCount = Math.max(0, maxCount - items.length)
  const activeItem = items.find((item) => item.id === activeId) || null

  const layoutSlots = useMemo(() => {
    if (!items.length) return []
    try {
      return createLayoutSlots({
        mode,
        orientation,
        count: mode === 'id-card' ? 2 : items.length,
        pairLayout,
      })
    } catch {
      return []
    }
  }, [items.length, mode, orientation, pairLayout])

  const activeSlot = useMemo(() => {
    if (!activeItem) return null
    const index = items.findIndex((item) => item.id === activeItem.id)
    return layoutSlots[index] || null
  }, [activeItem, items, layoutSlots])

  const editorStageSize = useMemo(() => {
    if (!activeSlot) return { width: editorHostWidth, height: 220 }
    const ratio = activeSlot.width / activeSlot.height
    const width = Math.min(editorHostWidth, EDITOR_MAX_HEIGHT * ratio)
    return { width, height: width / ratio }
  }, [activeSlot, editorHostWidth])

  const editorPlacement = useMemo(() => {
    if (!activeItem || !activeSlot) return null
    return computeImagePlacement(
      activeItem.width,
      activeItem.height,
      activeSlot.width,
      activeSlot.height,
      activeItem.crop,
    )
  }, [activeItem, activeSlot])

  const invalidateOutputs = () => {
    pdfCacheRef.current.invalidate()
    setOutputPath('')
    setOutputSize('--')
    setOutputDimensions('--')
    setPdfPath('')
  }

  const invalidatePdf = () => {
    pdfCacheRef.current.invalidate()
    setPdfPath('')
  }

  useEffect(() => {
    if (!activeSlot) return
    Taro.nextTick(() => {
      const query = Taro.createSelectorQuery()
      query
        .select('#documentCopyEditorHost')
        .boundingClientRect((rect) => {
          if (rect && !Array.isArray(rect) && rect.width > 16) setEditorHostWidth(rect.width - 16)
        })
        .exec()
    })
  }, [activeSlot?.width, activeSlot?.height])

  useUnload(() => {
    if (pdfPathRef.current) {
      removeFileQuietly(pdfPathRef.current)
      pdfPathRef.current = ''
    }
  })

  const updateItems = (next: MaterialItem[], targetMode: CopyMode = mode, note?: string) => {
    setItems(next)
    if (!next.find((item) => item.id === activeId)) {
      setActiveId(next[0]?.id || '')
    }
    invalidateOutputs()
    setResultNote(note ?? getResultNote(targetMode, next.length))
  }

  const loadItem = async (filePath: string, role: MaterialRole): Promise<MaterialItem> => {
    const info = await Taro.getImageInfo({ src: filePath })
    if (info.width <= 0 || info.height <= 0) throw new RangeError('图片尺寸无效')
    return {
      id: createItemId(),
      path: filePath,
      width: info.width,
      height: info.height,
      role,
      crop: createDefaultCrop({ fit: defaultFitForMode(mode) }),
    }
  }

  const onChooseImages = async () => {
    if (isBusy || saving) return
    if (remainCount <= 0) {
      Taro.showToast({ title: mode === 'id-card' ? '身份证只需正反面两张' : `最多选择 ${MAX_MATERIALS} 张`, icon: 'none' })
      return
    }

    const files = await chooseImages({ count: Math.min(remainCount, 9) })
    if (!files.length) return

    try {
      const startIndex = items.length
      const nextItems = await Promise.all(
        files.map((file, offset) => loadItem(file.tempFilePath, roleForIndex(mode, startIndex + offset))),
      )
      const next = items.concat(nextItems).slice(0, maxCount)
      updateItems(next)
      if (!activeId && next[0]) setActiveId(next[0].id)
    } catch {
      Taro.showToast({ title: '读取图片失败', icon: 'none' })
    }
  }

  const onSwitchMode = (nextMode: CopyMode) => {
    if (isBusy || nextMode === mode) return
    setMode(nextMode)
    const limited = items.slice(0, nextMode === 'id-card' ? 2 : MAX_MATERIALS).map((item, index) => ({
      ...item,
      role: roleForIndex(nextMode, index),
      crop: createDefaultCrop({
        fit: defaultFitForMode(nextMode),
        rotation: item.crop.rotation,
      }),
    }))
    updateItems(limited, nextMode)
  }

  const onSwitchOrientation = (next: PaperOrientation) => {
    if (isBusy || next === orientation) return
    setOrientation(next)
    invalidateOutputs()
    setResultNote(getResultNote(mode, items.length))
  }

  const moveImage = (index: number, offset: number) => {
    if (isBusy) return
    const to = index + offset
    if (index < 0 || to < 0 || index >= items.length || to >= items.length) return
    const next = items.slice()
    const current = next[index]
    next[index] = next[to]
    next[to] = current
    updateItems(
      next.map((item, i) => ({
        ...item,
        role: roleForIndex(mode, i),
      })),
    )
  }

  const onRemoveImage = (index: number) => {
    if (isBusy) return
    const next = items
      .filter((_, i) => i !== index)
      .map((item, i) => ({
        ...item,
        role: roleForIndex(mode, i),
      }))
    updateItems(next)
  }

  const onClearImages = () => {
    if (isBusy || saving) return
    updateItems([])
    setActiveId('')
  }

  const patchActiveCrop = (updater: (crop: CropState) => CropState) => {
    if (!activeItem || !activeSlot || isBusy) return
    const next = items.map((item) => {
      if (item.id !== activeItem.id) return item
      return {
        ...item,
        crop: normalizeCropForSlot(
          updater(item.crop),
          item.width,
          item.height,
          activeSlot.width,
          activeSlot.height,
        ),
      }
    })
    updateItems(next, mode, '可生成排版')
  }

  const onEditorTouchStart = (event: any) => {
    if (!activeItem || !activeSlot || isBusy) return
    const touch = event.touches?.[0]
    if (!touch) return
    panTouchRef.current = {
      x: touch.pageX ?? touch.clientX ?? 0,
      y: touch.pageY ?? touch.clientY ?? 0,
      crop: activeItem.crop,
    }
  }

  const onEditorTouchMove = (event: any) => {
    if (!activeItem || !activeSlot || !panTouchRef.current || isBusy) return
    const touch = event.touches?.[0]
    if (!touch) return
    const x = touch.pageX ?? touch.clientX ?? 0
    const y = touch.pageY ?? touch.clientY ?? 0
    const deltaX = x - panTouchRef.current.x
    const deltaY = y - panTouchRef.current.y
    const nextCrop = panCrop(
      panTouchRef.current.crop,
      deltaX * (activeSlot.width / editorStageSize.width),
      deltaY * (activeSlot.height / editorStageSize.height),
      activeItem.width,
      activeItem.height,
      activeSlot.width,
      activeSlot.height,
    )
    panTouchRef.current = { x, y, crop: nextCrop }
    const next = items.map((item) => (item.id === activeItem.id ? { ...item, crop: nextCrop } : item))
    setItems(next)
    invalidateOutputs()
    setResultNote('可生成排版')
  }

  const onEditorTouchEnd = () => {
    panTouchRef.current = null
  }

  const drawImageInSlot = async (
    canvas: any,
    ctx: CanvasRenderingContext2D,
    item: MaterialItem,
    slot: { x: number; y: number; width: number; height: number },
  ) => {
    const image = await loadCanvasImage(canvas, item.path)
    const placement = computeImagePlacement(item.width, item.height, slot.width, slot.height, item.crop)

    ctx.save()
    ctx.beginPath()
    ctx.rect(slot.x, slot.y, slot.width, slot.height)
    ctx.clip()
    ctx.translate(slot.x + placement.centerX, slot.y + placement.centerY)
    ctx.rotate((placement.rotation * Math.PI) / 180)
    ctx.drawImage(
      image as any,
      -placement.drawWidth / 2,
      -placement.drawHeight / 2,
      placement.drawWidth,
      placement.drawHeight,
    )
    ctx.restore()
  }

  const drawSlotWatermark = (
    ctx: CanvasRenderingContext2D,
    slot: { x: number; y: number; width: number; height: number },
    text: string,
  ) => {
    const plan = createSlotWatermarkPlan(slot as any, text, opacityId)
    if (!plan.enabled) return
    ctx.save()
    ctx.beginPath()
    ctx.rect(slot.x, slot.y, slot.width, slot.height)
    ctx.clip()
    ctx.globalAlpha = plan.opacity
    ctx.fillStyle = '#1f2d35'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = `500 ${plan.fontSize}px sans-serif`
    for (const position of plan.positions) {
      ctx.save()
      ctx.translate(position.x, position.y)
      ctx.rotate(plan.rotationRadians)
      ctx.fillText(plan.text, 0, 0)
      ctx.restore()
    }
    ctx.restore()
  }

  const writePdfFromJpg = async (jpgPath: string) => {
    const output = getPdfOutputPath()
    if (!output) throw new Error('无法写入 PDF')
    await removeFileQuietly(output)

    const fs = Taro.getFileSystemManager()
    const fileData = await new Promise<ArrayBuffer>((resolve, reject) => {
      fs.readFile({
        filePath: jpgPath,
        success: (res) => {
          const data = (res as any).data
          if (typeof data === 'string' || !data) {
            reject(new Error('读取 JPG 二进制数据失败'))
            return
          }
          resolve(data as ArrayBuffer)
        },
        fail: reject,
      })
    })
    const jpgBytes = new Uint8Array(fileData)
    const { PDFDocument } = await import('pdf-lib')
    const pdfDoc = await PDFDocument.create()
    const embedded = await pdfDoc.embedJpg(jpgBytes)
    const pageSize = getPdfPageSizePoints(orientation)
    const page = pdfDoc.addPage([pageSize.width, pageSize.height])
    page.drawImage(embedded, {
      x: 0,
      y: 0,
      width: pageSize.width,
      height: pageSize.height,
    })
    const pdfBytes = await pdfDoc.save()
    const pdfBuffer = pdfBytes.slice().buffer as ArrayBuffer
    await new Promise<void>((resolve, reject) => {
      fs.writeFile({
        filePath: output,
        data: pdfBuffer,
        success: () => resolve(),
        fail: reject,
      })
    })
    return output
  }

  const ensurePdf = async () => {
    if (!outputPath) throw new Error('请先生成排版')
    if (pdfPath) return pdfPath

    setPdfGenerating(true)
    setBusyAction('pdf')
    setResultNote('正在生成 PDF')
    const promise = pdfCacheRef.current.ensure(outputPath, writePdfFromJpg).then((path) => {
      pdfPathRef.current = path
      setPdfPath(path)
      setResultNote('JPG 和 PDF 均已就绪')
      return path
    })
    try {
      return await promise
    } finally {
      setPdfGenerating(false)
      setBusyAction('')
    }
  }

  const onGenerate = async () => {
    if (isBusy) return
    try {
      validateMaterialsForExport(
        mode,
        items.map((item) => ({ width: item.width, height: item.height })),
      )
    } catch (error: any) {
      Taro.showToast({ title: error?.message || '无法生成', icon: 'none' })
      return
    }

    const watermarkText = resolveWatermarkText({
      enabled: watermarkEnabled,
      presetId: watermarkPresetId,
      customText: customWatermark,
    })
    if (watermarkEnabled && !watermarkText) {
      Taro.showToast({ title: '请填写水印文字', icon: 'none' })
      return
    }

    setGenerating(true)
    setResultNote('正在排版')
    setBusyAction('generate')

    try {
      const slots = createLayoutSlots({
        mode,
        orientation,
        count: mode === 'id-card' ? 2 : items.length,
        pairLayout,
      })
      const page = getA4PixelSize(orientation)
      const { canvas, ctx } = await getCanvasNode('#documentCopyCanvas')
      canvas.width = page.width
      canvas.height = page.height
      ctx.clearRect(0, 0, page.width, page.height)
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, page.width, page.height)

      for (let index = 0; index < slots.length; index += 1) {
        const item = items[index]
        const slot = slots[index]
        if (!item || !slot) continue
        await drawImageInSlot(canvas, ctx, item, slot)
        if (watermarkText) drawSlotWatermark(ctx, slot, watermarkText)
      }

      const path = await exportCanvasToTempFile(canvas, {
        width: page.width,
        height: page.height,
        fileType: 'jpg',
        quality: JPG_QUALITY,
      })
      const size = await getFileSize(path)

      setOutputPath(path)
      invalidatePdf()
      setOutputSize(formatFileSize(size))
      setOutputDimensions(`${page.width} × ${page.height}`)
      setResultNote('已生成 JPG，PDF 可按需生成')
    } catch (error: any) {
      setResultNote('生成失败')
      Taro.showToast({ title: error?.message || '导出失败', icon: 'none' })
      invalidateOutputs()
    } finally {
      setGenerating(false)
      setBusyAction('')
    }
  }

  const onSaveImage = async () => {
    if (!outputPath) {
      Taro.showToast({ title: '请先生成排版', icon: 'none' })
      return
    }
    if (saving || isBusy) return
    setSaving(true)
    setBusyAction('save')
    try {
      await saveImageToAlbum({
        filePath: outputPath,
        permissionText: '打开权限后，就能把排版结果保存到相册。',
      })
      Taro.showToast({ title: '已保存到相册', icon: 'success' })
    } catch (error: any) {
      if (error?.handled || isSaveCancel(error)) return
      Taro.showToast({ title: error?.userMessage || '保存失败', icon: 'none' })
    } finally {
      setSaving(false)
      setBusyAction('')
    }
  }

  const onPreviewPdf = async () => {
    if (!outputPath) {
      Taro.showToast({ title: '请先生成排版', icon: 'none' })
      return
    }
    if (pdfGenerating) return
    try {
      const path = await ensurePdf()
      await Taro.openDocument({
        filePath: path,
        fileType: 'pdf',
        showMenu: true,
      } as any)
    } catch (error: any) {
      setResultNote('PDF 操作失败')
      Taro.showToast({ title: error?.message || '预览 PDF 失败', icon: 'none' })
    }
  }

  const onSharePdf = async () => {
    if (!outputPath) {
      Taro.showToast({ title: '请先生成排版', icon: 'none' })
      return
    }
    if (pdfGenerating) return
    const taroApi = Taro as any
    if (
      typeof taroApi.shareFileMessage !== 'function' ||
      (typeof taroApi.canIUse === 'function' && !taroApi.canIUse('shareFileMessage'))
    ) {
      Taro.showToast({ title: '当前微信版本不支持发送文件，请先预览后使用菜单分享', icon: 'none' })
      return
    }
    try {
      const path = await ensurePdf()
      await taroApi.shareFileMessage({
        filePath: path,
        fileName: '证件材料复印排版.pdf',
      })
    } catch (error: any) {
      setResultNote('PDF 操作失败')
      Taro.showToast({ title: error?.message || '发送 PDF 失败', icon: 'none' })
    }
  }

  useShareAppMessage(() => ({
    title: '身份证正反面、材料图一键排成 A4，本地生成可发送 PDF',
    path: '/packages/document-copy/index/index',
  }))

  useShareTimeline(() => ({
    title: '证件材料复印排版：一键排成 A4',
  }))

  const editorImageStyle = activeItem && activeSlot && editorPlacement
    ? {
        width: `${(editorPlacement.drawWidth / activeSlot.width) * 100}%`,
        height: `${(editorPlacement.drawHeight / activeSlot.height) * 100}%`,
        left: `${(editorPlacement.centerX / activeSlot.width) * 100}%`,
        top: `${(editorPlacement.centerY / activeSlot.height) * 100}%`,
        transform: `translate(-50%, -50%) rotate(${editorPlacement.rotation}deg)`,
      }
    : undefined

  return (
    <View className='shell'>
      <NavigationBar title='证件材料复印排版' background='var(--s-1-weak, #f5f7fa)' />
      <ScrollView className='page-scroll' scrollY enhanced showScrollbar={false}>
        <View className='page'>
          <View className='tool-intro-card'>
            <Text className='tool-intro-card__title'>身份证正反面、材料图一键排成A4</Text>
            <Text className='tool-intro-card__description'>本地排版生成 JPG 和单页 PDF，可选用途水印，不上传业务服务器。</Text>
          </View>

          <View className='card'>
            <View className='card__head'>
              <Text className='card__title'>排版模式</Text>
              <Text className='card__subtitle'>A4 / 200 DPI</Text>
            </View>
            <View className='chip-row'>
              <View
                className={`chip ${mode === 'id-card' ? 'is-active' : ''} ${isBusy ? 'is-disabled' : ''}`}
                onClick={() => onSwitchMode('id-card')}
              >
                <Text className='chip__title'>身份证正反面</Text>
              </View>
              <View
                className={`chip ${mode === 'materials' ? 'is-active' : ''} ${isBusy ? 'is-disabled' : ''}`}
                onClick={() => onSwitchMode('materials')}
              >
                <Text className='chip__title'>通用材料</Text>
              </View>
            </View>

            <View className='block'>
              <Text className='setting-label'>纸张方向</Text>
              <View className='chip-row'>
                <View
                  className={`chip ${orientation === 'portrait' ? 'is-active' : ''} ${isBusy ? 'is-disabled' : ''}`}
                  onClick={() => onSwitchOrientation('portrait')}
                >
                  <Text className='chip__title'>竖版</Text>
                </View>
                <View
                  className={`chip ${orientation === 'landscape' ? 'is-active' : ''} ${isBusy ? 'is-disabled' : ''}`}
                  onClick={() => onSwitchOrientation('landscape')}
                >
                  <Text className='chip__title'>横版</Text>
                </View>
              </View>
            </View>

            {mode === 'materials' && items.length === 2 ? (
              <View className='block'>
                <Text className='setting-label'>两张布局</Text>
                <View className='chip-row'>
                  <View
                    className={`chip ${pairLayout === 'vertical' ? 'is-active' : ''} ${isBusy ? 'is-disabled' : ''}`}
                    onClick={() => {
                      if (isBusy) return
                      setPairLayout('vertical')
                      invalidateOutputs()
                    }}
                  >
                    <Text className='chip__title'>上下</Text>
                  </View>
                  <View
                    className={`chip ${pairLayout === 'horizontal' ? 'is-active' : ''} ${isBusy ? 'is-disabled' : ''}`}
                    onClick={() => {
                      if (isBusy) return
                      setPairLayout('horizontal')
                      invalidateOutputs()
                    }}
                  >
                    <Text className='chip__title'>左右</Text>
                  </View>
                </View>
              </View>
            ) : null}
          </View>

          <View className='card'>
            <View className='card__head'>
              <View>
                <Text className='card__title'>选择图片</Text>
                <Text className='card__subtitle'>
                  {items.length} / {maxCount} 张
                </Text>
              </View>
              {items.length ? (
                <Text className='text-action' onClick={onClearImages}>
                  清空
                </Text>
              ) : null}
            </View>

            <View className='uploader' onClick={onChooseImages}>
              <View className='upload-icon'>＋</View>
              <View>
                <Text className='upload-title'>{items.length ? '继续添加图片' : '添加证件或材料图'}</Text>
                <Text className='upload-desc'>
                  {mode === 'id-card' ? '需正反面两张，按真实身份证尺寸排版' : '最多 4 张，支持相册或拍照'}
                </Text>
              </View>
            </View>

            {items.length ? (
              <View className='image-list'>
                {items.map((item, index) => (
                  <View
                    key={item.id}
                    className={`image-item ${activeId === item.id ? 'is-active' : ''}`}
                    onClick={() => setActiveId(item.id)}
                  >
                    <Image className='list-thumb' src={item.path} mode='aspectFill' />
                    <View className='preview-meta'>
                      <Text className='preview-title'>{roleLabel(mode, item, index)}</Text>
                      <Text className='preview-desc'>
                        {item.width} × {item.height}
                      </Text>
                    </View>
                    <View className='list-actions'>
                      <Text
                        className={`list-action ${index === 0 ? 'is-disabled' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation?.()
                          moveImage(index, -1)
                        }}
                      >
                        ↑
                      </Text>
                      <Text
                        className={`list-action ${index === items.length - 1 ? 'is-disabled' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation?.()
                          moveImage(index, 1)
                        }}
                      >
                        ↓
                      </Text>
                      <Text
                        className='list-action danger'
                        onClick={(e) => {
                          e.stopPropagation?.()
                          onRemoveImage(index)
                        }}
                      >
                        删
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : null}
          </View>

          {activeItem && activeSlot ? (
            <View className='card'>
              <View className='card__head'>
                <Text className='card__title'>编辑当前图片</Text>
                <Text className='card__subtitle'>拖动定位 / 缩放 / 旋转</Text>
              </View>
              {mode === 'materials' ? (
                <View className='block fit-setting'>
                  <Text className='setting-label'>图片适配</Text>
                  <View className='chip-row'>
                    <View
                      className={`chip ${activeItem.crop.fit === 'contain' ? 'is-active' : ''} ${isBusy ? 'is-disabled' : ''}`}
                      onClick={() => patchActiveCrop((crop) => createDefaultCrop({ fit: 'contain', rotation: crop.rotation }))}
                    >
                      <Text className='chip__title'>完整显示</Text>
                    </View>
                    <View
                      className={`chip ${activeItem.crop.fit === 'cover' ? 'is-active' : ''} ${isBusy ? 'is-disabled' : ''}`}
                      onClick={() => patchActiveCrop((crop) => createDefaultCrop({ fit: 'cover', rotation: crop.rotation }))}
                    >
                      <Text className='chip__title'>铺满裁切</Text>
                    </View>
                  </View>
                </View>
              ) : null}
              <View id='documentCopyEditorHost' className='editor-stage-shell'>
                <View
                  className='editor-stage'
                  style={{ width: `${editorStageSize.width}px`, height: `${editorStageSize.height}px` }}
                  onTouchStart={onEditorTouchStart}
                  onTouchMove={onEditorTouchMove}
                  onTouchEnd={onEditorTouchEnd}
                  onTouchCancel={onEditorTouchEnd}
                >
                  <Image className='editor-image' src={activeItem.path} mode='scaleToFill' style={editorImageStyle as any} />
                </View>
              </View>
              <Text className='editor-hint'>预览与导出使用相同位置；完整显示模式默认保留材料全部内容。</Text>
              <View className='editor-tools'>
                <View className='editor-btn' onClick={() => patchActiveCrop((crop) => zoomCrop(crop, crop.scale + 0.2))}>
                  放大
                </View>
                <View className='editor-btn' onClick={() => patchActiveCrop((crop) => zoomCrop(crop, crop.scale - 0.2))}>
                  缩小
                </View>
                <View className='editor-btn' onClick={() => patchActiveCrop((crop) => rotateCrop(crop, 90))}>
                  旋转 90°
                </View>
                <View className='editor-btn' onClick={() => patchActiveCrop((crop) => resetCrop(crop))}>
                  重置
                </View>
              </View>
            </View>
          ) : null}

          <View className='card'>
            <View className='card__head'>
              <Text className='card__title'>用途水印</Text>
              <Text className='card__subtitle'>默认关闭</Text>
            </View>
            <View className='chip-row'>
              {WATERMARK_PRESETS.map((preset) => (
                <View
                  key={preset.id}
                  className={`chip ${watermarkPresetId === preset.id ? 'is-active' : ''} ${isBusy ? 'is-disabled' : ''}`}
                  onClick={() => {
                    if (isBusy) return
                    setWatermarkPresetId(preset.id)
                    invalidateOutputs()
                  }}
                >
                  <Text className='chip__title'>{preset.title}</Text>
                </View>
              ))}
            </View>
            {watermarkPresetId === 'custom' ? (
              <Input
                className='field-input'
                value={customWatermark}
                maxlength={24}
                placeholder='输入自定义水印文字'
                disabled={isBusy}
                onInput={(e) => {
                  if (isBusy) return
                  setCustomWatermark(e.detail.value)
                  invalidateOutputs()
                }}
              />
            ) : null}
            {watermarkEnabled ? (
              <View className='block'>
                <Text className='setting-label'>透明度</Text>
                <View className='chip-row'>
                  {opacityOptions.map((item) => (
                    <View
                      key={item.id}
                      className={`chip ${opacityId === item.id ? 'is-active' : ''} ${isBusy ? 'is-disabled' : ''}`}
                      onClick={() => {
                        if (isBusy) return
                        setOpacityId(item.id)
                        invalidateOutputs()
                      }}
                    >
                      <Text className='chip__title'>{item.title}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
          </View>

          <View className='card'>
            <View
              className={`primary-btn ${isBusy ? 'is-disabled' : ''}`}
              onClick={onGenerate}
            >
              {generating ? '正在生成…' : outputPath ? '重新生成' : '生成 A4 排版'}
            </View>
          </View>

          <View className='card'>
            <View className='card__head'>
              <Text className='card__title'>生成结果</Text>
              <Text className='card__subtitle'>{resultNote}</Text>
            </View>
            <View className='compare-grid'>
              <View className='compare-item'>
                <Text className='compare-label'>体积</Text>
                <Text className='compare-value'>{outputSize}</Text>
              </View>
              <View className='compare-item'>
                <Text className='compare-label'>尺寸</Text>
                <Text className='compare-value'>{outputDimensions}</Text>
              </View>
            </View>
            {outputPath ? (
              <Image
                className='result-preview'
                src={outputPath}
                mode='widthFix'
                onClick={() => Taro.previewImage({ current: outputPath, urls: [outputPath] })}
              />
            ) : (
              <Text className='result-empty'>生成后可预览大图、保存 JPG，并预览或发送 PDF。</Text>
            )}
            <View className='result-actions'>
              <View
                className={`result-action is-primary ${outputPath && !saving && !isBusy ? 'is-enabled' : ''}`}
                onClick={onSaveImage}
              >
                {busyAction === 'save' ? '保存中…' : '保存图片'}
              </View>
              <View className={`result-action ${outputPath && !pdfGenerating ? 'is-enabled' : ''}`} onClick={onPreviewPdf}>
                {busyAction === 'pdf' ? '生成 PDF…' : '预览 PDF'}
              </View>
              <View className={`result-action ${outputPath && !pdfGenerating ? 'is-enabled' : ''}`} onClick={onSharePdf}>
                发送 PDF
              </View>
            </View>
          </View>

          <Canvas
            type='2d'
            id='documentCopyCanvas'
            canvasId='documentCopyCanvas'
            className='hidden-canvas'
          />
        </View>
      </ScrollView>
    </View>
  )
}
