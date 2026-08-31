import Taro from '@tarojs/taro'

export const DRAFT_STORAGE_KEY = 'poker_ledger_draft_v1'
export const SESSION_STORAGE_KEY = 'poker_ledger_sessions_v1'
export const MAX_PLAYERS = 8

export interface Player {
  id: string
  name: string
}

export interface LedgerRecord {
  id: string
  loserId: string
  winnerId: string
  amount: number
  note: string
  createdAt: number
}

export interface Draft {
  activeSessionId: string
  draftStartedAt: number
  sessionTitle: string
  playerNameInput: string
  players: Player[]
  selectedLoserId: string
  selectedWinnerId: string
  amountInput: string
  noteInput: string
  records: LedgerRecord[]
}

export interface NetPlayer {
  id: string
  name: string
  net: number
  netText: string
  statusText: string
  toneClass: string
}

export interface Transfer {
  id: string
  fromName: string
  toName: string
  amount: number
  amountText: string
}

export interface Summary {
  totalRounds: string
  totalAmount: string
  transferCount: string
  netPlayers: NetPlayer[]
  transfers: Transfer[]
}

export interface RecordView extends LedgerRecord {
  loserName: string
  winnerName: string
  amountText: string
  noteText: string
}

export interface SavedSession {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  players: Player[]
  records: LedgerRecord[]
  summary: Summary
  savedAtText: string
  metaText: string
  totalAmountText: string
}

export interface SelectedPlayerState {
  selectedLoserName: string
  selectedWinnerName: string
  selectedLoserIndex: number
  selectedWinnerIndex: number
  selectedPreviewText: string
}

export const createId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

export const formatAmount = (value: number | string | undefined) => Number(value || 0)
  .toFixed(2)
  .replace(/\.00$/, '')
  .replace(/(\.\d*[1-9])0+$/, '$1')

export const formatDateTime = (timestamp: number) => {
  const date = new Date(timestamp)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')

  return `${year}-${month}-${day} ${hour}:${minute}`
}

const getDayKey = (timestamp: number) => formatDateTime(timestamp).slice(0, 10)

const formatDateShort = (timestamp: number) => getDayKey(timestamp).slice(5)

const getPlayerTitlePart = (players: Player[] = []) => {
  const names = players
    .map((item) => String(item.name || '').trim())
    .filter(Boolean)

  if (!names.length) return '牌局'
  if (names.length <= 2) return names.join('、')

  return `${names.slice(0, 2).join('、')}等${names.length}人`
}

const getTitleRoundNumber = (title = '') => {
  const match = String(title).match(/第(\d+)局/)
  return match ? Number(match[1]) : 0
}

const getSessionRoundNumber = (sessions: Array<{ id: string; title?: string; createdAt?: number; updatedAt?: number }>, sessionId: string, createdAt: number) => {
  const dayKey = getDayKey(createdAt)
  const sameDaySessions = sessions.filter((item) => getDayKey(item.createdAt || item.updatedAt || Date.now()) === dayKey)
  const existingSession = sameDaySessions.find((item) => item.id === sessionId)
  const existingRound = getTitleRoundNumber(existingSession?.title)

  if (existingRound) return existingRound

  if (existingSession) {
    return sameDaySessions
      .slice()
      .sort((a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0))
      .findIndex((item) => item.id === sessionId) + 1
  }

  const maxRound = sameDaySessions.reduce((max, item) => Math.max(max, getTitleRoundNumber(item.title)), 0)
  return maxRound ? maxRound + 1 : sameDaySessions.length + 1
}

export const buildSessionTitle = ({
  sessions,
  sessionId,
  createdAt,
  players,
}: {
  sessions: Array<{ id: string; title?: string; createdAt?: number; updatedAt?: number }>
  sessionId: string
  createdAt: number
  players: Player[]
}) => (
  `${formatDateShort(createdAt)} ${getPlayerTitlePart(players)} 第${getSessionRoundNumber(sessions, sessionId, createdAt)}局`
)

export const getDefaultDraft = (): Draft => ({
  activeSessionId: '',
  draftStartedAt: Date.now(),
  sessionTitle: '',
  playerNameInput: '',
  players: [],
  selectedLoserId: '',
  selectedWinnerId: '',
  amountInput: '',
  noteInput: '',
  records: [],
})

export const getEmptySummary = (): Summary => ({
  totalRounds: '0',
  totalAmount: '0',
  transferCount: '0',
  netPlayers: [],
  transfers: [],
})

export const clonePlayers = (players: Player[] = []): Player[] => players.map((item) => ({
  id: item.id,
  name: item.name,
}))

export const cloneRecords = (records: LedgerRecord[] = []): LedgerRecord[] => records.map((item) => ({
  id: item.id,
  loserId: item.loserId,
  winnerId: item.winnerId,
  amount: Number(item.amount || 0),
  note: item.note || '',
  createdAt: item.createdAt || Date.now(),
}))

export const buildRecordViews = (players: Player[], records: LedgerRecord[]): RecordView[] => {
  const playerMap = players.reduce<Record<string, string>>((map, item) => {
    map[item.id] = item.name
    return map
  }, {})

  return records.map((item) => ({
    ...item,
    loserName: playerMap[item.loserId] || '未知玩家',
    winnerName: playerMap[item.winnerId] || '未知玩家',
    amountText: formatAmount(item.amount),
    noteText: item.note || '',
  }))
}

