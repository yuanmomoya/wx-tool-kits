import { useMemo, useState } from 'react'
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
import { ensureAlbumPermission, isSaveCancel, saveImageToAlbum } from '@/utils/image-save'
import { getSquareCrop, type CropMode } from './nine-grid.logic'

import './nine-grid.scss'

const MAX_EXPORT_SIZE = 3072

type ImageInfo = { width: number; height: number; size: number }
type CropOption = { label: string; value: string; desc: string }
type Tile = { id: string; index: number; path: string; label: string }

const createCropOptions = (imageInfo: ImageInfo | null): CropOption[] => {
  if (!imageInfo) return []
  const { width, height } = imageInfo
  if (width === height) return [{ label: '原图', value: 'center', desc: '已是正方形' }]
  if (height > width) {
    return [
      { label: '顶部', value: 'top', desc: '保留上半部分' },
      { label: '居中', value: 'center', desc: '推荐' },
      { label: '底部', value: 'bottom', desc: '保留下半部分' },
    ]
  }
  return [
    { label: '左侧', value: 'left', desc: '保留左半部分' },
    { label: '居中', value: 'center', desc: '推荐' },
    { label: '右侧', value: 'right', desc: '保留右半部分' },
  ]
}

const getCropRect = (imageInfo: ImageInfo | null, cropMode: string) => {
  if (!imageInfo) return { x: 0, y: 0, size: 0 }
  return getSquareCrop(imageInfo.width, imageInfo.height, cropMode as CropMode)
}

const getPreviewStyle = (imageInfo: ImageInfo | null, cropMode: string) => {
  if (!imageInfo) return ''
  const { width, height } = imageInfo
  const cropRect = getCropRect(imageInfo, cropMode)
  const imageWidthPercent = (width / cropRect.size) * 100
  const imageHeightPercent = (height / cropRect.size) * 100
  const leftPercent = (-cropRect.x / cropRect.size) * 100
  const topPercent = (-cropRect.y / cropRect.size) * 100
  return [
    `width:${imageWidthPercent.toFixed(3)}%`,
    `height:${imageHeightPercent.toFixed(3)}%`,
    `left:${leftPercent.toFixed(3)}%`,
    `top:${topPercent.toFixed(3)}%`,
  ].join(';')
}

const getCropMetaText = (imageInfo: ImageInfo | null, cropOptions: CropOption[], cropMode: string) => {
  if (!imageInfo) return ''
  const cropRect = getCropRect(imageInfo, cropMode)
  const option = cropOptions.find((item) => item.value === cropMode)
  const label = option ? option.label : '居中'
  if (imageInfo.width === imageInfo.height) {
    return `原图 ${imageInfo.width} × ${imageInfo.height}，将直接切成 9 张方图`
  }
  return `${label}裁切 ${cropRect.size} × ${cropRect.size}，按 1-9 顺序输出`
}

