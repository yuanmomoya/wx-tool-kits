import { useState } from 'react'
import { Canvas, Image, ScrollView, Text, View } from '@tarojs/components'
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
import { createLongImagePlan } from './long-image.logic'

import './long-image.scss'

const MAX_IMAGE_COUNT = 9
const MAX_EXPORT_WIDTH = 1440
const MAX_EXPORT_HEIGHT = 16000
const MIN_EXPORT_WIDTH = 480

type LongImageItem = {
  id: string
  path: string
  width: number
  height: number
  size: number
  sizeText: string
  dimensionText: string
}

export default function LongImagePage() {
  const [images, setImages] = useState<LongImageItem[]>([])
  const [outputPath, setOutputPath] = useState('')
  const [outputSize, setOutputSize] = useState('--')
  const [outputDimensions, setOutputDimensions] = useState('--')
  const [resultNote, setResultNote] = useState('等待生成')
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)

  const loadImage = async (filePath: string, knownSize?: number): Promise<LongImageItem> => {
    const info = await Taro.getImageInfo({ src: filePath })
    const size = await getFileSize(filePath, knownSize)
    return {
      id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
      path: filePath,
      width: info.width,
      height: info.height,
      size,
      sizeText: formatFileSize(size),
      dimensionText: `${info.width} x ${info.height}`,
    }
  }

  const onChooseImages = async () => {
    if (generating || saving) return
    const remainCount = MAX_IMAGE_COUNT - images.length
    if (remainCount <= 0) {
      Taro.showToast({ title: `最多选择 ${MAX_IMAGE_COUNT} 张`, icon: 'none' })
      return
    }

    const files = await chooseImages({ count: Math.min(remainCount, 9) })
    if (!files.length) return

    try {
      const items = await Promise.all(files.map((file) => loadImage(file.tempFilePath, file.size)))
      const next = images.concat(items)
      setImages(next)
      setOutputPath('')
      setOutputSize('--')
      setOutputDimensions('--')
      setResultNote(next.length >= 2 ? '可生成长图' : '至少需要 2 张图片')
    } catch {
      Taro.showToast({ title: '读取图片失败', icon: 'none' })
    }
  }

  const moveImage = (index: number, offset: number) => {
    if (generating) return
    const to = index + offset
    if (index < 0 || to < 0 || index >= images.length || to >= images.length) return
    const next = images.slice()
    const current = next[index]
    next[index] = next[to]
    next[to] = current
    setImages(next)
    setOutputPath('')
  }

  const onRemoveImage = (index: number) => {
    if (generating) return
    const next = images.filter((_, i) => i !== index)
    setImages(next)
    setOutputPath('')
    setOutputSize('--')
    setOutputDimensions('--')
    setResultNote(next.length >= 2 ? '可生成长图' : next.length ? '至少需要 2 张图片' : '等待生成')
  }

  const onClearImages = () => {
    if (generating || saving) return
    setImages([])
    setOutputPath('')
    setOutputSize('--')
    setOutputDimensions('--')
    setResultNote('等待生成')
  }

  const createRenderPlan = (list: LongImageItem[]) => {
    try {
      const first = list[0]
      const baseWidth = Math.min(Math.max(first.width, MIN_EXPORT_WIDTH), MAX_EXPORT_WIDTH)
      const plan = createLongImagePlan(list, baseWidth, MAX_EXPORT_HEIGHT, MIN_EXPORT_WIDTH)
      return {
        width: plan.width,
        height: plan.height,
        scaled: plan.width < baseWidth,
        items: plan.draws.map((draw) => ({
          image: list[draw.index],
          sourceY: 0,
          sourceHeight: list[draw.index].height,
          drawY: draw.y,
          drawHeight: draw.height,
        })),
      }
    } catch {
      return null
    }
  }

  const onGenerate = async () => {
    if (images.length < 2) {
      Taro.showToast({ title: '请至少选择 2 张图片', icon: 'none' })
      return
    }
    if (generating) return

    setGenerating(true)
    setResultNote('正在拼接')

    try {
      const plan = createRenderPlan(images)
      if (!plan) {
        throw { userMessage: '图片太长，请减少图片或裁掉重叠区域' }
      }

      const { canvas, ctx } = await getCanvasNode('#stitchCanvas')
      canvas.width = plan.width
      canvas.height = plan.height
      ctx.clearRect(0, 0, plan.width, plan.height)
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, plan.width, plan.height)

      for (const item of plan.items) {
        const image = await loadCanvasImage(canvas, item.image.path)
        ctx.drawImage(
          image as any,
          0,
          item.sourceY,
          item.image.width,
          item.sourceHeight,
          0,
          item.drawY,
          canvas.width,
          item.drawHeight,
        )
      }

      const path = await exportCanvasToTempFile(canvas, {
        width: plan.width,
        height: plan.height,
        fileType: 'jpg',
        quality: 0.92,
      })
      const size = await getFileSize(path)
      setOutputPath(path)
      setOutputSize(formatFileSize(size))
      setOutputDimensions(`${plan.width} x ${plan.height}`)
      setResultNote(plan.scaled ? '已自动压缩到可导出尺寸' : '已生成长图')
    } catch (error: any) {
      setResultNote('生成失败')
      Taro.showToast({ title: error?.userMessage || '拼接失败', icon: 'none' })
    } finally {
      setGenerating(false)
    }
  }

  const onSave = async () => {
    if (!outputPath) {
      Taro.showToast({ title: '请先生成长图', icon: 'none' })
      return
    }
    if (saving) return
    setSaving(true)
    try {
      await saveImageToAlbum({
        filePath: outputPath,
        permissionText: '打开权限后，就能把拼接后的长图保存到相册。',
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
    title: '把多张截图拼成一张长图，聊天记录和订单截图更好保存',
    path: '/packages/tools/long-image/long-image',
  }))

  useShareTimeline(() => ({
    title: '长图拼接工具：多张截图合成一张长图',
  }))

  return (
    <View className='shell'>
      <NavigationBar title='长图拼接' background='var(--s-1-weak, #f5f7fa)' />
      <ScrollView className='page-scroll' scrollY enhanced showScrollbar={false}>
        <View className='page'>
          <ToolIntroCard
            title='多张截图合成一张长图'
            description='适合手动分段截图，选图通过安全检测后在本地拼接。'
          />

          <View className='card'>
            <View className='card__head'>
              <View>
                <Text className='card__title'>选择截图</Text>
                <Text className='card__subtitle'>
                  {images.length} / {MAX_IMAGE_COUNT} 张
                </Text>
              </View>
              {images.length ? (
                <Text className='text-action' onClick={onClearImages}>
                  清空
                </Text>
              ) : null}
            </View>

            <View className='uploader' onClick={onChooseImages}>
              <View className='upload-icon'>＋</View>
              <View>
                <Text className='upload-title'>{images.length ? '继续添加图片' : '选择多张截图'}</Text>
                <Text className='upload-desc'>从相册选择或直接拍照，按顺序拼接，最多 9 张</Text>
              </View>
            </View>

            {images.length ? (
              <View className='image-list'>
                {images.map((item, index) => (
                  <View key={item.id} className='image-item'>
                    <Image className='list-thumb' src={item.path} mode='aspectFill' />
                    <View className='preview-meta'>
                      <Text className='preview-title'>第 {index + 1} 张</Text>
                      <Text className='preview-desc'>
                        {item.dimensionText} / {item.sizeText}
                      </Text>
                    </View>
                    <View className='list-actions'>
                      <Text
                        className={`list-action ${index === 0 ? 'is-disabled' : ''}`}
                        onClick={() => moveImage(index, -1)}
                      >
                        ↑
                      </Text>
                      <Text
                        className={`list-action ${index === images.length - 1 ? 'is-disabled' : ''}`}
                        onClick={() => moveImage(index, 1)}
                      >
                        ↓
                      </Text>
                      <Text className='list-action danger' onClick={() => onRemoveImage(index)}>
                        删
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : null}
          </View>

          <View className='card'>
            <View
              className={`primary-btn ${generating ? 'is-disabled' : ''}`}
              onClick={onGenerate}
            >
              {generating ? '正在生成…' : outputPath ? '重新生成长图' : '生成长图'}
            </View>
          </View>

          <View className='card'>
            <View className='card__head'>
              <Text className='card__title'>拼接结果</Text>
              <Text className='card__subtitle'>{resultNote}</Text>
            </View>
            <View className='compare-grid'>
              <View className='compare-item'>
                <Text className='compare-label'>体积</Text>
                <Text className='compare-value'>{outputSize}</Text>
              </View>
              <View className='compare-item'>
                <Text className='compare-label'>尺寸</Text>
                <Text className='compare-value dim'>{outputDimensions}</Text>
              </View>
            </View>
            {outputPath ? (
              <Image
                className='result-preview'
                src={outputPath}
                mode='widthFix'
                onClick={() =>
                  Taro.previewImage({ current: outputPath, urls: [outputPath] })
                }
              />
            ) : (
              <Text className='result-empty'>至少两张图即可生成长图。</Text>
            )}
            <MediaResultActions
              available={Boolean(outputPath)}
              busy={saving}
              title={outputPath ? '长图已生成' : '生成后可以保存到相册'}
              desc='长图只在本地生成'
              onSave={onSave}
            />
          </View>

          <Canvas type='2d' id='stitchCanvas' canvasId='stitchCanvas' className='hidden-canvas' />
        </View>
      </ScrollView>
    </View>
  )
}
