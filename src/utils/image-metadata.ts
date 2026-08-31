import Taro from '@tarojs/taro'

export type PrivacyMetadataItem = {
  id: string
  label: string
  value: string
  category: 'location' | 'device' | 'time' | 'author' | 'other'
}

export type ImageMetadataScan = {
  format: 'JPEG' | 'PNG' | 'WEBP' | '未知格式'
  items: PrivacyMetadataItem[]
  metadataBlocks: string[]
}

const MAX_SCAN_BYTES = 8 * 1024 * 1024
const TYPE_SIZES: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 }

const ascii = (bytes: Uint8Array, start: number, length: number) => {
  let value = ''
  const end = Math.min(bytes.length, start + length)
  for (let index = Math.max(0, start); index < end; index += 1) {
    const code = bytes[index]
    if (code === 0) break
    value += String.fromCharCode(code)
  }
  return value.trim()
}

const utf8 = (bytes: Uint8Array, start: number, length: number) => {
  const slice = bytes.slice(Math.max(0, start), Math.min(bytes.length, start + length))
  let escaped = ''
  for (let index = 0; index < slice.length; index += 1) {
    if (slice[index] === 0) break
    escaped += `%${slice[index].toString(16).padStart(2, '0')}`
  }
  try {
    return decodeURIComponent(escaped).trim()
  } catch {
    return ascii(slice, 0, slice.length)
  }
}

const compact = (value: unknown, maxLength = 120) => {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim()
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text
}

const hasText = (bytes: Uint8Array, offset: number, text: string) =>
  ascii(bytes, offset, text.length) === text

const addUnique = (items: PrivacyMetadataItem[], item: PrivacyMetadataItem) => {
  const value = compact(item.value)
  if (!value || items.some((current) => current.id === item.id && current.value === value)) return
  items.push({ ...item, value })
}

const readFileHead = async (filePath: string, knownSize?: number) => {
  const fileInfo = knownSize ? { size: knownSize } : await Taro.getFileInfo({ filePath })
  const length = Math.min(Number((fileInfo as { size?: number }).size) || MAX_SCAN_BYTES, MAX_SCAN_BYTES)
  const fs = Taro.getFileSystemManager()

  return new Promise<Uint8Array>((resolve, reject) => {
    fs.readFile({
      filePath,
      position: 0,
      length,
      success: (result) => {
        if (typeof result.data === 'string') {
          const values = Array.from(result.data, (char) => char.charCodeAt(0) & 0xff)
          resolve(new Uint8Array(values))
          return
        }
        resolve(new Uint8Array(result.data as ArrayBuffer))
      },
      fail: reject,
    })
  })
}

type TiffReader = {
  bytes: Uint8Array
  view: DataView
  start: number
  little: boolean
  u16: (offset: number) => number
  u32: (offset: number) => number
  value: (entry: number) => string | number | number[] | null
}

const createTiffReader = (bytes: Uint8Array, start: number): TiffReader | null => {
  if (start < 0 || start + 8 > bytes.length) return null
  const byteOrder = ascii(bytes, start, 2)
  if (byteOrder !== 'II' && byteOrder !== 'MM') return null
  const little = byteOrder === 'II'
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const valid = (offset: number, size: number) => offset >= 0 && offset + size <= bytes.length
  const u16 = (offset: number) => (valid(offset, 2) ? view.getUint16(offset, little) : 0)
  const u32 = (offset: number) => (valid(offset, 4) ? view.getUint32(offset, little) : 0)
  const i32 = (offset: number) => (valid(offset, 4) ? view.getInt32(offset, little) : 0)

  const reader = {} as TiffReader
  reader.bytes = bytes
  reader.view = view
  reader.start = start
  reader.little = little
  reader.u16 = u16
  reader.u32 = u32
  reader.value = (entry: number) => {
    if (!valid(entry, 12)) return null
    const type = u16(entry + 2)
    const count = u32(entry + 4)
    const unit = TYPE_SIZES[type]
    if (!unit || !count || count > 2048) return null
    const byteLength = unit * count
    const offset = byteLength <= 4 ? entry + 8 : start + u32(entry + 8)
    if (!valid(offset, byteLength)) return null

    if (type === 2) return ascii(bytes, offset, Math.min(count, 512))
    const values: number[] = []
    for (let index = 0; index < count; index += 1) {
      const current = offset + index * unit
      if (type === 1 || type === 7) values.push(bytes[current])
      else if (type === 3) values.push(u16(current))
      else if (type === 4) values.push(u32(current))
      else if (type === 9) values.push(i32(current))
      else if (type === 5 || type === 10) {
        const numerator = type === 10 ? i32(current) : u32(current)
        const denominator = type === 10 ? i32(current + 4) : u32(current + 4)
        values.push(denominator ? numerator / denominator : 0)
      }
    }
    return values.length === 1 ? values[0] : values
  }
  return reader
}

