import { useState } from 'react'
import { ScrollView, Text, Video, View } from '@tarojs/components'
import Taro, { useShareAppMessage, useShareTimeline } from '@tarojs/taro'

import NavigationBar from '@/components/NavigationBar'
import MediaResultActions from '@/packages/tools/components/MediaResultActions'
import ToolIntroCard from '@/packages/tools/components/ToolIntroCard'
import { formatFileSize, getFileSize } from '@/utils/canvas'
import { isDesktopPlatform } from '@/utils/device'
import { ensurePrivacyAuthorize, isSaveCancel, saveVideoToAlbum } from '@/utils/image-save'

import './video-compress.scss'

const qualityOptions = [
  { label: '清晰', value: 'high', desc: '画质优先' },
  { label: '均衡', value: 'medium', desc: '推荐' },
  { label: '更小', value: 'low', desc: '体积优先' },
] as const

const qualityOrder = ['high', 'medium', 'low'] as const

type QualityMode = (typeof qualityOrder)[number]

type VideoInfo = {
  width: number
  height: number
  duration: number
  size: number
}

const kbToBytes = (size: unknown) => {
  const value = Number(size)
  return Number.isFinite(value) && value > 0 ? Math.round(value * 1024) : 0
}

const formatVideoDuration = (duration: number) => {
  const totalSeconds = Math.round(Number(duration) || 0)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes <= 0) return `${seconds} 秒`
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

const formatDimensions = (width?: number, height?: number) => {
  if (!width || !height) return '--'
  return `${Math.round(width)} × ${Math.round(height)}`
}

const getChooseVideoErrorMessage = (error: unknown) => {
  const message = String((error as { errMsg?: string; message?: string })?.errMsg || (error as { message?: string })?.message || '').toLowerCase()
  if (message.includes('cancel')) return ''
  if (
    message.includes('privacy api banned') ||
    message.includes('privacy interface is banned') ||
    message.includes('not declared in the privacy agreement')
  ) return '小程序隐私指引未声明视频选择权限'
  if (message.includes('privacy permission is not authorized') || message.includes('require privacy authorize')) {
    return '请先同意小程序隐私保护指引'
  }
  return '选择视频失败，请重试'
}

