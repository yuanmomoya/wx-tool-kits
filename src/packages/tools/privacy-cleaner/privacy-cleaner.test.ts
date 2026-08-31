import Taro from '@tarojs/taro'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { inspectImageMetadata, inspectImageMetadataBytes } from '@/utils/image-metadata'
import { createPrivacyReencodePlan } from './privacy-cleaner.logic'

const jpegSegment = (marker: number, data: number[]) => [0xff, marker, 0, data.length + 2, ...data]
const ascii = (value: string) => Array.from(value, (char) => char.charCodeAt(0))
const pngChunk = (type: string, data: number[]) => { const length = data.length; return [length >>> 24, length >>> 16 & 255, length >>> 8 & 255, length & 255, ...ascii(type), ...data, 0, 0, 0, 0] }
const u32le = (value: number) => [value & 255, value >>> 8 & 255, value >>> 16 & 255, value >>> 24 & 255]
const gpsTiff = () => {
  const bytes = new Uint8Array(128); const view = new DataView(bytes.buffer)
  bytes.set(ascii('II'), 0); view.setUint16(2, 42, true); view.setUint32(4, 8, true)
  view.setUint16(8, 1, true); view.setUint16(10, 0x8825, true); view.setUint16(12, 4, true); view.setUint32(14, 1, true); view.setUint32(18, 26, true)
  view.setUint16(26, 4, true)
  const entry = (offset: number, tag: number, type: number, count: number, valueOffset: number) => { view.setUint16(offset, tag, true); view.setUint16(offset + 2, type, true); view.setUint32(offset + 4, count, true); view.setUint32(offset + 8, valueOffset, true) }
  entry(28, 1, 2, 2, 78); bytes[36] = 'N'.charCodeAt(0)
  entry(40, 2, 5, 3, 80)
  entry(52, 3, 2, 2, 69); bytes[60] = 'E'.charCodeAt(0)
  entry(64, 4, 5, 3, 104)
  ;[[80, 30], [88, 0], [96, 0], [104, 120], [112, 0], [120, 0]].forEach(([offset, value]) => { view.setUint32(offset, value, true); view.setUint32(offset + 4, 1, true) })
  return [...bytes]
}

describe('照片隐私清理', () => {
  const installFile = (bytes: number[]) => { const data = new Uint8Array(bytes); vi.mocked(Taro.getFileInfo).mockResolvedValue({ size: data.length } as any); vi.mocked(Taro.getFileSystemManager).mockReturnValue({ readFile: ({ success }: any) => success({ data: data.buffer }) } as any) }
  beforeEach(() => vi.clearAllMocks())
  it('识别 JPEG 的 XMP、IPTC、注释和 EXIF', async () => { const tiff = [...ascii('II'), 42, 0, 8, 0, 0, 0, 0, 0, 0, 0]; installFile([0xff, 0xd8, ...jpegSegment(0xe1, ascii('xmp-data')), ...jpegSegment(0xed, ascii('iptc')), ...jpegSegment(0xfe, ascii('comment')), ...jpegSegment(0xe1, [...ascii('Exif'), 0, 0, ...tiff]), 0xff, 0xd9]); const result = await inspectImageMetadata('jpeg'); expect(result.format).toBe('JPEG'); expect(result.metadataBlocks).toEqual(expect.arrayContaining(['XMP', 'IPTC', 'JPEG 注释', 'EXIF'])); expect(result.items.length).toBeGreaterThan(0) })
  it('识别 PNG 文本块及无元数据图片', async () => { installFile([137, 80, 78, 71, 13, 10, 26, 10, ...pngChunk('tEXt', ascii('Author\0Alice')), ...pngChunk('IEND', [])]); const png = await inspectImageMetadata('png'); expect(png.format).toBe('PNG'); expect(png.metadataBlocks).toContain('PNG 文本'); installFile([0xff, 0xd8, 0xff, 0xd9]); const clean = await inspectImageMetadata('clean'); expect(clean.items).toEqual([]) })
  it('识别 WebP XMP 并规划去元数据重编码', () => { const payload = ascii('xmp!'); const result = inspectImageMetadataBytes(new Uint8Array([...ascii('RIFF'), ...u32le(16), ...ascii('WEBP'), ...ascii('XMP '), ...u32le(payload.length), ...payload])); expect(result.format).toBe('WEBP'); expect(result.metadataBlocks).toContain('XMP'); expect(createPrivacyReencodePlan(8000, 4000, 4096, 'png')).toEqual({ width: 4096, height: 2048, fileType: 'png', stripsMetadata: true }); expect(createPrivacyReencodePlan(800, 600, 4096, 'webp').fileType).toBe('jpg') })
  it('解析 JPEG EXIF 中的 GPS 经纬度', () => { const result = inspectImageMetadataBytes(new Uint8Array([0xff, 0xd8, ...jpegSegment(0xe1, [...ascii('Exif'), 0, 0, ...gpsTiff()]), 0xff, 0xd9])); expect(result.metadataBlocks).toContain('EXIF'); expect(result.items.find((item) => item.id === 'gps-location')?.value).toBe('30.000000, 120.000000') })
  it('识别 PNG 压缩文本、国际文本、时间和内嵌 EXIF', () => { const time = [0x07, 0xea, 8, 1, 12, 30, 45]; const tiff = [...ascii('II'), 42, 0, 8, 0, 0, 0, 0, 0, 0, 0]; const result = inspectImageMetadataBytes(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, ...pngChunk('zTXt', ascii('data')), ...pngChunk('iTXt', ascii('data')), ...pngChunk('tIME', time), ...pngChunk('eXIf', tiff), ...pngChunk('IEND', [])])); expect(result.metadataBlocks).toEqual(expect.arrayContaining(['PNG 文本', 'PNG 时间', 'EXIF'])); expect(result.items.some((item) => item.id === 'png-time')).toBe(true) })
  it('未知二进制不误报，并兼容文件系统返回字符串', async () => { expect(inspectImageMetadataBytes(new Uint8Array([1, 2, 3]))).toMatchObject({ items: [], metadataBlocks: [] }); vi.mocked(Taro.getFileInfo).mockResolvedValue({ size: 4 } as any); vi.mocked(Taro.getFileSystemManager).mockReturnValue({ readFile: ({ success }: any) => success({ data: String.fromCharCode(0xff, 0xd8, 0xff, 0xd9) }) } as any); expect((await inspectImageMetadata('string')).format).toBe('JPEG'); expect(() => createPrivacyReencodePlan(0, 1)).toThrow() })
})
