
/** 体积与耗时等展示格式化工具 */

/** 字节 → 可读字符串（B / KB / MB） */
export function formatBytes(bytes: number): string {
  if (!bytes && bytes !== 0) return '-'
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)}MB`
}

/** 毫秒 → 中文耗时文案 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}毫秒`
  return `${(ms / 1000).toFixed(2)}秒`
}

/** 从文件名猜测扩展格式大写标签 */
export function guessFormat(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || ''
  if (ext === 'jpeg' || ext === 'jfif') return 'JPG'
  return ext ? ext.toUpperCase() : '未知'
}
