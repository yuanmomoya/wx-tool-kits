import { useMemo, useState } from 'react'
import { ScrollView, Text, View } from '@tarojs/components'
import Taro, { useShareAppMessage, useShareTimeline } from '@tarojs/taro'
import relationship from 'relationship.js'

import NavigationBar from '@/components/NavigationBar'
import ToolIntroCard from '@/packages/tools/components/ToolIntroCard'

import './relationship.scss'

type SelfGender = 'male' | 'female'

type RelationGroup = {
  title: string
  items: string[]
}

type RelationResult = {
  hasResult: boolean
  title: string
  relationPath: string
  badge: string
  note: string
}

const MAX_RELATION_STEPS = 6
const APPEND_STOP_TEXT = `已到 ${MAX_RELATION_STEPS} 层关系，这个深度已能覆盖大多数常见称呼。`
const APPEND_STOP_TOAST = `最多可计算 ${MAX_RELATION_STEPS} 层关系`

const tokenAliases: Record<string, string> = {
  爸爸: '爸爸',
  父亲: '爸爸',
  老爸: '爸爸',
  爸: '爸爸',
  妈妈: '妈妈',
  母亲: '妈妈',
  老妈: '妈妈',
  妈: '妈妈',
  哥哥: '哥哥',
  哥: '哥哥',
  弟弟: '弟弟',
  弟: '弟弟',
  姐姐: '姐姐',
  姐: '姐姐',
  妹妹: '妹妹',
  妹: '妹妹',
  老公: '老公',
  丈夫: '老公',
  先生: '老公',
  老婆: '老婆',
  妻子: '老婆',
  太太: '老婆',
  妻: '老婆',
  儿子: '儿子',
  女儿: '女儿',
  闺女: '女儿',
  爷爷: '爷爷',
  奶奶: '奶奶',
  外公: '外公',
  姥爷: '外公',
  外婆: '外婆',
  姥姥: '外婆',
  伯父: '伯父',
  伯伯: '伯父',
  叔叔: '叔叔',
  姑妈: '姑妈',
  姑姑: '姑妈',
  姑母: '姑妈',
  舅舅: '舅舅',
  姨妈: '姨妈',
  阿姨: '姨妈',
  姨母: '姨妈',
  姑父: '姑父',
  姑夫: '姑父',
  姨父: '姨父',
  姨夫: '姨父',
  姨丈: '姨父',
  舅妈: '舅妈',
  舅母: '舅妈',
  妗子: '舅妈',
  妗妗: '舅妈',
  伯母: '伯母',
  婶婶: '婶婶',
  婶子: '婶婶',
  婶母: '婶婶',
  姐夫: '姐夫',
  妹夫: '妹夫',
  嫂子: '嫂子',
  嫂嫂: '嫂子',
  弟妹: '弟妹',
  弟媳: '弟妹',
  公公: '公公',
  婆婆: '婆婆',
  岳父: '岳父',
  岳母: '岳母',
  儿媳: '儿媳',
  儿媳妇: '儿媳',
  息妇: '儿媳',
  媳妇: '老婆',
  媳妇儿: '老婆',
  女婿: '女婿',
  孙子: '孙子',
  孙女: '孙女',
  外孙: '外孙',
  外孙女: '外孙女',
  侄子: '侄子',
  侄女: '侄女',
  外甥: '外甥',
  外甥女: '外甥女',
}

const tokenToPath: Record<string, string> = {
  爸爸: 'f',
  妈妈: 'm',
  哥哥: 'ob',
  弟弟: 'lb',
  姐姐: 'os',
  妹妹: 'ls',
  老公: 'h',
  老婆: 'w',
  儿子: 's',
  女儿: 'd',
  爷爷: 'ff',
  奶奶: 'fm',
  外公: 'mf',
  外婆: 'mm',
  伯父: 'fob',
  叔叔: 'flb',
  姑妈: 'fos',
  舅舅: 'mob',
  姨妈: 'mos',
  姑父: 'fosh',
  姨父: 'mosh',
  舅妈: 'mobw',
  伯母: 'fobw',
  婶婶: 'flbw',
  姐夫: 'osh',
  妹夫: 'lsh',
  嫂子: 'obw',
  弟妹: 'lbw',
  公公: 'hf',
  婆婆: 'hm',
  岳父: 'wf',
  岳母: 'wm',
  儿媳: 'sw',
  女婿: 'dh',
  孙子: 'ss',
  孙女: 'sd',
  外孙: 'ds',
  外孙女: 'dd',
  侄子: 'obs',
  侄女: 'obd',
  外甥: 'oss',
  外甥女: 'osd',
}