const scanTiff = (
  bytes: Uint8Array,
  start: number,
  items: PrivacyMetadataItem[],
  metadataBlocks: string[],
) => {
  const reader = createTiffReader(bytes, start)
  if (!reader || reader.u16(start + 2) !== 42) return
  if (!metadataBlocks.includes('EXIF')) metadataBlocks.push('EXIF')

  const values = new Map<number, string | number | number[] | null>()
  const readIfd = (relativeOffset: number) => {
    const offset = start + relativeOffset
    if (offset < start || offset + 2 > bytes.length) return
    const count = Math.min(reader.u16(offset), 256)
    for (let index = 0; index < count; index += 1) {
      const entry = offset + 2 + index * 12
      if (entry + 12 > bytes.length) break
      values.set(reader.u16(entry), reader.value(entry))
    }
  }

  readIfd(reader.u32(start + 4))
  const exifOffset = Number(values.get(0x8769))
  const gpsOffset = Number(values.get(0x8825))

  const addTag = (
    tag: number,
    id: string,
    label: string,
    category: PrivacyMetadataItem['category'],
  ) => {
    const value = values.get(tag)
    if (value !== null && value !== undefined && value !== '') {
      addUnique(items, { id, label, category, value: Array.isArray(value) ? value.join(', ') : String(value) })
    }
  }

  addTag(0x010e, 'description', '图片说明', 'other')
  addTag(0x010f, 'camera-make', '设备品牌', 'device')
  addTag(0x0110, 'camera-model', '设备型号', 'device')
  addTag(0x0131, 'software', '处理软件', 'device')
  addTag(0x0132, 'modified-time', '修改时间', 'time')
  addTag(0x013b, 'artist', '作者', 'author')
  addTag(0x8298, 'copyright', '版权信息', 'author')

  if (Number.isFinite(exifOffset) && exifOffset > 0) {
    readIfd(exifOffset)
    addTag(0x9003, 'taken-time', '拍摄时间', 'time')
    addTag(0x9004, 'digitized-time', '数字化时间', 'time')
    addTag(0xa420, 'image-id', '图片唯一标识', 'other')
    addTag(0xa430, 'owner', '相机所有者', 'author')
    addTag(0xa431, 'body-serial', '机身序列号', 'device')
    addTag(0xa434, 'lens-model', '镜头型号', 'device')
    addTag(0xa435, 'lens-serial', '镜头序列号', 'device')
    const comment = values.get(0x9286)
    if (Array.isArray(comment) && comment.length) {
      addUnique(items, {
        id: 'user-comment',
        label: '图片备注',
        category: 'other',
        value: ascii(new Uint8Array(comment), 8, comment.length - 8) || '包含备注信息',
      })
    }
  }

  if (Number.isFinite(gpsOffset) && gpsOffset > 0) {
    values.clear()
    readIfd(gpsOffset)
    const lat = values.get(2)
    const lng = values.get(4)
    const latRef = String(values.get(1) || '')
    const lngRef = String(values.get(3) || '')
    const toDegree = (value: unknown, ref: string) => {
      if (!Array.isArray(value) || value.length < 3) return null
      const degree = Number(value[0]) + Number(value[1]) / 60 + Number(value[2]) / 3600
      return /S|W/i.test(ref) ? -degree : degree
    }
    const latitude = toDegree(lat, latRef)
    const longitude = toDegree(lng, lngRef)
    if (latitude !== null && longitude !== null) {
      addUnique(items, {
        id: 'gps-location',
        label: '拍摄位置',
        category: 'location',
        value: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
      })
    } else {
      addUnique(items, { id: 'gps-data', label: '位置信息', category: 'location', value: '包含 GPS 数据' })
    }
    const altitude = values.get(6)
    if (typeof altitude === 'number') {
      addUnique(items, { id: 'gps-altitude', label: '拍摄海拔', category: 'location', value: `${altitude.toFixed(1)} 米` })
    }
    addTag(29, 'gps-date', '定位日期', 'time')
  }
}

const scanJpeg = (bytes: Uint8Array, items: PrivacyMetadataItem[], blocks: string[]) => {
  let offset = 2
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) break
    const marker = bytes[offset + 1]
    if (marker === 0xda || marker === 0xd9) break
    const length = (bytes[offset + 2] << 8) | bytes[offset + 3]
    if (length < 2 || offset + 2 + length > bytes.length) break
    const dataStart = offset + 4
    const dataLength = length - 2

    if (marker === 0xe1 && hasText(bytes, dataStart, 'Exif')) {
      scanTiff(bytes, dataStart + 6, items, blocks)
    } else if (marker === 0xe1) {
      if (!blocks.includes('XMP')) blocks.push('XMP')
      addUnique(items, { id: 'xmp', label: '编辑与描述信息', category: 'other', value: '包含 XMP 元数据' })
    } else if (marker === 0xed) {
      if (!blocks.includes('IPTC')) blocks.push('IPTC')
      addUnique(items, { id: 'iptc', label: '作者与说明信息', category: 'author', value: '包含 IPTC 元数据' })
    } else if (marker === 0xfe) {
      if (!blocks.includes('JPEG 注释')) blocks.push('JPEG 注释')
      addUnique(items, { id: 'jpeg-comment', label: '图片注释', category: 'other', value: utf8(bytes, dataStart, dataLength) || '包含注释信息' })
    }
    offset += 2 + length
  }
}

