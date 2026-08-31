/**
 * 图片压缩：算法复用 localCompress（对齐 miniapp-local），UI 扁平卡片。
 */
import { useMemo, useRef, useState } from 'react'
import { Canvas, Image, Input, ScrollView, Slider, Text, View } from '@tarojs/components'
import Taro, { useShareAppMessage, useShareTimeline } from '@tarojs/taro'

import NavigationBar from '@/components/NavigationBar'
import MediaResultActions from '@/packages/tools/components/MediaResultActions'
import ToolIntroCard from '@/packages/tools/components/ToolIntroCard'
import { CompressCancelledError, localCompress } from '@/services/localCompress'
import {
  CompressJob,
  CompressParams,
  DEFAULT_PARAMS,
  LocalImage,
  OUTPUT_FORMATS,
  SCALE_PRESETS,
  SizeUnit,
  SUPPORTED_INPUT,
  TARGET_PRESETS,
} from '@/types/compress'
import { formatFileSize } from '@/utils/canvas'
import { formatBytes, formatDuration, guessFormat } from '@/utils/format'
import { chooseImages } from '@/utils/image-picker'
import { isSaveCancel, saveImageToAlbum } from '@/utils/image-save'

import './image-compress.scss'

function presetToTarget(presetKb: number): { target_size_value: number; target_size_unit: SizeUnit } {
  if (presetKb >= 1024) return { target_size_value: 1, target_size_unit: 'MB' }
  return { target_size_value: presetKb, target_size_unit: 'KB' }
}

function targetToBytes(value: number, unit: SizeUnit): number {
  return unit === 'MB' ? value * 1024 * 1024 : value * 1024
}

async function toLocalImage(path: string, size: number, width?: number, height?: number): Promise<LocalImage | null> {
  if (size > 50 * 1024 * 1024) {
    Taro.showToast({ title: '图片超过 50MB，请选择更小的文件', icon: 'none' })
    return null
  }

  let w = width
  let h = height
  let typeHint = ''
  try {
    const info = await Taro.getImageInfo({ src: path })
    w = info.width
    h = info.height
    typeHint = info.type || ''
  } catch {
    // ignore
  }

  const name = path.split('/').pop() || `image_${Date.now()}.jpg`
  const fromName = (guessFormat(name) || '').toLowerCase().replace(/^jpeg$/, 'jpg')
  const fromType = typeHint.toLowerCase().replace(/^jpeg$/, 'jpg')
  const format = SUPPORTED_INPUT.has(fromName)
    ? fromName
    : SUPPORTED_INPUT.has(fromType)
      ? fromType
      : ''
  if (!format) {
    Taro.showToast({ title: '仅支持 JPG、PNG', icon: 'none' })
    return null
  }

  return {
    path,
    size,
    name,
    width: w,
    height: h,
    format: format === 'png' ? 'PNG' : 'JPG',
  }
}

