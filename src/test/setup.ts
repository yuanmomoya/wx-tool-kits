import { afterEach, beforeEach, vi } from 'vitest'

process.env.TARO_APP_ID ||= 'touristappid'
process.env.TARO_APP_CLOUD_ENV_ID ||= 'test-cloud-env'

const storage = new Map<string, unknown>()

vi.mock('@tarojs/taro', () => ({
  default: {
    getStorageSync: vi.fn((key: string) => storage.get(key)),
    setStorageSync: vi.fn((key: string, value: unknown) => storage.set(key, value)),
    removeStorageSync: vi.fn((key: string) => storage.delete(key)),
    getFileInfo: vi.fn(),
    getFileSystemManager: vi.fn(),
    getImageInfo: vi.fn(),
    createSelectorQuery: vi.fn(),
    showToast: vi.fn(),
    canvasToTempFilePath: vi.fn(),
    compressVideo: vi.fn(),
    saveVideoToPhotosAlbum: vi.fn(),
    saveImageToPhotosAlbum: vi.fn(),
  },
  getStorageSync: vi.fn((key: string) => storage.get(key)),
  setStorageSync: vi.fn((key: string, value: unknown) => storage.set(key, value)),
  removeStorageSync: vi.fn((key: string) => storage.delete(key)),
  useShareAppMessage: vi.fn(),
  useShareTimeline: vi.fn(),
}))

beforeEach(() => {
  storage.clear()
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-08-01T00:00:00.000Z'))
  vi.spyOn(Math, 'random').mockReturnValue(0.42)
})

afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

export type CanvasCall = { method: string; args: unknown[] }

export const createCanvasRecorder = () => {
  const calls: CanvasCall[] = []
  const methods = ['save', 'restore', 'translate', 'rotate', 'drawImage', 'fillText', 'fillRect']
  const context = Object.fromEntries(
    methods.map((method) => [method, (...args: unknown[]) => calls.push({ method, args })]),
  ) as Record<string, (...args: unknown[]) => void>
  return { calls, context }
}