const scanPng = (bytes: Uint8Array, items: PrivacyMetadataItem[], blocks: string[]) => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let offset = 8
  while (offset + 12 <= bytes.length) {
    const length = view.getUint32(offset, false)
    const type = ascii(bytes, offset + 4, 4)
    const dataStart = offset + 8
    if (length > MAX_SCAN_BYTES || dataStart + length + 4 > bytes.length) break

    if (type === 'eXIf') scanTiff(bytes, dataStart, items, blocks)
    if (type === 'tEXt') {
      if (!blocks.includes('PNG 文本')) blocks.push('PNG 文本')
      const content = utf8(bytes, dataStart, Math.min(length, 512))
      const split = content.indexOf('\u0000')
      addUnique(items, {
        id: `png-text-${offset}`,
        label: split > 0 ? compact(content.slice(0, split), 28) : '图片文本',
        category: /author|copyright/i.test(content) ? 'author' : 'other',
        value: split > 0 ? content.slice(split + 1) : content || '包含文本信息',
      })
    }
    if (type === 'zTXt' || type === 'iTXt') {
      if (!blocks.includes('PNG 文本')) blocks.push('PNG 文本')
      addUnique(items, { id: `png-${type}-${offset}`, label: '图片文本', category: 'other', value: `包含 ${type} 元数据` })
    }
    if (type === 'tIME' && length >= 7) {
      if (!blocks.includes('PNG 时间')) blocks.push('PNG 时间')
      addUnique(items, {
        id: 'png-time',
        label: '修改时间',
        category: 'time',
        value: `${view.getUint16(dataStart, false)}-${String(bytes[dataStart + 2]).padStart(2, '0')}-${String(bytes[dataStart + 3]).padStart(2, '0')} ${String(bytes[dataStart + 4]).padStart(2, '0')}:${String(bytes[dataStart + 5]).padStart(2, '0')}:${String(bytes[dataStart + 6]).padStart(2, '0')}`,
      })
    }
    if (type === 'IEND') break
    offset = dataStart + length + 4
  }
}

const scanWebp = (bytes: Uint8Array, items: PrivacyMetadataItem[], blocks: string[]) => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let offset = 12
  while (offset + 8 <= bytes.length) {
    const type = ascii(bytes, offset, 4)
    const length = view.getUint32(offset + 4, true)
    const dataStart = offset + 8
    if (length > MAX_SCAN_BYTES || dataStart + length > bytes.length) break
    if (type === 'EXIF') {
      const tiffStart = hasText(bytes, dataStart, 'Exif') ? dataStart + 6 : dataStart
      scanTiff(bytes, tiffStart, items, blocks)
    }
    if (type === 'XMP') {
      if (!blocks.includes('XMP')) blocks.push('XMP')
      addUnique(items, { id: 'webp-xmp', label: '编辑与描述信息', category: 'other', value: '包含 XMP 元数据' })
    }
    offset = dataStart + length + (length % 2)
  }
}

export function inspectImageMetadataBytes(bytes: Uint8Array): ImageMetadataScan {
  const items: PrivacyMetadataItem[] = []
  const metadataBlocks: string[] = []
  let format: ImageMetadataScan['format'] = '未知格式'

  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    format = 'JPEG'
    scanJpeg(bytes, items, metadataBlocks)
  } else if (hasText(bytes, 1, 'PNG')) {
    format = 'PNG'
    scanPng(bytes, items, metadataBlocks)
  } else if (hasText(bytes, 0, 'RIFF') && hasText(bytes, 8, 'WEBP')) {
    format = 'WEBP'
    scanWebp(bytes, items, metadataBlocks)
  }

  if (metadataBlocks.includes('EXIF') && !items.length) {
    addUnique(items, { id: 'exif-generic', label: 'EXIF 拍摄信息', category: 'other', value: '包含可清除的拍摄元数据' })
  }

  return { format, items, metadataBlocks }
}

export async function inspectImageMetadata(filePath: string, knownSize?: number): Promise<ImageMetadataScan> {
  return inspectImageMetadataBytes(await readFileHead(filePath, knownSize))
}
