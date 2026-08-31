import { describe, expect, it, vi } from 'vitest'
import { normalizeRelationToken, relationPath, resolveRelation } from './relationship.logic'

describe('亲戚关系计算器', () => {
  it('标准化别名并计算常见直系、旁系和姻亲路径', () => { expect(normalizeRelationToken(' 父亲 ')).toBe('爸爸'); expect(relationPath(['爸爸', '爸爸'])).toBe('ff'); expect(resolveRelation(['爸爸', '爸爸'], 'male')).toBe('爷爷'); expect(resolveRelation(['妈妈', '妈妈'], 'female')).toBe('外婆'); expect(resolveRelation(['老公', '爸爸'], 'female')).toBe('公公'); expect(resolveRelation(['老婆', '妈妈'], 'male')).toBe('岳母') })
  it('按男女视角调用第三方 fallback', () => { const fallback = vi.fn(() => ['表亲']); expect(resolveRelation(['爸爸', '姐姐', '儿子'], 'female', fallback)).toBe('表亲'); expect(fallback).toHaveBeenCalledWith('foss', 'female') })
  it('处理未知词及最多六层', () => { expect(resolveRelation(['神秘亲戚'], 'male')).toBe('暂未识别'); expect(() => relationPath([])).toThrow(); expect(() => relationPath(Array(7).fill('爸爸'))).toThrow(); expect(relationPath(Array(6).fill('爸爸'))).toBe('ffffff') })
})
