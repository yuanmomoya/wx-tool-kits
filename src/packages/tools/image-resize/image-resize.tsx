import { useMemo, useState } from 'react'
import { Canvas, Image, Input, ScrollView, Text, View } from '@tarojs/components'
import Taro, { useShareAppMessage, useShareTimeline } from '@tarojs/taro'

import NavigationBar from '@/components/NavigationBar'
import MediaResultActions from '@/packages/tools/components/MediaResultActions'
import ToolIntroCard from '@/packages/tools/components/ToolIntroCard'
import {
  exportCanvasToTempFile,
  formatFileSize,
  getCanvasNode,
  getFileSize,
  loadCanvasImage,
} from '@/utils/canvas'
import { chooseImages } from '@/utils/image-picker'
import { isSaveCancel, saveImageToAlbum } from '@/utils/image-save'
import { createResizePlan, normalizeResizeSize } from './image-resize.logic'

import './image-resize.scss'

const MAX_EXPORT_SIDE = 4096
const DEFAULT_CUSTOM = { width: '800', height: '800' }

const sizeTemplates = [
  { id: 'one-inch', title: '一寸照', desc: '295 × 413', width: 295, height: 413 },
  { id: 'two-inch', title: '二寸照', desc: '413 × 579', width: 413, height: 579 },
  { id: 'registration', title: '报名照', desc: '480 × 640', width: 480, height: 640 },
  { id: 'avatar300', title: '头像', desc: '300 × 300', width: 300, height: 300 },
  { id: 'square1080', title: '方图', desc: '1080 × 1080', width: 1080, height: 1080 },
  { id: 'custom', title: '自定义', desc: '手动输入', width: 800, height: 800 },
]

const fitModes = [
  { id: 'cover', title: '居中裁切', desc: '填满尺寸' },
  { id: 'contain', title: '留白适配', desc: '不裁内容' },
  { id: 'stretch', title: '拉伸填充', desc: '强制变形' },
] as const

const exportFormats = [
  { id: 'jpg', title: 'JPG 高清', desc: '体积更稳' },
  { id: 'png', title: 'PNG 无损', desc: '可能更大' },
] as const

type ImageInfo = { width: number; height: number; size: number }

function getCustomSize(width: string, height: string) {
  return normalizeResizeSize(Number(width) || Number(DEFAULT_CUSTOM.width), Number(height) || Number(DEFAULT_CUSTOM.height))
}

