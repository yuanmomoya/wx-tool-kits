import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { featuredTools, hotTools, toolCatalog } from '@/utils/tool-catalog'

describe('功能页测试覆盖完整性', () => {
  const internalTools = toolCatalog.filter((tool) => tool.path && tool.id !== 'guide')

  it('仅纳入 27 个站内功能页', () => {
    expect(internalTools).toHaveLength(27)
    expect(internalTools.every((tool) => !tool.shortLink)).toBe(true)
  })

  it('证件材料复印排版位于推荐与热门首位', () => {
    expect(featuredTools[0]?.id).toBe('document-copy')
    expect(hotTools[0]?.id).toBe('document-copy')
  })

  it.each(internalTools.map((tool) => [tool.id, tool.path]))('%s 路由目录存在测试文件', (_, route) => {
    const routeParts = String(route).replace(/^\//, '').split('/')
    const pageName = routeParts[routeParts.length - 1]
    expect(existsSync(join(process.cwd(), 'src', ...routeParts.slice(0, -1), `${pageName}.test.ts`))).toBe(true)
  })
})
