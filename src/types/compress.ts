/** 本地压缩参数与结果类型（精简版，仅 JPG/PNG） */

export type CompressMode = 'target_size' | 'quality'
export type SizeMode = 'keep' | 'scale' | 'custom'
export type SizeUnit = 'KB' | 'MB'
export type OutputFormat = 'keep' | 'jpg' | 'png'

export interface CompressParams {
  mode: CompressMode
  target_size_value: number
  target_size_unit: SizeUnit
  quality: number
  output_format: OutputFormat
  size_mode: SizeMode
  scale_percent: number
  custom_width?: number | null
  custom_height?: number | null
  lock_aspect: boolean
  keep_transparency: boolean
  background_color: string
}

export interface ImageInfo {
  filename: string
  size_bytes: number
  width: number
  height: number
  format: string
}

export interface CompressResult {
  original: ImageInfo
  output: ImageInfo
  ratio_reduced: number
  elapsed_ms: number
  reached_target: boolean
  message?: string | null
  warnings: string[]
  /** 结果本地临时路径 */
  localPath: string
}

export type JobStatus = 'idle' | 'processing' | 'success' | 'failed' | 'cancelled'

export interface CompressJob {
  status: JobStatus
  progress: number
  step_label?: string | null
  error?: string | null
  result?: CompressResult | null
  warnings: string[]
}

export interface LocalImage {
  path: string
  size: number
  name: string
  width?: number
  height?: number
  format?: string
}

export const DEFAULT_PARAMS: CompressParams = {
  mode: 'target_size',
  target_size_value: 200,
  target_size_unit: 'KB',
  quality: 70,
  output_format: 'keep',
  size_mode: 'keep',
  scale_percent: 50,
  custom_width: null,
  custom_height: null,
  lock_aspect: true,
  keep_transparency: true,
  background_color: '#FFFFFF',
}

export const TARGET_PRESETS = [10, 20, 50, 100, 200, 500, 1024]
export const SCALE_PRESETS = [75, 50, 25]

export const OUTPUT_FORMATS: Array<{ value: OutputFormat; label: string }> = [
  { value: 'keep', label: '保持原格式' },
  { value: 'jpg', label: 'JPG' },
  { value: 'png', label: 'PNG' },
]

/** 背景色快捷色板 */
export const BG_COLOR_PRESETS = [
  '#FFFFFF',
  '#F3F4F6',
  '#000000',
  '#EF4444',
  '#F97316',
  '#EAB308',
  '#22C55E',
  '#14B8A6',
  '#0EA5E9',
  '#3B82F6',
  '#8B5CF6',
  '#EC4899',
]

export const SUPPORTED_INPUT = new Set(['jpg', 'jpeg', 'png'])