export default function NineGridPage() {
  const [cropMode, setCropMode] = useState('center')
  const [originalPath, setOriginalPath] = useState('')
  const [originalSize, setOriginalSize] = useState('--')
  const [originalDimensions, setOriginalDimensions] = useState('--')
  const [generatedTileSize, setGeneratedTileSize] = useState('--')
  const [imageInfo, setImageInfo] = useState<ImageInfo | null>(null)
  const [tiles, setTiles] = useState<Tile[]>([])
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveProgressText, setSaveProgressText] = useState('')

  const cropOptions = useMemo(() => createCropOptions(imageInfo), [imageInfo])
  const cropPreviewStyle = useMemo(() => getPreviewStyle(imageInfo, cropMode), [imageInfo, cropMode])
  const cropMetaText = useMemo(
    () => getCropMetaText(imageInfo, cropOptions, cropMode),
    [imageInfo, cropOptions, cropMode],
  )

  const loadImage = async (filePath: string, knownSize?: number) => {
    try {
      const info = await Taro.getImageInfo({ src: filePath })
      const size = await getFileSize(filePath, knownSize)
      const nextInfo = { width: info.width, height: info.height, size }
      const options = createCropOptions(nextInfo)
      const nextMode = options[1] ? options[1].value : options[0].value
      setOriginalPath(filePath)
      setOriginalSize(formatFileSize(size))
      setOriginalDimensions(`${info.width} × ${info.height}`)
      setImageInfo(nextInfo)
      setCropMode(nextMode)
      setGeneratedTileSize('--')
      setTiles([])
    } catch {
      Taro.showToast({ title: '读取图片失败', icon: 'none' })
    }
  }

  const onChooseImage = async () => {
    if (generating || saving) return
    const files = await chooseImages()
    const file = files[0]
    if (!file?.tempFilePath) return
    await loadImage(file.tempFilePath, file.size)
  }

  const onGenerate = async () => {
    if (!originalPath || !imageInfo) {
      Taro.showToast({ title: '请先选择图片', icon: 'none' })
      return
    }
    if (generating) return
    setGenerating(true)

    try {
      const cropRect = getCropRect(imageInfo, cropMode)
      const tileSize = Math.max(300, Math.floor(Math.min(cropRect.size, MAX_EXPORT_SIZE) / 3))
      const { canvas, ctx } = await getCanvasNode('#splitCanvas')
      const image = await loadCanvasImage(canvas, originalPath)
      const nextTiles: Tile[] = []

      for (let index = 0; index < 9; index += 1) {
        const row = Math.floor(index / 3)
        const column = index % 3
        const sourceTileSize = cropRect.size / 3
        const sourceX = cropRect.x + column * sourceTileSize
        const sourceY = cropRect.y + row * sourceTileSize

        canvas.width = tileSize
        canvas.height = tileSize
        ctx.clearRect(0, 0, tileSize, tileSize)
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, tileSize, tileSize)
        ctx.drawImage(
          image as any,
          sourceX,
          sourceY,
          sourceTileSize,
          sourceTileSize,
          0,
          0,
          tileSize,
          tileSize,
        )

        const path = await exportCanvasToTempFile(canvas, {
          width: tileSize,
          height: tileSize,
          fileType: 'jpg',
          quality: 0.92,
        })
        nextTiles.push({
          id: `tile_${index + 1}`,
          index: index + 1,
          path,
          label: `${index + 1}`,
        })
      }

      setTiles(nextTiles)
      setGeneratedTileSize(`${tileSize} × ${tileSize}`)
    } catch {
      Taro.showToast({ title: '切图失败', icon: 'none' })
    } finally {
      setGenerating(false)
    }
  }

  const onPreviewTile = (path: string) => {
    const urls = tiles.map((item) => item.path)
    if (!path || !urls.length) return
    Taro.previewImage({ current: path, urls })
  }

  const onSaveAll = async () => {
    if (!tiles.length) {
      Taro.showToast({ title: '请先生成切图', icon: 'none' })
      return
    }
    if (saving) return

    setSaving(true)
    setSaveProgressText(`1/${tiles.length}`)

    try {
      await ensureAlbumPermission('打开权限后，就能把 9 张切图一次保存到相册。')
      for (let index = 0; index < tiles.length; index += 1) {
        setSaveProgressText(`${index + 1}/${tiles.length}`)
        try {
          await saveImageToAlbum({
            filePath: tiles[index].path,
            permissionText: '打开权限后，就能把 9 张切图一次保存到相册。',
          })
        } catch (error: any) {
          throw { error, index, handled: error?.handled }
        }
      }
      Taro.showToast({ title: '9 张已保存到相册', icon: 'success' })
    } catch (payload: any) {
      if (payload?.handled) return
      const error = payload?.error || payload
      const failedIndex = typeof payload?.index === 'number' ? payload.index + 1 : 0
      if (isSaveCancel(error)) return
      Taro.showToast({
        title: error?.userMessage || (failedIndex ? `第 ${failedIndex} 张保存失败` : '保存失败'),
        icon: 'none',
      })
    } finally {
      setSaving(false)
      setSaveProgressText('')
    }
  }

  useShareAppMessage(() => ({
    title: '把一张图切成朋友圈九宫格，发图更方便',
    path: '/packages/tools/nine-grid/nine-grid',
  }))

  useShareTimeline(() => ({
    title: '九宫格切图工具：一键生成朋友圈 9 张图',
  }))

  return (
    <View className='shell'>
      <NavigationBar title='九宫格切图' background='var(--s-1-weak, #f5f7fa)' />
      <ScrollView className='page-scroll' scrollY enhanced showScrollbar={false}>
        <View className='page'>
          <ToolIntroCard
            title='一张图切成 9 张朋友圈方图'
            description='选图先进行内容安全检测，九宫格在本地生成后可按顺序保存。'
          />

          <View className='card'>
            <View className='card__head'>
              <Text className='card__title'>选择图片</Text>
              <Text className='card__subtitle'>输出 JPG</Text>
            </View>
            {originalPath ? (
              <View className={`preview-row ${generating ? 'is-disabled' : ''}`}>
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
              <Text className='card__title'>裁切预览</Text>
              <Text className='card__subtitle'>3 × 3</Text>
            </View>

            {originalPath ? (
              <>
                <View className='chip-row'>
                  {cropOptions.map((item) => (
                    <View
                      key={item.value}
                      className={`option ${cropMode === item.value ? 'is-active' : ''} ${
                        generating ? 'is-disabled' : ''
                      }`}
                      onClick={() => {
                        if (generating) return
                        setCropMode(item.value)
                        setTiles([])
                        setGeneratedTileSize('--')
                      }}
                    >
                      <Text className='option__title'>{item.label}</Text>
                      <Text className='option__desc'>{item.desc}</Text>
                    </View>
                  ))}
                </View>

                <View className='preview-box'>
                  <Image
                    className='crop-preview-image'
                    src={originalPath}
                    style={cropPreviewStyle}
                    mode='scaleToFill'
                  />
                  <View className='grid-line vertical line-1' />
                  <View className='grid-line vertical line-2' />
                  <View className='grid-line horizontal line-1' />
                  <View className='grid-line horizontal line-2' />
                </View>

                <Text className='hint'>{cropMetaText}</Text>

                <View
                  className={`primary-btn ${generating ? 'is-disabled' : ''}`}
                  onClick={onGenerate}
                >
                  {generating ? '切图中…' : tiles.length ? '重新切图' : '生成九宫格'}
                </View>
              </>
            ) : (
              <Text className='result-empty'>选择图片后可预览裁切区域。</Text>
            )}
          </View>

          <View className='card'>
            <View className='card__head'>
              <Text className='card__title'>切图结果</Text>
              <Text className='card__subtitle'>
                {tiles.length ? generatedTileSize : '待生成'}
              </Text>
            </View>

            {tiles.length ? (
              <View className='tile-grid'>
                {tiles.map((tile) => (
                  <View key={tile.id} className='tile-item' onClick={() => onPreviewTile(tile.path)}>
                    <Image className='tile-image' src={tile.path} mode='aspectFill' />
                    <Text className='tile-label'>{tile.label}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text className='result-empty'>生成后按 1-9 顺序显示九张方图。</Text>
            )}

            <MediaResultActions
              available={Boolean(tiles.length)}
              busy={saving}
              title={
                tiles.length
                  ? saving
                    ? `保存中 ${saveProgressText}`
                    : '9 张切图已生成'
                  : '生成后可以保存到相册'
              }
              desc='可按 1-9 顺序一次保存到相册'
              onSave={onSaveAll}
            />
          </View>

          <Canvas type='2d' id='splitCanvas' canvasId='splitCanvas' className='hidden-canvas' />
        </View>
      </ScrollView>
    </View>
  )
}
