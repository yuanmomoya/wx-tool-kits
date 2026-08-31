export type SelfGender = 'male' | 'female'
const ALIASES: Record<string, string> = { 父亲: '爸爸', 老爸: '爸爸', 母亲: '妈妈', 老妈: '妈妈', 丈夫: '老公', 妻子: '老婆' }
const PATHS: Record<string, string> = { 爸爸: 'f', 妈妈: 'm', 哥哥: 'ob', 弟弟: 'lb', 姐姐: 'os', 妹妹: 'ls', 老公: 'h', 老婆: 'w', 儿子: 's', 女儿: 'd' }
const TITLES: Record<string, string> = { f: '爸爸', m: '妈妈', ff: '爷爷', fm: '奶奶', mf: '外公', mm: '外婆', ob: '哥哥', lb: '弟弟', os: '姐姐', ls: '妹妹', h: '老公', w: '老婆', s: '儿子', d: '女儿', hf: '公公', hm: '婆婆', wf: '岳父', wm: '岳母' }

export function normalizeRelationToken(value: string) { const token = value.trim(); return ALIASES[token] || token }

export function relationPath(tokens: string[]) {
  if (tokens.length === 0 || tokens.length > 6) throw new RangeError('关系层级必须为 1–6 层')
  return tokens.map(normalizeRelationToken).map((token) => PATHS[token] || token).join('')
}

export function resolveRelation(tokens: string[], gender: SelfGender, fallback?: (path: string, gender: SelfGender) => string[]) {
  const path = relationPath(tokens)
  const direct = TITLES[path]
  if (direct) return direct
  const result = fallback?.(path, gender).filter(Boolean)
  return result?.[0] || '暂未识别'
}