const relationTitleMap: Record<string, { title: string; note?: string }> = {
  f: { title: '爸爸' },
  m: { title: '妈妈' },
  ob: { title: '哥哥' },
  lb: { title: '弟弟' },
  os: { title: '姐姐' },
  ls: { title: '妹妹' },
  h: { title: '老公' },
  w: { title: '老婆' },
  s: { title: '儿子' },
  d: { title: '女儿' },
  ff: { title: '爷爷' },
  fm: { title: '奶奶' },
  mf: { title: '外公' },
  mm: { title: '外婆' },
  fff: { title: '曾祖父' },
  ffm: { title: '曾祖母' },
  fmf: { title: '曾外祖父' },
  fmm: { title: '曾外祖母' },
  mff: { title: '外曾祖父' },
  mfm: { title: '外曾祖母' },
  mmf: { title: '外曾祖父' },
  mmm: { title: '外曾祖母' },
  ffob: { title: '伯公' },
  ffobw: { title: '伯婆' },
  fflb: { title: '叔公' },
  fflbw: { title: '叔婆' },
  ffxs: { title: '姑婆' },
  ffxsh: { title: '姑公' },
  fmxb: { title: '舅公' },
  fmxbw: { title: '舅婆' },
  fmxs: { title: '姨婆' },
  fmxsh: { title: '姨公' },
  mfob: { title: '伯外公' },
  mfobw: { title: '伯外婆' },
  mflb: { title: '叔外公' },
  mflbw: { title: '叔外婆' },
  mfxs: { title: '姑外婆' },
  mfxsh: { title: '姑外公' },
  mmxb: { title: '舅外公' },
  mmxbw: { title: '舅外婆' },
  mmxs: { title: '姨外婆' },
  mmxsh: { title: '姨外公' },
  fob: { title: '伯父' },
  flb: { title: '叔叔' },
  fos: { title: '姑妈' },
  fls: { title: '姑妈' },
  mob: { title: '舅舅' },
  mlb: { title: '舅舅' },
  mos: { title: '姨妈' },
  mls: { title: '姨妈' },
  fosh: { title: '姑父' },
  flsh: { title: '姑父' },
  mosh: { title: '姨父' },
  mlsh: { title: '姨父' },
  mobw: { title: '舅妈' },
  mlbw: { title: '舅妈' },
  fobw: { title: '伯母' },
  flbw: { title: '婶婶' },
  obw: { title: '嫂子' },
  lbw: { title: '弟妹' },
  osh: { title: '姐夫' },
  lsh: { title: '妹夫' },
  hf: { title: '公公' },
  hm: { title: '婆婆' },
  wf: { title: '岳父' },
  wm: { title: '岳母' },
  sw: { title: '儿媳' },
  dh: { title: '女婿' },
  ss: { title: '孙子' },
  sd: { title: '孙女' },
  ds: { title: '外孙' },
  dd: { title: '外孙女' },
  obs: { title: '侄子' },
  lbs: { title: '侄子' },
  obd: { title: '侄女' },
  lbd: { title: '侄女' },
  oss: { title: '外甥' },
  lss: { title: '外甥' },
  osd: { title: '外甥女' },
  lsd: { title: '外甥女' },
  fobs: { title: '堂哥 / 堂弟', note: '堂系称呼会受对方年龄影响，这里返回常见叫法。' },
  flbs: { title: '堂哥 / 堂弟', note: '堂系称呼会受对方年龄影响，这里返回常见叫法。' },
  fobd: { title: '堂姐 / 堂妹', note: '堂系称呼会受对方年龄影响，这里返回常见叫法。' },
  flbd: { title: '堂姐 / 堂妹', note: '堂系称呼会受对方年龄影响，这里返回常见叫法。' },
  fobsw: { title: '堂嫂 / 堂弟媳', note: '堂亲配偶称呼会受对方年龄影响，这里返回常见叫法。' },
  flbsw: { title: '堂嫂 / 堂弟媳', note: '堂亲配偶称呼会受对方年龄影响，这里返回常见叫法。' },
  fobdh: { title: '堂姐夫 / 堂妹夫', note: '堂亲配偶称呼会受对方年龄影响，这里返回常见叫法。' },
  flbdh: { title: '堂姐夫 / 堂妹夫', note: '堂亲配偶称呼会受对方年龄影响，这里返回常见叫法。' },
  foss: { title: '表哥 / 表弟', note: '表亲称呼会受对方年龄影响，这里返回常见叫法。' },
  flss: { title: '表哥 / 表弟', note: '表亲称呼会受对方年龄影响，这里返回常见叫法。' },
  mobs: { title: '表哥 / 表弟', note: '表亲称呼会受对方年龄影响，这里返回常见叫法。' },
  mlbs: { title: '表哥 / 表弟', note: '表亲称呼会受对方年龄影响，这里返回常见叫法。' },
  moss: { title: '表哥 / 表弟', note: '表亲称呼会受对方年龄影响，这里返回常见叫法。' },
  mlss: { title: '表哥 / 表弟', note: '表亲称呼会受对方年龄影响，这里返回常见叫法。' },
  fosd: { title: '表姐 / 表妹', note: '表亲称呼会受对方年龄影响，这里返回常见叫法。' },
  flsd: { title: '表姐 / 表妹', note: '表亲称呼会受对方年龄影响，这里返回常见叫法。' },
  mobd: { title: '表姐 / 表妹', note: '表亲称呼会受对方年龄影响，这里返回常见叫法。' },
  mlbd: { title: '表姐 / 表妹', note: '表亲称呼会受对方年龄影响，这里返回常见叫法。' },
  mosd: { title: '表姐 / 表妹', note: '表亲称呼会受对方年龄影响，这里返回常见叫法。' },
  mlsd: { title: '表姐 / 表妹', note: '表亲称呼会受对方年龄影响，这里返回常见叫法。' },
  fossw: { title: '表嫂 / 表弟媳', note: '表亲配偶称呼会受对方年龄影响，这里返回常见叫法。' },
  flssw: { title: '表嫂 / 表弟媳', note: '表亲配偶称呼会受对方年龄影响，这里返回常见叫法。' },
  mobsw: { title: '表嫂 / 表弟媳', note: '表亲配偶称呼会受对方年龄影响，这里返回常见叫法。' },
  mlbsw: { title: '表嫂 / 表弟媳', note: '表亲配偶称呼会受对方年龄影响，这里返回常见叫法。' },
  mossw: { title: '表嫂 / 表弟媳', note: '表亲配偶称呼会受对方年龄影响，这里返回常见叫法。' },
  mlssw: { title: '表嫂 / 表弟媳', note: '表亲配偶称呼会受对方年龄影响，这里返回常见叫法。' },
  fosdh: { title: '表姐夫 / 表妹夫', note: '表亲配偶称呼会受对方年龄影响，这里返回常见叫法。' },
  flsdh: { title: '表姐夫 / 表妹夫', note: '表亲配偶称呼会受对方年龄影响，这里返回常见叫法。' },
  mobdh: { title: '表姐夫 / 表妹夫', note: '表亲配偶称呼会受对方年龄影响，这里返回常见叫法。' },
  mlbdh: { title: '表姐夫 / 表妹夫', note: '表亲配偶称呼会受对方年龄影响，这里返回常见叫法。' },
  mosdh: { title: '表姐夫 / 表妹夫', note: '表亲配偶称呼会受对方年龄影响，这里返回常见叫法。' },
  mlsdh: { title: '表姐夫 / 表妹夫', note: '表亲配偶称呼会受对方年龄影响，这里返回常见叫法。' },
  sss: { title: '曾孙' },
  ssd: { title: '曾孙女' },
  sds: { title: '曾外孙' },
  sdd: { title: '曾外孙女' },
  dss: { title: '外曾孙' },
  dsd: { title: '外曾孙女' },
  dds: { title: '外曾孙' },
  ddd: { title: '外曾孙女' },
  wmoss: {
    title: '表侄（妻表侄）',
    note: '随爱人一方通常称作“表侄”，书面上也会称“妻姨侄男”。',
  },
  wmlss: {
    title: '表侄（妻表侄）',
    note: '随爱人一方通常称作“表侄”，书面上也会称“妻姨侄男”。',
  },
  wmoshss: {
    title: '表侄（妻表侄）',
    note: '“姨妈的老公的儿子”与“姨妈的儿子”指向同一支亲属时，常用称呼相同。',
  },
  wmlshss: {
    title: '表侄（妻表侄）',
    note: '“姨妈的老公的儿子”与“姨妈的儿子”指向同一支亲属时，常用称呼相同。',
  },
  hmoss: {
    title: '表侄（夫表侄）',
    note: '随爱人一方通常称作“表侄”，书面上也会称“夫姨侄男”。',
  },
  hmlss: {
    title: '表侄（夫表侄）',
    note: '随爱人一方通常称作“表侄”，书面上也会称“夫姨侄男”。',
  },
  hmoshss: {
    title: '表侄（夫表侄）',
    note: '“姨妈的老公的儿子”与“姨妈的儿子”指向同一支亲属时，常用称呼相同。',
  },
  hmlshss: {
    title: '表侄（夫表侄）',
    note: '“姨妈的老公的儿子”与“姨妈的儿子”指向同一支亲属时，常用称呼相同。',
  },
}

