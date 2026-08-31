import { useState } from 'react'
import { Canvas, Image, ScrollView, Text, Textarea, View } from '@tarojs/components'
import Taro, { useShareAppMessage, useShareTimeline } from '@tarojs/taro'
import QRCode from 'qrcode'

import NavigationBar from '@/components/NavigationBar'
import MediaResultActions from '@/packages/tools/components/MediaResultActions'
import ToolIntroCard from '@/packages/tools/components/ToolIntroCard'
import {
  CanvasNode,
  exportCanvasToTempFile,
  getCanvasNode,
  loadCanvasImage,
} from '@/utils/canvas'
import { chooseImages } from '@/utils/image-picker'
import { isSaveCancel, saveImageToAlbum } from '@/utils/image-save'
import { ensureTextEncoder, validateQrContent } from './qrcode.logic'

import './qrcode.scss'

const QR_SIZE = 480
const PREVIEW_SIZE = 240
const LOGO_SIZE = 72
const QUIET_ZONE_MODULES = 4

function drawRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const right = x + width
  const bottom = y + height
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.lineTo(right - radius, y)
  ctx.quadraticCurveTo(right, y, right, y + radius)
  ctx.lineTo(right, bottom - radius)
  ctx.quadraticCurveTo(right, bottom, right - radius, bottom)
  ctx.lineTo(x + radius, bottom)
  ctx.quadraticCurveTo(x, bottom, x, bottom - radius)
  ctx.lineTo(x, y + radius)
  ctx.quadraticCurveTo(x, y, x + radius, y)
  ctx.closePath()
}

async function drawQrMatrix(
  canvas: CanvasNode,
  ctx: CanvasRenderingContext2D,
  text: string,
  size: number,
  logoPath?: string,
) {
  ensureTextEncoder()
  const qr = QRCode.create(text, { errorCorrectionLevel: 'H' })
  const modules = qr.modules
  const count = modules.size
  const totalModules = count + QUIET_ZONE_MODULES * 2
  const cell = size / totalModules
  const offset = QUIET_ZONE_MODULES * cell

  canvas.width = size
  canvas.height = size
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, size, size)
  ctx.fillStyle = '#142a25'

  for (let row = 0; row < count; row += 1) {
    for (let col = 0; col < count; col += 1) {
      if (modules.get(row, col)) {
        ctx.fillRect(
          offset + col * cell,
          offset + row * cell,
          Math.ceil(cell),
          Math.ceil(cell),
        )
      }
    }
  }

  if (logoPath) {
    const logo = await loadCanvasImage(canvas, logoPath)
    const logoX = (size - LOGO_SIZE) / 2
    const logoY = (size - LOGO_SIZE) / 2
    const pad = 6
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(logoX - pad, logoY - pad, LOGO_SIZE + pad * 2, LOGO_SIZE + pad * 2)
    ctx.drawImage(logo as any, logoX, logoY, LOGO_SIZE, LOGO_SIZE)
  }
}

