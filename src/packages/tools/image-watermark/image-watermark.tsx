import { useState } from 'react'
import { Canvas, Image, ScrollView, Text, Textarea, View } from '@tarojs/components'
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
import { normalizeWatermarkText } from './image-watermark.logic'

import './image-watermark.scss'

const MAX_EXPORT_SIDE = 4096

const opacityOptions = [
  { id: 'light', title: '浅', value: 0.12 },
  { id: 'medium', title: '中', value: 0.18 },
  { id: 'strong', title: '深', value: 0.26 },
]

type ImageInfo = { width: number; height: number; size: number }

export default function ImageWatermarkPage() {
  const [opacityId, setOpacityId] = useState('medium')
  const [watermarkText, setWatermarkText] = useState('')
  const [originalPath, setOriginalPath] = useState('')
  const [outputPath, setOutputPath] = useState('')
  const [originalSize, setOriginalSize] = useState('--')
  const [outputSize, setOutputSize] = useState('--')
  const [originalDimensions, setOriginalDimensions] = useState('--')
  const [outputDimensions, setOutputDimensions] = useState('--')
  const [imageInfo, setImageInfo] = useState<ImageInfo | null>(null)
  const [processing, setProcessing] = useState(false)
  const [saving, setSaving] = useState(false)

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

  const getTargetSize = (info: ImageInfo) => {
    const { width, height } = info
    const maxSide = Math.max(width, height)
    if (maxSide <= MAX_EXPORT_SIDE) return { width, height }
    const scale = MAX_EXPORT_SIDE / maxSide
    return {
      width: Math.round(width * scale),
      height: Math.round(height * scale),
    }
  }

  const drawRepeatedWatermark = (
    ctx: CanvasRenderingContext2D,
    target: { width: number; height: number },
    lines: string[],
    opacity: number,
  ) => {
    const fontSize = Math.max(24, Math.round(Math.min(target.width, target.height) * 0.045))
    const lineHeight = Math.round(fontSize * 1.35)
    const blockHeight = lineHeight * lines.length
    const stepX = Math.max(260, Math.round(target.width * 0.42))
    const stepY = Math.max(190, Math.round(target.height * 0.24))

    ctx.save()
    ctx.globalAlpha = opacity
    ctx.fillStyle = '#1f2d35'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = `500 ${fontSize}px sans-serif`
    ctx.rotate(-Math.PI / 6)

    const diagonal = Math.ceil(Math.sqrt(target.width * target.width + target.height * target.height))

    for (let x = -diagonal; x <= diagonal * 1.4; x += stepX) {
      for (let y = -diagonal; y <= diagonal * 1.4; y += stepY) {
        lines.forEach((line, index) => {
          ctx.fillText(line, x, y + index * lineHeight - blockHeight / 2)
        })
      }
    }

    ctx.restore()
  }

  const onGenerate = async () => {
    if (!originalPath || !imageInfo) {
      Taro.showToast({ title: '请先选择图片', icon: 'none' })
      return
    }

    const lines = normalizeWatermarkText(watermarkText)
    if (!lines.length) {
      Taro.showToast({ title: '请填写水印文字', icon: 'none' })
      return
    }

    if (processing) return
    setProcessing(true)

    try {
      const { canvas, ctx } = await getCanvasNode('#watermarkCanvas')
      const image = await loadCanvasImage(canvas, originalPath)
      const target = getTargetSize(imageInfo)
      const opacity =
        opacityOptions.find((item) => item.id === opacityId)?.value || opacityOptions[1].value

      canvas.width = target.width
      canvas.height = target.height
      ctx.clearRect(0, 0, target.width, target.height)
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, target.width, target.height)
      ctx.drawImage(
        image as any,
        0,
        0,
        imageInfo.width,
        imageInfo.height,
        0,
        0,
        target.width,
        target.height,
      )
      drawRepeatedWatermark(ctx, target, lines, opacity)

      const path = await exportCanvasToTempFile(canvas, {
        width: target.width,
        height: target.height,
        fileType: 'jpg',
        quality: 0.96,
      })
      const size = await getFileSize(path)
      setOutputPath(path)
      setOutputSize(formatFileSize(size))
      setOutputDimensions(`${target.width} × ${target.height}`)
    } catch {
      Taro.showToast({ title: '生成失败', icon: 'none' })
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
        permissionText: '打开权限后就能保存加水印后的图片。',
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
    title: '证件照和材料图加用途水印，降低被挪用风险',
    path: '/packages/tools/image-watermark/image-watermark',
  }))

  useShareTimeline(() => ({
    title: '图片加水印工具：给证件和材料图标注用途',
  }))

  return (
    <View className='shell'>
      <NavigationBar title='图片加水印' background='var(--s-1-weak, #f5f7fa)' />
      <ScrollView className='page-scroll' scrollY enhanced showScrollbar={false}>
        <View className='page'>
          <ToolIntroCard
            title='给证件照加用途水印'
            description='办理银行卡、入园登记、租房登记等场景，安全检测后在本地加水印。'
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
                  <Text className='upload-title'>选择一张证件或材料图片</Text>
                  <Text className='upload-desc'>支持从相册选择或直接拍照</Text>
                </View>
              </View>
            )}
          </View>

          <View className='card'>
            <View className='card__head'>
              <Text className='card__title'>水印文字</Text>
              <Text className='card__subtitle'>斜向重复覆盖</Text>
            </View>
            <Textarea
              className='field-textarea'
              value={watermarkText}
              maxlength={48}
              autoHeight
              placeholder='请输入水印文字，最多 3 行'
              onInput={(e) => {
                setWatermarkText(e.detail.value)
                setOutputPath('')
              }}
            />
            <Text className='hint'>例如「仅用于办理银行卡」「他用无效」</Text>

            <View className='block'>
              <Text className='setting-label'>透明度</Text>
              <View className='chip-row'>
                {opacityOptions.map((item) => (
                  <View
                    key={item.id}
                    className={`chip ${opacityId === item.id ? 'is-active' : ''} ${
                      processing ? 'is-disabled' : ''
                    }`}
                    onClick={() => {
                      if (processing) return
                      setOpacityId(item.id)
                      setOutputPath('')
                    }}
                  >
                    <Text className='chip__title'>{item.title}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View
              className={`primary-btn ${processing ? 'is-disabled' : ''}`}
              onClick={onGenerate}
            >
              {processing ? '生成中…' : '生成水印图'}
            </View>
          </View>

          <View className='card'>
            <View className='card__head'>
              <Text className='card__title'>生成结果</Text>
              <Text className='card__subtitle'>{outputPath ? '已生成' : '待生成'}</Text>
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
              <Text className='result-empty'>填写水印并生成后，这里显示预览。</Text>
            )}
            <MediaResultActions
              available={Boolean(outputPath)}
              busy={saving}
              title={outputPath ? '水印图片已生成' : '生成后可以保存到相册'}
              desc='水印图片在本地生成'
              onSave={onSave}
            />
          </View>

          <Canvas
            type='2d'
            id='watermarkCanvas'
            canvasId='watermarkCanvas'
            className='hidden-canvas'
          />
        </View>
      </ScrollView>
    </View>
  )
}