const maleRelationTokens = new Set([
  '爸爸',
  '哥哥',
  '弟弟',
  '老公',
  '儿子',
  '爷爷',
  '外公',
  '伯父',
  '叔叔',
  '舅舅',
  '姑父',
  '姨父',
  '姐夫',
  '妹夫',
  '公公',
  '岳父',
  '女婿',
  '孙子',
  '外孙',
  '侄子',
  '外甥',
])

const getEmptyResult = (): RelationResult => ({
  hasResult: false,
  title: '--',
  relationPath: '',
  badge: '待计算',
  note: '',
})

const getRelationGroups = (currentPersonGender: SelfGender): RelationGroup[] => {
  const spouseToken = currentPersonGender === 'female' ? '老公' : '老婆'
  const inLawTokens = currentPersonGender === 'female' ? ['公公', '婆婆'] : ['岳父', '岳母']

  return [
    {
      title: '直系长辈',
      items: ['爸爸', '妈妈', '爷爷', '奶奶', '外公', '外婆'],
    },
    {
      title: '平辈与配偶',
      items: ['哥哥', '弟弟', '姐姐', '妹妹', spouseToken, '嫂子', '弟妹', '姐夫', '妹夫'],
    },
    {
      title: '旁系长辈',
      items: ['伯父', '伯母', '叔叔', '婶子', '姑妈', '姑父', '舅舅', '舅妈', '姨妈', '姨夫'],
    },
    {
      title: '配偶父母',
      items: inLawTokens,
    },
    {
      title: '子女与配偶',
      items: ['儿子', '儿媳', '女儿', '女婿'],
    },
    {
      title: '侄甥与孙辈',
      items: ['侄子', '侄女', '外甥', '外甥女', '孙子', '孙女', '外孙', '外孙女'],
    },
  ]
}