export default function QrcodePage() {
  const [inputValue, setInputValue] = useState('')
  const [qrValue, setQrValue] = useState('')
  const [logoPath, setLogoPath] = useState('')
  const [previewPath, setPreviewPath] = useState('')
  const [hasGenerated, setHasGenerated] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)

  const canGenerate = inputValue.trim().length > 0

  const onChooseLogo = async () => {
    const files = await chooseImages({ sizeType: ['compressed'] })
    const file = files[0]
    if (!file?.tempFilePath) return
    setLogoPath(file.tempFilePath)
    if (hasGenerated) {
      setHasGenerated(false)
      setPreviewPath('')
    }
  }

  const onGenerate = async () => {
    const text = inputValue.trim()
    if (!text) {
      Taro.showToast({ title: '请先填写内容', icon: 'none' })
      return
    }
    validateQrContent(text, 500)
    if (generating) return

    setGenerating(true)
    try {
      const { canvas, ctx } = await getCanvasNode('#qrCanvas')
      await drawQrMatrix(canvas, ctx, text, QR_SIZE, logoPath || undefined)
      const path = await exportCanvasToTempFile(canvas, {
        width: QR_SIZE,
        height: QR_SIZE,
        fileType: 'png',
      })
      setQrValue(text)
      setPreviewPath(path)
      setHasGenerated(true)
    } catch (error) {
      console.error('[qrcode] generate failed', error)
      Taro.showToast({ title: '生成失败', icon: 'none' })
    } finally {
      setGenerating(false)
    }
  }

  const composePoster = async (qrPath: string) => {
    const { canvas, ctx } = await getCanvasNode('#posterCanvas')
    const width = 900
    const height = 900
    const qrImage = await loadCanvasImage(canvas, qrPath)

    canvas.width = width
    canvas.height = height
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)

    drawRoundRect(ctx, 90, 90, 720, 720, 42)
    ctx.strokeStyle = '#dfe3e8'
    ctx.lineWidth = 4
    ctx.stroke()
    ctx.drawImage(qrImage as any, 150, 150, 600, 600)

    return exportCanvasToTempFile(canvas, {
      width,
      height,
      fileType: 'png',
    })
  }

  const onSave = async () => {
    if (!hasGenerated || !previewPath) {
      Taro.showToast({ title: '请先生成二维码', icon: 'none' })
      return
    }
    if (saving) return
    setSaving(true)

    try {
      const posterPath = await composePoster(previewPath)
      await saveImageToAlbum({
        filePath: posterPath,
        permissionText: '打开权限后就能保存二维码图片。',
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
    title: '文字或链接快速生成二维码，还能加 logo',
    path: '/packages/tools/qrcode/qrcode',
  }))

  useShareTimeline(() => ({
    title: '二维码生成工具：文字、链接一键转二维码',
  }))

  return (
    <View className='shell'>
      <NavigationBar title='二维码生成' background='var(--s-1-weak, #f5f7fa)' />
      <ScrollView className='page-scroll' scrollY enhanced showScrollbar={false}>
        <View className='page'>
          <ToolIntroCard
            title='把文字变成二维码'
            description='支持文本、链接和带 logo 的分享码。'
          />

          <View className='card'>
            <View className='card__head'>
              <Text className='card__title'>内容</Text>
              <Text className='card__subtitle'>{inputValue.length} 字</Text>
            </View>
            <Textarea
              className='field-textarea'
              value={inputValue}
              maxlength={500}
              placeholder='粘贴文字或链接，马上变成二维码'
              showConfirmBar={false}
              onInput={(e) => {
                setInputValue(e.detail.value || '')
                setHasGenerated(false)
                setPreviewPath('')
              }}
            />
          </View>

          <View className='card'>
            <View className='card__head'>
              <Text className='card__title'>中间 logo</Text>
              <Text className='card__subtitle'>可选</Text>
            </View>
            {logoPath ? (
              <View className='preview-row'>
                <Image className='preview-thumb' src={logoPath} mode='aspectFill' />
                <View className='preview-meta'>
                  <Text className='preview-title'>已添加 logo</Text>
                  <Text className='preview-desc'>生成时会嵌入二维码中心</Text>
                </View>
                <View
                  className='change-btn'
                  onClick={() => {
                    setLogoPath('')
                    setHasGenerated(false)
                    setPreviewPath('')
                  }}
                >
                  移除
                </View>
              </View>
            ) : (
              <View className='uploader' onClick={onChooseLogo}>
                <View className='upload-icon'>＋</View>
                <View>
                  <Text className='upload-title'>上传图片</Text>
                  <Text className='upload-desc'>可从相册选择或拍摄方形图标</Text>
                </View>
              </View>
            )}
          </View>

          <View className='card'>
            <View
              className={`primary-btn ${!canGenerate || generating ? 'is-disabled' : ''}`}
              onClick={onGenerate}
            >
              {generating ? '生成中…' : '生成二维码'}
            </View>
          </View>

          <View className='card'>
            <View className='card__head'>
              <Text className='card__title'>生成结果</Text>
              <Text className='card__subtitle'>{hasGenerated ? '已生成' : '等待生成'}</Text>
            </View>

            <View className='preview-frame'>
              {hasGenerated && previewPath ? (
                <Image
                  className='qr-preview'
                  src={previewPath}
                  mode='aspectFit'
                  style={{ width: `${PREVIEW_SIZE}px`, height: `${PREVIEW_SIZE}px` }}
                />
              ) : (
                <Text className='result-empty'>二维码会出现在这里</Text>
              )}
            </View>

            {qrValue ? <Text className='hint'>内容：{qrValue}</Text> : null}

            <MediaResultActions
              available={hasGenerated && Boolean(previewPath)}
              busy={saving}
              title={hasGenerated ? '二维码图片已生成' : '生成后可以保存到相册'}
              desc={hasGenerated ? '建议扫码测试后再保存' : '支持带 logo 的二维码'}
              onSave={onSave}
            />
          </View>

          <Canvas type='2d' id='qrCanvas' canvasId='qrCanvas' className='hidden-canvas' />
          <Canvas type='2d' id='posterCanvas' canvasId='posterCanvas' className='hidden-canvas' />
        </View>
      </ScrollView>
    </View>
  )
}
