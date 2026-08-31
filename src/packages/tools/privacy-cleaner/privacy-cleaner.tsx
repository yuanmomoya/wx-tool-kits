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
import {
  ImageMetadataScan,
  inspectImageMetadata,
} from '@/utils/image-metadata'
import { createPrivacyReencodePlan } from './privacy-cleaner.logic'

import './privacy-cleaner.scss'

const MAX_EXPORT_SIDE = 4096

type SourceInfo = {
  width: number
  height: number
  size: number
}

const emptyScan: ImageMetadataScan = {
  format: '未知格式',
  items: [],
  metadataBlocks: [],
}

export default function PrivacyCleanerPage() {
  const [originalPath, setOriginalPath] = useState('')
  const [outputPath, setOutputPath] = useState('')
  const [sourceInfo, setSourceInfo] = useState<SourceInfo | null>(null)
  const [scan, setScan] = useState<ImageMetadataScan>(emptyScan)
  const [outputScan, setOutputScan] = useState<ImageMetadataScan>(emptyScan)
  const [scanning, setScanning] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [outputSize, setOutputSize] = useState(0)

  const loadImage = async (filePath: string, knownSize?: number) => {
    setScanning(true)
    setOutputPath('')
    setOutputSize(0)
    setOutputScan(emptyScan)
    try {
      const [info, size] = await Promise.all([
        Taro.getImageInfo({ src: filePath }),
        getFileSize(filePath, knownSize),
      ])
      const result = await inspectImageMetadata(filePath, size)
      setOriginalPath(filePath)
      setSourceInfo({ width: info.width, height: info.height, size })
      setScan(result)
    } catch (error) {
      console.error('[privacy-cleaner] read image failed', error)
      Taro.showToast({ title: '读取图片信息失败', icon: 'none' })
    } finally {
      setScanning(false)
    }
  }

  const onChooseImage = async () => {
    if (scanning || processing || saving) return
    const files = await chooseImages({ count: 1, sourceType: ['album'] })
    const file = files[0]
    if (!file?.tempFilePath) return
    await loadImage(file.tempFilePath, file.size)
  }

  const onClean = async () => {
    if (!originalPath || !sourceInfo) {
      Taro.showToast({ title: '请先选择图片', icon: 'none' })
      return
    }
    if (processing) return
    setProcessing(true)
    try {
      const { canvas, ctx } = await getCanvasNode('#privacyCleanerCanvas')
      const image = await loadCanvasImage(canvas, originalPath)
      const target = createPrivacyReencodePlan(sourceInfo.width, sourceInfo.height, MAX_EXPORT_SIDE, scan.format)
      const fileType = target.fileType

      canvas.width = target.width
      canvas.height = target.height
      ctx.clearRect(0, 0, target.width, target.height)
      if (fileType === 'jpg') {
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, target.width, target.height)
      }
      ctx.drawImage(
        image as any,
        0,
        0,
        sourceInfo.width,
        sourceInfo.height,
        0,
        0,
        target.width,
        target.height,
      )

      const path = await exportCanvasToTempFile(canvas, {
        width: target.width,
        height: target.height,
        fileType,
        quality: 0.97,
      })
      const size = await getFileSize(path)
      const verified = await inspectImageMetadata(path, size)
      setOutputPath(path)
      setOutputSize(size)
      setOutputScan(verified)
      Taro.showToast({
        title: verified.items.length ? '已生成，仍有少量系统信息' : '隐私信息已清除',
        icon: 'none',
      })
    } catch (error) {
      console.error('[privacy-cleaner] clean failed', error)
      Taro.showToast({ title: '清理失败，请换一张图片重试', icon: 'none' })
    } finally {
      setProcessing(false)
    }
  }

  const onSave = async () => {
    if (!outputPath || saving) return
    setSaving(true)
    try {
      await saveImageToAlbum({
        filePath: outputPath,
        permissionText: '打开权限后就能保存清理过隐私信息的图片。',
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
    title: '照片隐私清理：删除位置、设备和拍摄信息',
    path: '/packages/tools/privacy-cleaner/privacy-cleaner',
  }))

  useShareTimeline(() => ({
    title: '发送照片前，先清除位置和拍摄信息',
  }))

  const hasMetadata = scan.items.length > 0
  const busy = scanning || processing || saving

  return (
    <View className='shell'>
      <NavigationBar title='照片隐私清理' background='var(--s-1-weak, #f5f7fa)' />
      <ScrollView className='page-scroll' scrollY enhanced showScrollbar={false}>
        <View className='page'>
          <ToolIntroCard
            title='发送照片前，先清掉隐藏信息'
            description='识别位置、设备、拍摄时间等信息，并在本机生成不带原始元数据的副本。'
          />

          <View className='card'>
            <View className='card__head'>
              <Text className='card__title'>选择照片</Text>
              <Text className='card__subtitle'>相册图片</Text>
            </View>
            {originalPath ? (
              <View className={`preview-row ${busy ? 'is-disabled' : ''}`}>
                <Image className='preview-thumb' src={originalPath} mode='aspectFill' />
                <View className='preview-meta'>
                  <Text className='preview-title'>{scanning ? '正在读取隐藏信息…' : '照片已就绪'}</Text>
                  <Text className='preview-desc'>
                    {formatFileSize(sourceInfo?.size)} / {sourceInfo ? `${sourceInfo.width} × ${sourceInfo.height}` : '--'} / {scan.format}
                  </Text>
                </View>
                <View className='change-btn' onClick={onChooseImage}>更换</View>
              </View>
            ) : (
              <View className={`uploader ${busy ? 'is-disabled' : ''}`} onClick={onChooseImage}>
                <View className='upload-icon'>＋</View>
                <View>
                  <Text className='upload-title'>选择一张照片</Text>
                  <Text className='upload-desc'>仅支持从相册选择</Text>
                </View>
              </View>
            )}
          </View>

          <View className='card'>
            <View className='card__head'>
              <Text className='card__title'>隐私信息检测</Text>
              <Text className='card__subtitle'>
                {!originalPath ? '等待选择' : scanning ? '检测中' : `发现 ${scan.items.length} 项`}
              </Text>
            </View>

            <View className='privacy-summary'>
              <View className='privacy-summary__icon'>{hasMetadata ? '!' : '✓'}</View>
              <View className='privacy-summary__content'>
                <Text className='privacy-summary__title'>
                  {!originalPath
                    ? '选择照片后开始检测'
                    : hasMetadata
                      ? `检测到 ${scan.items.length} 项可清理信息`
                      : '未发现可显示的隐私信息'}
                </Text>
                <Text className='privacy-summary__desc'>
                  {hasMetadata
                    ? `元数据类型：${scan.metadataBlocks.join('、') || '拍摄信息'}`
                    : originalPath
                      ? '部分平台会预先删除元数据；仍可生成干净副本再保存。'
                      : '可检测 EXIF、GPS、XMP、IPTC 和 PNG 文本信息。'}
                </Text>
              </View>
            </View>

            {hasMetadata && (
              <View className='metadata-list'>
                {scan.items.map((item) => (
                  <View className='metadata-row' key={`${item.id}-${item.value}`}>
                    <View className='metadata-copy'>
                      <Text className='metadata-label'>{item.label}</Text>
                      <Text className='metadata-value'>{item.value}</Text>
                    </View>
                    <Text className='metadata-status'>将清除</Text>
                  </View>
                ))}
              </View>
            )}

            <View
              className={`primary-btn ${!originalPath || busy ? 'is-disabled' : ''}`}
              onClick={onClean}
            >
              {processing ? '正在清理…' : hasMetadata ? '清除隐私信息' : '生成干净副本'}
            </View>
            <Text className='hint'>清理会重新编码图片，画面内容不变，文件体积可能略有变化。</Text>
          </View>

          <View className='card'>
            <View className='card__head'>
              <Text className='card__title'>清理结果</Text>
              <Text className='card__subtitle'>{outputPath ? '已生成并复检' : '待清理'}</Text>
            </View>
            <View className='compare-grid'>
              <View className='compare-item'>
                <Text className='compare-label'>原图</Text>
                <Text className='compare-value'>{formatFileSize(sourceInfo?.size)}</Text>
                <Text className='compare-sub'>{scan.items.length ? `${scan.items.length} 项隐私信息` : '未发现可显示信息'}</Text>
              </View>
              <View className='compare-item'>
                <Text className='compare-label'>清理后</Text>
                <Text className='compare-value'>{formatFileSize(outputSize)}</Text>
                <Text className='compare-sub'>{outputPath ? `${outputScan.items.length} 项可识别信息` : '--'}</Text>
              </View>
            </View>
            {outputPath ? (
              <>
                <Image
                  className='result-preview'
                  src={outputPath}
                  mode='aspectFit'
                  onClick={() => Taro.previewImage({ current: outputPath, urls: [outputPath] })}
                />
                <View className='clean-result'>
                  {outputScan.items.length
                    ? '已删除原始元数据；系统重新编码时仍写入了少量信息，请查看复检结果。'
                    : '复检通过：未发现原图中的位置、设备、拍摄时间或描述信息。'}
                </View>
              </>
            ) : (
              <Text className='result-empty'>清理完成后，这里会显示可保存的图片。</Text>
            )}
            <MediaResultActions
              available={Boolean(outputPath)}
              busy={saving}
              title={outputPath ? '干净副本已就绪' : '清理后可以保存到相册'}
              desc='保存的是清理后的副本'
              onSave={onSave}
            />
          </View>

          <Canvas
            type='2d'
            id='privacyCleanerCanvas'
            canvasId='privacyCleanerCanvas'
            className='hidden-canvas'
          />
        </View>
      </ScrollView>
    </View>
  )
}