const getExampleQueries = (selfGender: SelfGender) => {
  const spousePrefix = selfGender === 'female' ? '我老公' : '我媳妇'

  return [
    '爸爸的姐姐的儿子',
    '妈妈的哥哥',
    selfGender === 'female' ? '老公的妈妈' : '老婆的妈妈',
    `${spousePrefix}的妈的姐姐的老公的儿子的儿子`,
    `${spousePrefix}的妈的姐姐的儿子的儿子`,
  ]
}

const getCurrentPersonGender = (selfGender: SelfGender, relationSteps: string[]) => {
  const lastToken = relationSteps[relationSteps.length - 1]

  if (!lastToken) return selfGender
  return maleRelationTokens.has(lastToken) ? 'male' : 'female'
}

const getDraftCapability = (stepCount: number, allTokensValid: boolean) => {
  const canAppendMore = allTokensValid && stepCount < MAX_RELATION_STEPS

  return {
    canAppendMore,
    canUseDraft: !stepCount || (allTokensValid && stepCount <= MAX_RELATION_STEPS),
  }
}

const normalizeInput = (value: string) =>
  String(value || '')
    .trim()
    .replace(/[，,、\s]+/g, '')
    .replace(/之/g, '的')
    .replace(/^我(?:的)?/, '')
    .replace(/^的+|的+$/g, '')
    .replace(/的{2,}/g, '的')

