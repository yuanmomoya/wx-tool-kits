import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { featuredTools, hotTools, toolCatalog } from '@/utils/tool-catalog'

describe('功能页测试覆盖完整性', () => {
  const internalTools = toolCatalog.filter((tool) => tool.path && tool.id !== 'guide')

  it('仅纳入 28 个站内功能页', () => {
    expect(internalTools).toHaveLength(28)
    expect(internalTools.every((tool) => !tool.shortLink)).toBe(true)
  })

  it('盆底肌训练排在生活健康首位', () => {
    const health = toolCatalog.filter((tool) => tool.category === '生活健康').map((tool) => tool.id)
    expect(health).toEqual(['pelvic-floor', 'bmi', 'bmr'])
  })

  it('盆底肌训练位于首页轮播首位', () => {
    expect(featuredTools[0]?.id).toBe('pelvic-floor')
    expect(hotTools[0]?.id).toBe('document-copy')
  })

  it.each(internalTools.map((tool) => [tool.id, tool.path]))('%s 路由目录存在测试文件', (_, route) => {
    const routeParts = String(route).replace(/^\//, '').split('/')
    const pageName = routeParts[routeParts.length - 1]
    expect(existsSync(join(process.cwd(), 'src', ...routeParts.slice(0, -1), `${pageName}.test.ts`))).toBe(true)
  })
})