export default function ImageResizePage() {
  const [activeTemplateId, setActiveTemplateId] = useState('one-inch')
  const [fitMode, setFitMode] = useState<(typeof fitModes)[number]['id']>('cover')
  const [exportFormat, setExportFormat] = useState<(typeof exportFormats)[number]['id']>('jpg')
  const [customWidth, setCustomWidth] = useState(DEFAULT_CUSTOM.width)
  const [customHeight, setCustomHeight] = useState(DEFAULT_CUSTOM.height)
  const [targetWidth, setTargetWidth] = useState(295)
  const [targetHeight, setTargetHeight] = useState(413)
  const [originalPath, setOriginalPath] = useState('')
  const [outputPath, setOutputPath] = useState('')
  const [originalSize, setOriginalSize] = useState('--')
  const [outputSize, setOutputSize] = useState('--')
  const [originalDimensions, setOriginalDimensions] = useState('--')
  const [outputDimensions, setOutputDimensions] = useState('--')
  const [qualityText, setQualityText] = useState('--')
  const [imageInfo, setImageInfo] = useState<ImageInfo | null>(null)
  const [processing, setProcessing] = useState(false)
  const [saving, setSaving] = useState(false)

  const targetText = useMemo(() => `${targetWidth} × ${targetHeight} px`, [targetWidth, targetHeight])

  const loadImage = async (filePath: string, knownSize?: number) => {
    try {
      const info = await Taro.getImageInfo({ src: filePath })
      const size = await getFileSize(filePath, knownSize)
      setOriginalPath(filePath)
      setOutputPath('')
      setOriginalSize(formatFileSize(size))
      setOutputSize('--')
      setOriginalDimensions(`${info.width} × ${info.height}`)
      setOutputDimensions('--')
      setQualityText('--')
      setImageInfo({ width: info.width, height: info.height, size })
    } catch {
      Taro.showToast({ title: '读取图片失败', icon: 'none' })
    }
  }

  const onChooseImage = async () => {
    if (processing || saving) return
    const files = await chooseImages()
    const file = files[0]
    if (!file?.tempFilePath) return
    await loadImage(file.tempFilePath, file.size)
  }

  const applyTemplate = (id: string) => {
    if (processing) return
    const template = sizeTemplates.find((item) => item.id === id) || sizeTemplates[0]
    const next =
      id === 'custom'
        ? getCustomSize(customWidth, customHeight)
        : { width: template.width, height: template.height }
    setActiveTemplateId(id)
    setTargetWidth(next.width)
    setTargetHeight(next.height)
    setOutputPath('')
    setOutputSize('--')
    setOutputDimensions('--')
    setQualityText('--')
  }

  const setCustomSize = (patch: { customWidth?: string; customHeight?: string }) => {
    const nextWidth = patch.customWidth ?? customWidth
    const nextHeight = patch.customHeight ?? customHeight
    const size = getCustomSize(nextWidth, nextHeight)
    setCustomWidth(nextWidth)
    setCustomHeight(nextHeight)
    setActiveTemplateId('custom')
    setTargetWidth(size.width)
    setTargetHeight(size.height)
    setOutputPath('')
    setOutputSize('--')
    setOutputDimensions('--')
    setQualityText('--')
  }

  const drawImageToTarget = (
    ctx: CanvasRenderingContext2D,
    image: any,
    target: { width: number; height: number },
    source: ImageInfo,
  ) => {
    ctx.clearRect(0, 0, target.width, target.height)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, target.width, target.height)

    const plan = createResizePlan(source.width, source.height, target.width, target.height, fitMode)
    ctx.drawImage(image, plan.sx, plan.sy, plan.sw, plan.sh, plan.dx, plan.dy, plan.dw, plan.dh)
  }

  const onProcess = async () => {
    if (!originalPath || !imageInfo) {
      Taro.showToast({ title: '请先选择图片', icon: 'none' })
      return
    }

    const width = Math.round(Number(targetWidth))
    const height = Math.round(Number(targetHeight))
    if (
      !Number.isFinite(width) ||
      !Number.isFinite(height) ||
      width < 50 ||
      height < 50 ||
      width > MAX_EXPORT_SIDE ||
      height > MAX_EXPORT_SIDE
    ) {
      Taro.showToast({ title: '尺寸范围不太对', icon: 'none' })
      return
    }

    if (processing) return
    setProcessing(true)

    try {
      const { canvas, ctx } = await getCanvasNode('#resizeCanvas')
      const image = await loadCanvasImage(canvas, originalPath)
      const target = { width, height }
      canvas.width = width
      canvas.height = height
      drawImageToTarget(ctx, image, target, imageInfo)

      const fileType = exportFormat === 'png' ? 'png' : 'jpg'
      const path = await exportCanvasToTempFile(canvas, {
        width,
        height,
        fileType,
        quality: 1,
      })
      const size = await getFileSize(path)
      setOutputPath(path)
      setOutputSize(formatFileSize(size))
      setOutputDimensions(`${width} × ${height}`)
      setQualityText(fileType === 'png' ? 'PNG 无损' : 'JPG 高清')
    } catch {
      Taro.showToast({ title: '处理失败', icon: 'none' })
    } finally {
      setProcessing(false)
    }
  }

  const onSave = async () => {
    if (!outputPath) {
      Taro.showToast({ title: '请先生成图片', icon: 'none' })
      return
    }
    if (saving) return
    setSaving(true)
    try {
      await saveImageToAlbum({
        filePath: outputPath,
        permissionText: '打开权限后就能保存调整后的图片。',
      })
      Taro.showToast({ title: '已保存到相册', icon: 'success' })
    } catch (error: any) {
      if (error?.handled || isSaveCancel(error)) return
      Taro.showToast({ title: error?.userMessage || '保存失败', icon: 'none' })
    } finally {
      setSaving(false)
    }
  }

  useShareAppMessage(() => ({
    title: '报名照、头像、材料图，快速调整成指定尺寸',
    path: '/packages/tools/image-resize/image-resize',
  }))

  useShareTimeline(() => ({
    title: '图片改尺寸工具：裁成指定像素和格式',
  }))

  return (
    <View className='shell'>
      <NavigationBar title='图片改尺寸' background='var(--s-1-weak, #f5f7fa)' />
      <ScrollView className='page-scroll' scrollY enhanced showScrollbar={false}>
        <View className='page'>
          <ToolIntroCard
            title='裁成指定尺寸'
            description='报名照、头像、上传材料图，本地处理后保存。'
          />

          <View className='card'>
            <View className='card__head'>
              <Text className='card__title'>选择图片</Text>
              <Text className='card__subtitle'>本地处理</Text>
            </View>
            {originalPath ? (
              <View className={`preview-row ${processing ? 'is-disabled' : ''}`}>
                <Image className='preview-thumb' src={originalPath} mode='aspectFill' />
                <View className='preview-meta'>
                  <Text className='preview-title'>原图已就绪</Text>
                  <Text className='preview-desc'>
                    {originalSize} / {originalDimensions}
                  </Text>
                </View>
                <View className='change-btn' onClick={onChooseImage}>
                  更换
                </View>
              </View>
            ) : (
              <View className='uploader' onClick={onChooseImage}>
                <View className='upload-icon'>＋</View>
                <View>
                  <Text className='upload-title'>选择一张图片</Text>
                  <Text className='upload-desc'>支持从相册选择或直接拍照</Text>
                </View>
              </View>
            )}
          </View>

          <View className='card'>
            <View className='card__head'>
              <Text className='card__title'>输出尺寸</Text>
              <Text className='card__subtitle'>{targetText}</Text>
            </View>

            <View className='chip-row'>
              {sizeTemplates.map((item) => (
                <View
                  key={item.id}
                  className={`option ${activeTemplateId === item.id ? 'is-active' : ''} ${
                    processing ? 'is-disabled' : ''
                  }`}
                  onClick={() => applyTemplate(item.id)}
                >
                  <Text className='option__title'>{item.title}</Text>
                  <Text className='option__desc'>{item.desc}</Text>
                </View>
              ))}
            </View>

            {activeTemplateId === 'custom' ? (
              <View className='custom-size-row'>
                <View className='custom-field'>
                  <Text className='setting-label'>宽度</Text>
                  <Input
                    className='field-input'
                    type='number'
                    value={customWidth}
                    onInput={(e) => setCustomSize({ customWidth: e.detail.value })}
                  />
                </View>
                <View className='custom-field'>
                  <Text className='setting-label'>高度</Text>
                  <Input
                    className='field-input'
                    type='number'
                    value={customHeight}
                    onInput={(e) => setCustomSize({ customHeight: e.detail.value })}
                  />
                </View>
              </View>
            ) : null}

            <View className='block'>
              <Text className='setting-label'>适配方式</Text>
              <View className='chip-row'>
                {fitModes.map((item) => (
                  <View
                    key={item.id}
                    className={`option ${fitMode === item.id ? 'is-active' : ''} ${
                      processing ? 'is-disabled' : ''
                    }`}
                    onClick={() => {
                      if (processing) return
                      setFitMode(item.id)
                      setOutputPath('')
                    }}
                  >
                    <Text className='option__title'>{item.title}</Text>
                    <Text className='option__desc'>{item.desc}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View className='block'>
              <Text className='setting-label'>导出格式</Text>
              <View className='chip-row'>
                {exportFormats.map((item) => (
                  <View
                    key={item.id}
                    className={`option ${exportFormat === item.id ? 'is-active' : ''} ${
                      processing ? 'is-disabled' : ''
                    }`}
                    onClick={() => {
                      if (processing) return
                      setExportFormat(item.id)
                      setOutputPath('')
                    }}
                  >
                    <Text className='option__title'>{item.title}</Text>
                    <Text className='option__desc'>{item.desc}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View
              className={`primary-btn ${processing ? 'is-disabled' : ''}`}
              onClick={onProcess}
            >
              {processing ? '处理中…' : '生成图片'}
            </View>
          </View>

          <View className='card'>
            <View className='card__head'>
              <Text className='card__title'>处理结果</Text>
              <Text className='card__subtitle'>{outputPath ? qualityText : '待生成'}</Text>
            </View>
            <View className='compare-grid'>
              <View className='compare-item'>
                <Text className='compare-label'>原图</Text>
                <Text className='compare-value'>{originalSize}</Text>
                <Text className='compare-sub'>{originalDimensions}</Text>
              </View>
              <View className='compare-item'>
                <Text className='compare-label'>输出</Text>
                <Text className='compare-value'>{outputSize}</Text>
                <Text className='compare-sub'>{outputDimensions}</Text>
              </View>
            </View>
            {outputPath ? (
              <Image
                className='result-preview'
                src={outputPath}
                mode='aspectFit'
                onClick={() =>
                  Taro.previewImage({ current: outputPath, urls: [outputPath] })
                }
              />
            ) : (
              <Text className='result-empty'>选择图片并生成后，这里显示预览。</Text>
            )}
            <MediaResultActions
              available={Boolean(outputPath)}
              busy={saving}
              title={outputPath ? '尺寸图片已生成' : '生成后可以保存到相册'}
              desc='尺寸图片在本地生成'
              onSave={onSave}
            />
          </View>

          <Canvas type='2d' id='resizeCanvas' canvasId='resizeCanvas' className='hidden-canvas' />
        </View>
      </ScrollView>
    </View>
  )
}