export const buildSelectedPlayerState = (
  players: Player[],
  loserId: string,
  winnerId: string,
): SelectedPlayerState => {
  const loserIndex = players.findIndex((item) => item.id === loserId)
  const winnerIndex = players.findIndex((item) => item.id === winnerId)

  return {
    selectedLoserName: loserIndex >= 0 ? players[loserIndex].name : '',
    selectedWinnerName: winnerIndex >= 0 ? players[winnerIndex].name : '',
    selectedLoserIndex: loserIndex >= 0 ? loserIndex : 0,
    selectedWinnerIndex: winnerIndex >= 0 ? winnerIndex : 0,
    selectedPreviewText: loserIndex >= 0 && winnerIndex >= 0
      ? `${players[loserIndex].name} 输给 ${players[winnerIndex].name}`
      : '先选好这笔是谁输给谁',
  }
}

export const buildSummary = (players: Player[], records: LedgerRecord[]): Summary => {
  if (!players.length) {
    return getEmptySummary()
  }

  const balances = players.reduce<Record<string, number>>((map, item) => {
    map[item.id] = 0
    return map
  }, {})

  let totalAmount = 0

  records.forEach((item) => {
    const amount = Number(item.amount || 0)

    if (!Object.prototype.hasOwnProperty.call(balances, item.loserId) ||
      !Object.prototype.hasOwnProperty.call(balances, item.winnerId) ||
      amount <= 0) {
      return
    }

    balances[item.loserId] -= amount
    balances[item.winnerId] += amount
    totalAmount += amount
  })

  const netPlayers: NetPlayer[] = players.map((item) => {
    const net = Number((balances[item.id] || 0).toFixed(2))

    return {
      id: item.id,
      name: item.name,
      net,
      netText: net > 0 ? `+${formatAmount(net)}` : formatAmount(net),
      statusText: net > 0 ? '赢' : net < 0 ? '输' : '平',
      toneClass: net > 0 ? 'is-positive' : net < 0 ? 'is-negative' : 'is-flat',
    }
  })

  const creditors = netPlayers
    .filter((item) => item.net > 0)
    .map((item) => ({ id: item.id, name: item.name, amount: item.net }))
    .sort((a, b) => b.amount - a.amount)

  const debtors = netPlayers
    .filter((item) => item.net < 0)
    .map((item) => ({ id: item.id, name: item.name, amount: Math.abs(item.net) }))
    .sort((a, b) => b.amount - a.amount)

  const transfers: Transfer[] = []
  let creditorIndex = 0
  let debtorIndex = 0

  while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
    const creditor = { ...creditors[creditorIndex] }
    const debtor = { ...debtors[debtorIndex] }
    const amount = Number(Math.min(creditor.amount, debtor.amount).toFixed(2))

    transfers.push({
      id: `${debtor.id}_${creditor.id}_${transfers.length}`,
      fromName: debtor.name,
      toName: creditor.name,
      amount,
      amountText: formatAmount(amount),
    })

    creditor.amount = Number((creditor.amount - amount).toFixed(2))
    debtor.amount = Number((debtor.amount - amount).toFixed(2))

    if (creditor.amount <= 0.009) creditorIndex += 1
    if (debtor.amount <= 0.009) debtorIndex += 1
  }

  return {
    totalRounds: String(records.length),
    totalAmount: formatAmount(totalAmount),
    transferCount: String(transfers.length),
    netPlayers,
    transfers,
  }
}

export const normalizeDraft = (draft: Partial<Draft> = {}): Draft => ({
  activeSessionId: draft.activeSessionId || '',
  draftStartedAt: draft.draftStartedAt || Date.now(),
  sessionTitle: draft.sessionTitle || '',
  playerNameInput: draft.playerNameInput || '',
  players: clonePlayers(draft.players),
  selectedLoserId: draft.selectedLoserId || '',
  selectedWinnerId: draft.selectedWinnerId || '',
  amountInput: draft.amountInput || '',
  noteInput: draft.noteInput || '',
  records: cloneRecords(draft.records),
})

export const isDraftEmpty = (draft: Draft) => (
  !String(draft.sessionTitle || '').trim()
  && !String(draft.playerNameInput || '').trim()
  && !String(draft.amountInput || '').trim()
  && !String(draft.noteInput || '').trim()
  && !draft.players.length
  && !draft.records.length
  && !draft.selectedLoserId
  && !draft.selectedWinnerId
)

export const readSessions = (): Array<Omit<SavedSession, 'summary' | 'savedAtText' | 'metaText' | 'totalAmountText'>> => {
  const stored = Taro.getStorageSync(SESSION_STORAGE_KEY)
  return Array.isArray(stored) ? stored : []
}

export const writeSessions = (sessions: unknown[]) => {
  Taro.setStorageSync(SESSION_STORAGE_KEY, sessions)
}

export const persistDraft = (draft: Draft) => {
  if (isDraftEmpty(draft)) {
    Taro.removeStorageSync(DRAFT_STORAGE_KEY)
    return
  }

  Taro.setStorageSync(DRAFT_STORAGE_KEY, draft)
}

export const mapSavedSessions = (sessions: ReturnType<typeof readSessions>): SavedSession[] => (
  sessions
    .slice()
    .sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))
    .map((item) => {
      const players = clonePlayers(item.players)
      const records = cloneRecords(item.records)
      const summary = buildSummary(players, records)

      return {
        ...item,
        players,
        records,
        summary,
        savedAtText: formatDateTime(item.updatedAt || item.createdAt || Date.now()),
        metaText: `${players.length} 人 · ${records.length} 笔`,
        totalAmountText: summary.totalAmount,
      }
    })
)

export const loadStoredDraft = (): Draft => {
  const storedDraft = Taro.getStorageSync(DRAFT_STORAGE_KEY)
  return normalizeDraft(storedDraft || getDefaultDraft())
}