const getDraftMeta = (value: string) => {
  const normalized = normalizeInput(value)

  if (!normalized) {
    return {
      normalized: '',
      relationSteps: [] as string[],
      relationPath: '',
      canAppendMore: true,
      canUseDraft: true,
    }
  }

  const rawSteps = normalized.split('的').filter(Boolean)
  const relationSteps = rawSteps.map((item) => tokenAliases[item] || item)
  const relationPath = relationSteps.reduce((total, item) => total + (tokenToPath[item] || ''), '')
  const allTokensValid = relationSteps.every((item) => Boolean(tokenToPath[item]))
  const capability = getDraftCapability(relationSteps.length, allTokensValid)

  return {
    normalized,
    relationSteps,
    relationPath,
    canAppendMore: capability.canAppendMore,
    canUseDraft: capability.canUseDraft,
  }
}

const parseRelation = (
  value: string,
): { relationPath: string; relationSteps: string[] } | { error: string } => {
  const normalized = normalizeInput(value)

  if (!normalized) {
    return { error: '请输入关系链' }
  }

  const parts = normalized.split('的').filter(Boolean)

  if (parts.length > MAX_RELATION_STEPS) {
    return { error: APPEND_STOP_TOAST }
  }

  let relationPath = ''
  const relationSteps: string[] = []

  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index]
    const canonical = tokenAliases[part]

    if (!canonical) {
      return { error: `暂不支持“${part}”这种写法` }
    }

    relationPath += tokenToPath[canonical]
    relationSteps.push(canonical)
  }

  return { relationPath, relationSteps }
}

const resolveFallbackTitles = (relationSteps: string[], selfGender: SelfGender) => {
  try {
    const titles = relationship({
      text: relationSteps.join('的'),
      sex: selfGender === 'male' ? 1 : 0,
      type: 'default',
    })

    return Array.from(new Set(titles)).slice(0, 3)
  } catch (_error) {
    return []
  }
}