export default function VideoCompressPage() {
  const [qualityMode, setQualityMode] = useState<QualityMode>('medium')
  const [originalPath, setOriginalPath] = useState('')
  const [compressedPath, setCompressedPath] = useState('')
  const [originalSize, setOriginalSize] = useState('--')
  const [compressedSize, setCompressedSize] = useState('--')
  const [originalDimensions, setOriginalDimensions] = useState('--')
  const [compressedDimensions, setCompressedDimensions] = useState('--')
  const [durationText, setDurationText] = useState('--')
  const [compressionRatio, setCompressionRatio] = useState('--')
  const [compressionNote, setCompressionNote] = useState('')
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null)
  const [compressing, setCompressing] = useState(false)
  const [saving, setSaving] = useState(false)

  const showDesktopUnsupportedToast = () => {
    Taro.showToast({ title: '请在手机端使用视频压缩', icon: 'none' })
  }

  const getVideoInfo = async (filePath: string) => {
    if (!Taro.getVideoInfo) return {}
    try {
      return await Taro.getVideoInfo({ src: filePath })
    } catch {
      return {}
    }
  }

  const loadVideo = async (
    filePath: string,
    file: { size?: number; width?: number; height?: number; duration?: number } = {},
  ) => {
    try {
      const info = await getVideoInfo(filePath)
      const size = await getFileSize(
        filePath,
        file.size || kbToBytes((info as any).size),
      )
      const width = (info as any).width || file.width || 0
      const height = (info as any).height || file.height || 0
      const duration = (info as any).duration || file.duration || 0

      setOriginalPath(filePath)
      setCompressedPath('')
      setOriginalSize(formatFileSize(size))
      setCompressedSize('--')
      setOriginalDimensions(formatDimensions(width, height))
      setCompressedDimensions('--')
      setDurationText(formatVideoDuration(duration))
      setCompressionRatio('--')
      setCompressionNote('')
      setVideoInfo({ width, height, duration, size })
    } catch {
      Taro.showToast({ title: '读取视频失败', icon: 'none' })
    }
  }

  const chooseVideoByMedia = async () => {
    try {
      const res = await Taro.chooseMedia({
        count: 1,
        mediaType: ['video'],
        sourceType: ['album'],
      })
      const file = res.tempFiles?.[0]
      if (!file?.tempFilePath) return
      await loadVideo(file.tempFilePath, file)
    } catch (error: any) {
      const title = getChooseVideoErrorMessage(error)
      if (title) Taro.showToast({ title, icon: 'none' })
    }
  }

  const chooseVideoFromAlbum = async () => {
    try {
      if (Taro.chooseVideo) {
        const res = await Taro.chooseVideo({
          sourceType: ['album'],
          compressed: false,
        })
        if (!res.tempFilePath) return
        await loadVideo(res.tempFilePath, {
          size: res.size,
          width: res.width,
          height: res.height,
          duration: res.duration,
        })
        return
      }
    } catch (error: any) {
      if (String(error?.errMsg || '').includes('cancel')) return
    }

    await chooseVideoByMedia()
  }

  const onChooseVideo = async () => {
    if (compressing || saving) return
    if (isDesktopPlatform()) {
      showDesktopUnsupportedToast()
      return
    }

    try {
      await ensurePrivacyAuthorize()
      await chooseVideoFromAlbum()
    } catch (error: any) {
      const title = getChooseVideoErrorMessage(error)
      if (title) Taro.showToast({ title, icon: 'none' })
    }
  }

  const getCompressionRatio = (compressedBytes: number) => {
    const original = videoInfo?.size
    if (!original || !compressedBytes) return '--'
    const percent = Math.max(0, Math.round((1 - compressedBytes / original) * 100))
    return percent > 0 ? `节省 ${percent}%` : '体积接近'
  }

  const compressVideoByQuality = async (quality: QualityMode) => {
    const res = await Taro.compressVideo({
      src: originalPath,
      quality,
    } as any)
    const videoPath = res.tempFilePath
    const info = await getVideoInfo(videoPath)
    const size = await getFileSize(videoPath, kbToBytes((res as any).size || (info as any).size))
    return {
      path: videoPath,
      size,
      width: (info as any).width || videoInfo?.width || 0,
      height: (info as any).height || videoInfo?.height || 0,
    }
  }

  const compressBestResult = async () => {
    const originalSizeBytes = videoInfo?.size
    const startIndex = Math.max(qualityOrder.indexOf(qualityMode), 0)
    const qualities = qualityOrder.slice(startIndex)
    let smallestResult: Awaited<ReturnType<typeof compressVideoByQuality>> | null = null

    for (let index = 0; index < qualities.length; index += 1) {
      const result = await compressVideoByQuality(qualities[index])
      if (!smallestResult || result.size < smallestResult.size) {
        smallestResult = result
      }
      if (!originalSizeBytes || result.size < originalSizeBytes) {
        return {
          ...result,
          note: index > 0 ? '所选质量会让体积变大，已自动改用更低质量。' : '',
        }
      }
    }

    if (smallestResult) {
      return {
        ...smallestResult,
        note: '原视频已经足够小，已保留最小的压缩结果，体积可能略有增加。',
      }
    }

    throw new Error('compress failed')
  }

  const onCompress = async () => {
    if (!originalPath) {
      Taro.showToast({ title: '请先选择视频', icon: 'none' })
      return
    }
    if (compressing) return
    if (isDesktopPlatform()) {
      showDesktopUnsupportedToast()
      return
    }

    setCompressing(true)
    try {
      const result = await compressBestResult()
      setCompressedPath(result.path)
      setCompressedSize(formatFileSize(result.size))
      setCompressedDimensions(formatDimensions(result.width, result.height))
      setCompressionRatio(getCompressionRatio(result.size))
      setCompressionNote(result.note || '')
    } catch {
      Taro.showToast({ title: '压缩失败', icon: 'none' })
    } finally {
      setCompressing(false)
    }
  }

  const getSavableVideoPath = async (filePath: string) => {
    const env = (Taro as any).env
    if (!Taro.getFileSystemManager || !env?.USER_DATA_PATH) return filePath

    const fs = Taro.getFileSystemManager()
    const targetPath = `${env.USER_DATA_PATH}/video-compress-output.mp4`

    await new Promise<void>((resolve) => {
      fs.unlink({
        filePath: targetPath,
        complete: () => resolve(),
      })
    })

    await new Promise<void>((resolve, reject) => {
      fs.copyFile({
        srcPath: filePath,
        destPath: targetPath,
        success: () => resolve(),
        fail: reject,
      })
    })

    return targetPath
  }

  const onSave = async () => {
    if (!compressedPath) {
      Taro.showToast({ title: '请先压缩视频', icon: 'none' })
      return
    }
    if (saving) return
    setSaving(true)

    try {
      const savablePath = await getSavableVideoPath(compressedPath)
      await saveVideoToAlbum({
        filePath: savablePath,
        permissionText: '打开权限后就能保存压缩后的视频。',
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
    title: '视频太大不好发？试试本地视频压缩工具',
    path: '/packages/tools/video-compress/video-compress',
  }))

  useShareTimeline(() => ({
    title: '视频压缩工具：把相册视频压小一点再发送',
  }))

  return (
    <View className='shell'>
      <NavigationBar title='视频压缩' background='var(--s-1-weak, #f5f7fa)' />
      <ScrollView className='page-scroll' scrollY enhanced showScrollbar={false}>
        <View className='page'>
          <ToolIntroCard
            title='本地压缩视频体积'
            description='适合发聊天、传资料前，把视频变小一些。'
          />

          <View className='card'>
            <View className='card__head'>
              <Text className='card__title'>选择视频</Text>
              <Text className='card__subtitle'>本地处理</Text>
            </View>

            {originalPath ? (
              <View className={`video-preview ${compressing ? 'is-disabled' : ''}`}>
                <Video
                  className='preview-video'
                  src={originalPath}
                  controls={false}
                  showCenterPlayBtn
                  objectFit='cover'
                />
                <View className='preview-meta'>
                  <Text className='preview-title'>原视频</Text>
                  <Text className='preview-desc'>
                    {originalSize} / {originalDimensions} / {durationText}
                  </Text>
                </View>
                <View className='change-btn' onClick={onChooseVideo}>
                  更换
                </View>
              </View>
            ) : (
              <View className='uploader' onClick={onChooseVideo}>
                <View className='upload-icon'>▶</View>
                <View>
                  <Text className='upload-title'>选择一个视频</Text>
                  <Text className='upload-desc'>支持从相册选择</Text>
                </View>
              </View>
            )}

            {originalPath ? (
              <Text className='hint'>如果这里的大小和相册里不一样，说明手机没有传入原视频。</Text>
            ) : null}
          </View>

          <View className='card'>
            <Text className='card__title'>压缩设置</Text>
            <View className='block'>
              <Text className='setting-label'>压缩质量</Text>
              <View className='chip-row'>
                {qualityOptions.map((item) => (
                  <View
                    key={item.value}
                    className={`option ${qualityMode === item.value ? 'is-active' : ''} ${
                      compressing ? 'is-disabled' : ''
                    }`}
                    onClick={() => {
                      if (compressing) return
                      if (isDesktopPlatform()) {
                        showDesktopUnsupportedToast()
                        return
                      }
                      setQualityMode(item.value)
                      setCompressedPath('')
                      setCompressedSize('--')
                      setCompressedDimensions('--')
                      setCompressionRatio('--')
                      setCompressionNote('')
                    }}
                  >
                    <Text className='option__title'>{item.label}</Text>
                    <Text className='option__desc'>{item.desc}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View
              className={`primary-btn ${compressing ? 'is-disabled' : ''}`}
              onClick={onCompress}
            >
              {compressing ? '压缩中…' : compressedPath ? '重新压缩' : '开始压缩'}
            </View>
          </View>

          <View className='card'>
            <View className='card__head'>
              <View>
                <Text className='card__title'>压缩结果</Text>
                <Text className='compare-value'>{compressedSize}</Text>
              </View>
              <Text className='card__subtitle'>
                {compressedPath ? compressionRatio : '待压缩'}
              </Text>
            </View>

            <View className='compare-grid'>
              <View className='compare-item'>
                <Text className='compare-label'>原视频</Text>
                <Text className='compare-value'>{originalSize}</Text>
                <Text className='compare-sub'>{originalDimensions}</Text>
              </View>
              <View className='compare-item'>
                <Text className='compare-label'>压缩后</Text>
                <Text className='compare-value'>{compressedSize}</Text>
                <Text className='compare-sub'>{compressedDimensions}</Text>
              </View>
            </View>

            {compressedPath ? (
              <Video
                className='result-video'
                src={compressedPath}
                controls
                showCenterPlayBtn
                objectFit='contain'
              />
            ) : (
              <Text className='result-empty'>选择视频并压缩后，这里显示结果。</Text>
            )}

            {compressionNote ? <Text className='hint'>{compressionNote}</Text> : null}

            <MediaResultActions
              available={Boolean(compressedPath)}
              busy={saving}
              title={compressedPath ? '压缩视频已生成' : '生成后可以保存到相册'}
              desc='视频只在本地处理'
              onSave={onSave}
            />
          </View>
        </View>
      </ScrollView>
    </View>
  )
}