export default function ImageCompressPage() {
  const [image, setImage] = useState<LocalImage | null>(null)
  const [params, setParams] = useState<CompressParams>({
    ...DEFAULT_PARAMS,
    mode: 'quality',
    quality: 75,
  })
  const [targetSource, setTargetSource] = useState<'preset' | 'custom'>('preset')
  const [presetKb, setPresetKb] = useState(200)
  const [customValue, setCustomValue] = useState('')
  const [customUnit, setCustomUnit] = useState<SizeUnit>('KB')
  const [busy, setBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const [job, setJob] = useState<CompressJob | null>(null)
  const [resultPath, setResultPath] = useState('')
  const cancelRef = useRef({ cancelled: false })
  const runIdRef = useRef(0)

  const resolvedTarget = useMemo(() => {
    if (targetSource === 'preset') return presetToTarget(presetKb)
    const n = Number(customValue)
    return {
      target_size_value: Number.isFinite(n) ? n : 0,
      target_size_unit: customUnit,
    }
  }, [targetSource, presetKb, customValue, customUnit])

  const targetBytes = useMemo(
    () => targetToBytes(resolvedTarget.target_size_value, resolvedTarget.target_size_unit),
    [resolvedTarget],
  )

  const targetInvalid =
    params.mode === 'target_size' &&
    (!(resolvedTarget.target_size_value > 0) ||
      targetBytes < 5 * 1024 ||
      (!!image && targetBytes >= image.size))
  const sizeInvalid =
    params.size_mode === 'custom' &&
    !(Number(params.custom_width) > 0 || Number(params.custom_height) > 0)

  const canCompress = !!image && !busy && !targetInvalid && !sizeInvalid

  const invalidateResult = () => {
    setJob(null)
    setResultPath('')
  }

  const patch = (partial: Partial<CompressParams>) => {
    setParams((prev) => ({ ...prev, ...partial }))
    invalidateResult()
  }

  const onPick = async () => {
    if (busy) return
    const files = await chooseImages()
    const file = files[0]
    if (!file?.tempFilePath) return

    const next = await toLocalImage(file.tempFilePath, file.size, file.width, file.height)
    if (!next) return
    setImage(next)
    setJob(null)
    setResultPath('')
  }

  const onCompress = async () => {
    if (!image || !canCompress) return

    const runId = runIdRef.current + 1
    runIdRef.current = runId
    cancelRef.current = { cancelled: false }
    const signal = cancelRef.current
    setBusy(true)
    setResultPath('')
    setJob({
      status: 'processing',
      progress: 0,
      step_label: '准备中',
      warnings: [],
    })

    try {
      const submitParams: CompressParams = {
        ...params,
        ...(params.mode === 'target_size' ? resolvedTarget : {}),
      }

      const result = await localCompress(image, submitParams, {
        signal,
        onProgress: (progress, stepLabel) => {
          if (signal.cancelled || runIdRef.current !== runId) return
          setJob({
            status: 'processing',
            progress,
            step_label: stepLabel,
            warnings: [],
          })
        },
      })

      if (runIdRef.current !== runId) return
      if (signal.cancelled) {
        setJob({ status: 'cancelled', progress: 0, error: '已取消', warnings: [] })
        return
      }

      setResultPath(result.localPath)
      setJob({
        status: 'success',
        progress: 100,
        step_label: '完成',
        result,
        warnings: result.warnings || [],
      })
      Taro.showToast({ title: '压缩完成', icon: 'success' })
    } catch (e: any) {
      if (runIdRef.current !== runId) return
      if (e instanceof CompressCancelledError || signal.cancelled) {
        setJob({ status: 'cancelled', progress: 0, error: '已取消', warnings: [] })
      } else {
        setJob({
          status: 'failed',
          progress: 0,
          error: e?.message || '压缩失败，请稍后重试',
          warnings: [],
        })
      }
    } finally {
      if (runIdRef.current === runId) setBusy(false)
    }
  }

  const onCancel = () => {
    cancelRef.current.cancelled = true
    runIdRef.current += 1
    setBusy(false)
    setJob({ status: 'cancelled', progress: 0, error: '已取消', warnings: [] })
    Taro.showToast({ title: '已取消', icon: 'none' })
  }

  const onSave = async () => {
    if (!resultPath || saving) return
    setSaving(true)
    try {
      await saveImageToAlbum({
        filePath: resultPath,
        permissionText: '打开权限后就能保存压缩后的图片。',
      })
      Taro.showToast({ title: '已保存到相册', icon: 'success' })
    } catch (error: any) {
      if (error?.handled || isSaveCancel(error)) return
      Taro.showToast({ title: error?.userMessage || '保存失败', icon: 'none' })
    } finally {
      setSaving(false)
    }
  }

  const onPreview = (path: string) => {
    if (!path) return
    Taro.previewImage({ current: path, urls: [path] })
  }

  useShareAppMessage(() => ({
    title: '图片太大不好发？试试本地图片压缩工具',
    path: '/packages/tools/image-compress/image-compress',
  }))

  useShareTimeline(() => ({
    title: '图片压缩工具：本地处理，发图更省事',
  }))

  return (
    <View className='shell'>
      <NavigationBar title='图片压缩' background='var(--s-1-weak, #f5f7fa)' />
      <ScrollView className='page-scroll' scrollY enhanced showScrollbar={false}>
        <View className='page'>
          <ToolIntroCard
            title='本地压缩图片体积'
            description='选图先进行内容安全检测，压缩在本地完成，结果可保存到相册。'
          />

          <View className='card'>
            <View className='card__head'>
              <Text className='card__title'>选择图片</Text>
              <Text className='card__subtitle'>JPG / PNG</Text>
            </View>
            {image ? (
              <View className={`preview-row ${busy ? 'is-disabled' : ''}`}>
                <Image
                  className='preview-thumb'
                  src={image.path}
                  mode='aspectFill'
                  onClick={() => onPreview(image.path)}
                />
                <View className='preview-meta'>
                  <Text className='preview-title'>原图已就绪</Text>
                  <Text className='preview-desc'>
                    {formatFileSize(image.size)}
                    {image.width && image.height ? ` / ${image.width} × ${image.height}` : ''}
                  </Text>
                </View>
                <View className='change-btn' onClick={onPick}>
                  更换
                </View>
              </View>
            ) : (
              <View className='uploader' onClick={onPick}>
                <View className='upload-icon'>＋</View>
                <View>
                  <Text className='upload-title'>选择一张图片</Text>
                  <Text className='upload-desc'>支持从相册选择或直接拍照</Text>
                </View>
              </View>
            )}
          </View>

          <View className='card'>
            <Text className='card__title'>压缩设置</Text>

            <View className='block'>
              <Text className='setting-label'>压缩方式</Text>
              <View className='chip-row'>
                <View
                  className={`chip ${params.mode === 'quality' ? 'is-active' : ''}`}
                  onClick={() => !busy && patch({ mode: 'quality' })}
                >
                  <Text className='chip__title'>按质量</Text>
                </View>
                <View
                  className={`chip ${params.mode === 'target_size' ? 'is-active' : ''}`}
                  onClick={() => !busy && patch({ mode: 'target_size' })}
                >
                  <Text className='chip__title'>目标体积</Text>
                </View>
              </View>
            </View>

            {params.mode === 'quality' ? (
              <View className='block'>
                <Text className='setting-label'>质量 {params.quality}%</Text>
                <Slider
                  value={params.quality}
                  min={20}
                  max={95}
                  step={1}
                  activeColor='#1677ff'
                  backgroundColor='#f2f3f5'
                  blockSize={22}
                  disabled={busy}
                  onChange={(e) => patch({ quality: Number(e.detail.value) })}
                />
              </View>
            ) : (
              <View className='block'>
                <Text className='setting-label'>目标大小</Text>
                <View className='chip-row'>
                  {TARGET_PRESETS.map((v) => {
                    const label = v >= 1024 ? '1MB' : `${v}KB`
                    const active = targetSource === 'preset' && presetKb === v
                    return (
                      <View
                        key={v}
                        className={`chip ${active ? 'is-active' : ''}`}
                        onClick={() => {
                          if (busy) return
                          setPresetKb(v)
                          setTargetSource('preset')
                          setCustomValue('')
                          invalidateResult()
                        }}
                      >
                        <Text className='chip__title'>{label}</Text>
                      </View>
                    )
                  })}
                </View>
                <View className='custom-row'>
                  <Input
                    className='field-input custom-input'
                    type='digit'
                    value={customValue}
                    placeholder='自定义数值'
                    disabled={busy}
                    onInput={(e) => {
                      const next = e.detail.value.trim()
                      setCustomValue(next)
                      setTargetSource(next ? 'custom' : 'preset')
                      invalidateResult()
                    }}
                  />
                  <View className='unit-row'>
                    {(['KB', 'MB'] as const).map((unit) => (
                      <View
                        key={unit}
                        className={`chip unit-chip ${customUnit === unit ? 'is-active' : ''}`}
                        onClick={() => {
                          if (busy) return
                          setCustomUnit(unit)
                          if (customValue.trim()) setTargetSource('custom')
                          invalidateResult()
                        }}
                      >
                        <Text className='chip__title'>{unit}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            )}

            <View className='block'>
              <Text className='setting-label'>输出格式</Text>
              <View className='chip-row'>
                {OUTPUT_FORMATS.map((item) => (
                  <View
                    key={item.value}
                    className={`chip ${params.output_format === item.value ? 'is-active' : ''}`}
                    onClick={() => !busy && patch({ output_format: item.value })}
                  >
                    <Text className='chip__title'>{item.label}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View className='block'>
              <Text className='setting-label'>图片尺寸</Text>
              <View className='chip-row'>
                {([
                  ['keep', '保持尺寸'],
                  ['scale', '按比例缩小'],
                  ['custom', '自定义像素'],
                ] as const).map(([value, label]) => (
                  <View
                    key={value}
                    className={`chip ${params.size_mode === value ? 'is-active' : ''}`}
                    onClick={() => !busy && patch({ size_mode: value })}
                  >
                    <Text className='chip__title'>{label}</Text>
                  </View>
                ))}
              </View>

              {params.size_mode === 'scale' ? (
                <View className='chip-row sub-setting'>
                  {SCALE_PRESETS.map((value) => (
                    <View
                      key={value}
                      className={`chip ${params.scale_percent === value ? 'is-active' : ''}`}
                      onClick={() => !busy && patch({ scale_percent: value })}
                    >
                      <Text className='chip__title'>{value}%</Text>
                    </View>
                  ))}
                </View>
              ) : null}

              {params.size_mode === 'custom' ? (
                <View className='custom-size-block'>
                  <View className='custom-row'>
                    <Input
                      className='field-input custom-input'
                      type='number'
                      value={params.custom_width ? String(params.custom_width) : ''}
                      placeholder='宽度（可留空）'
                      disabled={busy}
                      onInput={(e) =>
                        patch({ custom_width: e.detail.value ? Number(e.detail.value) : null })
                      }
                    />
                    <Text className='size-separator'>×</Text>
                    <Input
                      className='field-input custom-input'
                      type='number'
                      value={params.custom_height ? String(params.custom_height) : ''}
                      placeholder='高度（可留空）'
                      disabled={busy}
                      onInput={(e) =>
                        patch({ custom_height: e.detail.value ? Number(e.detail.value) : null })
                      }
                    />
                  </View>
                  <View
                    className={`aspect-toggle ${params.lock_aspect ? 'is-active' : ''}`}
                    onClick={() => !busy && patch({ lock_aspect: !params.lock_aspect })}
                  >
                    {params.lock_aspect ? '✓ ' : ''}保持原图比例
                  </View>
                  {sizeInvalid ? <Text className='hint'>宽度和高度至少填写一个</Text> : null}
                </View>
              ) : null}
            </View>

            <View
              className={`primary-btn ${!canCompress ? 'is-disabled' : ''}`}
              onClick={onCompress}
            >
              {busy ? '压缩中…' : '开始压缩'}
            </View>
            {busy ? (
              <View className='cancel-link' onClick={onCancel}>
                取消
              </View>
            ) : null}
          </View>

          <View className='card'>
            <View className='card__head'>
              <Text className='card__title'>压缩结果</Text>
              <Text className='card__subtitle'>
                {job?.status === 'success' && job.result
                  ? `节省 ${job.result.ratio_reduced}%`
                  : busy
                    ? `${job?.progress || 0}%`
                    : '待压缩'}
              </Text>
            </View>

            <View className='compare-grid'>
              <View className='compare-item'>
                <Text className='compare-label'>原图</Text>
                <Text className='compare-value'>{image ? formatFileSize(image.size) : '--'}</Text>
                <Text className='compare-sub'>
                  {image?.width && image?.height ? `${image.width} × ${image.height}` : '--'}
                </Text>
              </View>
              <View className='compare-item'>
                <Text className='compare-label'>压缩后</Text>
                <Text className='compare-value'>
                  {job?.result ? formatBytes(job.result.output.size_bytes) : '--'}
                </Text>
                <Text className='compare-sub'>
                  {job?.result ? `${job.result.output.width} × ${job.result.output.height}` : '--'}
                </Text>
              </View>
            </View>

            {resultPath ? (
              <Image
                className='result-preview'
                src={resultPath}
                mode='aspectFit'
                onClick={() => onPreview(resultPath)}
              />
            ) : (
              <Text className='result-empty'>选择图片并压缩后，这里会显示对比与预览。</Text>
            )}

            {job?.result?.message ? <Text className='hint'>{job.result.message}</Text> : null}
            {job?.status === 'failed' ? <Text className='hint'>{job.error}</Text> : null}
            {job?.result ? (
              <Text className='hint'>耗时 {formatDuration(job.result.elapsed_ms)}</Text>
            ) : null}

            <MediaResultActions
              available={Boolean(resultPath)}
              busy={saving}
              title={resultPath ? '压缩图已生成' : '生成后可以保存到相册'}
              desc='压缩结果在本地生成'
              onSave={onSave}
            />
          </View>

          <Canvas
            type='2d'
            id='compressCanvas'
            canvasId='compressCanvas'
            className='hidden-canvas'
          />
        </View>
      </ScrollView>
    </View>
  )
}