export default function RelationshipPage() {
  const [selfGender, setSelfGender] = useState<SelfGender>('female')
  const [relationInput, setRelationInput] = useState('')
  const [relationSteps, setRelationSteps] = useState<string[]>([])
  const [relationPath, setRelationPath] = useState('')
  const [canAppendMore, setCanAppendMore] = useState(true)
  const [result, setResult] = useState<RelationResult>(getEmptyResult())

  const currentPersonGender = useMemo(
    () => getCurrentPersonGender(selfGender, relationSteps),
    [relationSteps, selfGender],
  )
  const relationGroups = useMemo(
    () => getRelationGroups(currentPersonGender),
    [currentPersonGender],
  )
  const exampleQueries = useMemo(() => getExampleQueries(selfGender), [selfGender])

  useShareAppMessage(() => ({
    title: '亲戚关系怎么称呼？点一点就能算出来',
    path: '/packages/tools/relationship/relationship',
  }))

  useShareTimeline(() => ({
    title: '亲戚关系计算器：不再被称呼绕晕',
  }))

  const setDraftState = (value: string, nextResult?: RelationResult) => {
    const draft = getDraftMeta(value)
    setRelationInput(draft.normalized)
    setRelationSteps(draft.relationSteps)
    setRelationPath(draft.relationPath)
    setCanAppendMore(draft.canAppendMore)
    if (nextResult) setResult(nextResult)
  }

  const onCalculate = (silent = false, input = relationInput) => {
    const parsed = parseRelation(input)

    if ('error' in parsed) {
      if (!silent) {
        Taro.showToast({ title: parsed.error, icon: 'none' })
      }
      return
    }

    const resolved = relationTitleMap[parsed.relationPath]
    const fallbackTitles = resolved ? [] : resolveFallbackTitles(parsed.relationSteps, selfGender)
    const hasMultipleTitles = fallbackTitles.length > 1

    if (!resolved && !fallbackTitles.length) {
      if (!silent) {
        Taro.showToast({
          title: '这个关系有点复杂，试试换成更基础的叫法',
          icon: 'none',
        })
      }
      return
    }

    setResult({
      hasResult: true,
      title: resolved?.title || fallbackTitles.join(' / '),
      relationPath: parsed.relationPath,
      badge: (resolved?.note || hasMultipleTitles) ? '常见叫法' : '推荐称呼',
      note: resolved?.note || (hasMultipleTitles ? '具体称呼可能会受长幼、地域习惯影响。' : ''),
    })
  }

  const onGenderSelect = (gender: SelfGender) => {
    setSelfGender(gender)
    setResult(getEmptyResult())
  }

  const onAppendToken = (token: string) => {
    if (relationSteps.length && !canAppendMore) {
      Taro.showToast({ title: APPEND_STOP_TOAST, icon: 'none' })
      return
    }

    const currentValue = normalizeInput(relationInput)
    const nextValue = currentValue ? `${currentValue}的${token}` : token
    const nextDraft = getDraftMeta(nextValue)

    if (!nextDraft.canUseDraft) {
      Taro.showToast({ title: APPEND_STOP_TOAST, icon: 'none' })
      return
    }

    setDraftState(nextValue, getEmptyResult())
    onCalculate(true, nextValue)
  }

  const onDeleteStep = () => {
    const currentValue = normalizeInput(relationInput)
    if (!currentValue) return

    const parts = currentValue.split('的').filter(Boolean)
    parts.pop()
    const nextValue = parts.join('的')

    setDraftState(nextValue, getEmptyResult())

    if (parts.length) {
      onCalculate(true, nextValue)
    } else {
      setResult(getEmptyResult())
    }
  }

  const onClear = () => {
    setDraftState('', getEmptyResult())
  }

  const onExampleTap = (query: string) => {
    setDraftState(query, getEmptyResult())
    onCalculate(true, query)
  }

  return (
    <View className='shell'>
      <NavigationBar title='亲戚关系计算器' background='var(--s-1-weak, #f5f7fa)' />
      <ScrollView className='page-scroll' scrollY enhanced showScrollbar={false}>
        <View className='page'>
          <ToolIntroCard
            title='一键算出该怎么称呼'
            description='输入“爸爸的姐姐的儿子”这类关系链，快速得到常见叫法。'
          />

          <View className='card'>
            <Text className='card__title'>关系输入</Text>

            <View className='gender-row'>
              <Text className='field-label'>我是</Text>
              <View className='segment-row gender-segment'>
                <View
                  className={`segment-item ${selfGender === 'male' ? 'is-active' : ''}`}
                  onClick={() => onGenderSelect('male')}
                >
                  男性
                </View>
                <View
                  className={`segment-item ${selfGender === 'female' ? 'is-active' : ''}`}
                  onClick={() => onGenderSelect('female')}
                >
                  女性
                </View>
              </View>
            </View>

            <View className='builder-card'>
              <Text className='field-label'>关系路径</Text>

              {relationSteps.length ? (
                <View className='path-card'>
                  {relationSteps.map((item, index) => (
                    <View key={`${item}-${index}`} className='path-segment'>
                      {index > 0 ? <Text className='path-arrow'>›</Text> : null}
                      <Text className='path-chip'>{item}</Text>
                    </View>
                  ))}
                </View>
              ) : null}

              {relationSteps.length && !canAppendMore ? (
                <Text className='path-limit'>{APPEND_STOP_TEXT}</Text>
              ) : null}

              <View className='result-card inline-result-card'>
                <View className='result-head'>
                  <View>
                    <Text className='result-label'>计算结果</Text>
                    <Text className='result-value'>{result.title}</Text>
                  </View>
                  <Text className='result-badge'>{result.badge}</Text>
                </View>
                {!result.hasResult ? (
                  <Text className='result-empty'>选好关系后，结果会显示在这里。</Text>
                ) : null}
                {result.note ? <Text className='result-note'>{result.note}</Text> : null}
              </View>

              <View className='builder-actions'>
                <View className='builder-action' onClick={onClear}>
                  清空
                </View>
                <View className='builder-action builder-action-delete' onClick={onDeleteStep}>
                  删除一步
                </View>
              </View>
            </View>

            <Text className='helper-note'>
              直接用下面的常见关系词来拼，最多支持 {MAX_RELATION_STEPS} 层。配偶和配偶父母会按当前路径最后一人的性别自动切换。
            </Text>

            <View className='chip-row example-row'>
              {exampleQueries.map((item) => (
                <Text key={item} className='chip example-chip' onClick={() => onExampleTap(item)}>
                  {item}
                </Text>
              ))}
            </View>

            <View className='relation-groups'>
              {relationGroups.map((group) => (
                <View key={group.title} className='group-card'>
                  <Text className='field-label group-title'>{group.title}</Text>
                  <View className='chip-row token-grid'>
                    {group.items.map((item) => (
                      <Text key={item} className='chip token-chip' onClick={() => onAppendToken(item)}>
                        {item}
                      </Text>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  )
}
