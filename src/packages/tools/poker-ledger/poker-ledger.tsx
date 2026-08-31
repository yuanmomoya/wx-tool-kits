import { useCallback, useEffect, useState } from 'react'
import { Input, Picker, ScrollView, Text, View } from '@tarojs/components'
import Taro, { useShareAppMessage, useShareTimeline } from '@tarojs/taro'

import NavigationBar from '@/components/NavigationBar'
import ToolIntroCard from '@/packages/tools/components/ToolIntroCard'
import { removePlayerAndRecords } from './poker-ledger.logic'
import {
  MAX_PLAYERS,
  buildRecordViews,
  buildSelectedPlayerState,
  buildSessionTitle,
  buildSummary,
  clonePlayers,
  cloneRecords,
  createId,
  getDefaultDraft,
  getEmptySummary,
  loadStoredDraft,
  mapSavedSessions,
  persistDraft,
  readSessions,
  writeSessions,
  type Draft,
  type RecordView,
  type SavedSession,
  type SelectedPlayerState,
  type Summary,
} from '@/utils/poker-ledger'

import './poker-ledger.scss'

type DraftField = 'playerNameInput' | 'amountInput' | 'noteInput'

export default function PokerLedgerPage() {
  const [draft, setDraft] = useState<Draft>(getDefaultDraft)
  const [summary, setSummary] = useState<Summary>(getEmptySummary)
  const [recordsView, setRecordsView] = useState<RecordView[]>([])
  const [selectedState, setSelectedState] = useState<SelectedPlayerState>(
    buildSelectedPlayerState([], '', ''),
  )
  const [savedSessions, setSavedSessions] = useState<SavedSession[]>([])

  const refreshDerived = useCallback((nextDraft: Draft) => {
    setSummary(buildSummary(nextDraft.players, nextDraft.records))
    setRecordsView(buildRecordViews(nextDraft.players, nextDraft.records))
    setSelectedState(buildSelectedPlayerState(
      nextDraft.players,
      nextDraft.selectedLoserId,
      nextDraft.selectedWinnerId,
    ))
  }, [])

  const applyDraft = useCallback((nextDraft: Draft, shouldPersist = true) => {
    setDraft(nextDraft)
    refreshDerived(nextDraft)
    if (shouldPersist) persistDraft(nextDraft)
  }, [refreshDerived])

  const loadLocalData = useCallback(() => {
    const nextDraft = loadStoredDraft()
    setDraft(nextDraft)
    refreshDerived(nextDraft)
    setSavedSessions(mapSavedSessions(readSessions()))
  }, [refreshDerived])

  useEffect(() => {
    loadLocalData()
  }, [loadLocalData])

  const refreshSavedSessions = () => {
    setSavedSessions(mapSavedSessions(readSessions()))
  }

  const onInput = (field: DraftField, value: string) => {
    applyDraft({ ...draft, [field]: value })
  }

  const onAddPlayer = () => {
    const name = String(draft.playerNameInput || '').trim()

    if (!name) {
      Taro.showToast({ title: '先输入玩家名字', icon: 'none' })
      return
    }

    if (draft.players.length >= MAX_PLAYERS) {
      Taro.showToast({ title: `最多支持 ${MAX_PLAYERS} 人`, icon: 'none' })
      return
    }

    if (draft.players.some((item) => item.name === name)) {
      Taro.showToast({ title: '玩家名字不要重复', icon: 'none' })
      return
    }

    applyDraft({
      ...draft,
      players: [...draft.players, { id: createId('player'), name }],
      playerNameInput: '',
    })
  }

  const removePlayer = (id: string) => {
    const player = draft.players.find((item) => item.id === id)
    if (!player) return

    const relatedRecordCount = draft.records.filter((item) => (
      item.loserId === id || item.winnerId === id
    )).length

    const { players, records } = removePlayerAndRecords(draft.players, draft.records, id)

    applyDraft({
      ...draft,
      players,
      records,
      selectedLoserId: draft.selectedLoserId === id ? '' : draft.selectedLoserId,
      selectedWinnerId: draft.selectedWinnerId === id ? '' : draft.selectedWinnerId,
    })

    Taro.showToast({
      title: relatedRecordCount ? `已移除 ${player.name} 和相关记录` : `已移除 ${player.name}`,
      icon: 'none',
    })
  }

  const onRemovePlayer = (id: string) => {
    const player = draft.players.find((item) => item.id === id)
    if (!player) return

    const relatedRecordCount = draft.records.filter((item) => (
      item.loserId === id || item.winnerId === id
    )).length

    if (relatedRecordCount) {
      Taro.showModal({
        title: '移除玩家',
        content: `${player.name} 关联了 ${relatedRecordCount} 笔记录，移除后这些记录也会删除。`,
        confirmText: '移除',
        confirmColor: '#c56b6b',
        success: ({ confirm }) => {
          if (confirm) removePlayer(id)
        },
      })
      return
    }

    removePlayer(id)
  }

  const onPickerChange = (role: 'loser' | 'winner', index: number) => {
    const player = draft.players[index]
    if (!player) return

    if (role === 'loser' && player.id === draft.selectedWinnerId) {
      Taro.showToast({ title: '输家和赢家不能选同一个人', icon: 'none' })
      return
    }

    if (role === 'winner' && player.id === draft.selectedLoserId) {
      Taro.showToast({ title: '输家和赢家不能选同一个人', icon: 'none' })
      return
    }

    applyDraft({
      ...draft,
      selectedLoserId: role === 'loser' ? player.id : draft.selectedLoserId,
      selectedWinnerId: role === 'winner' ? player.id : draft.selectedWinnerId,
    })
  }

  const onAddRecord = () => {
    const amount = Number(draft.amountInput)
    const { selectedLoserId: loserId, selectedWinnerId: winnerId } = draft
    const note = String(draft.noteInput || '').trim()

    if (draft.players.length < 2) {
      Taro.showToast({ title: '至少先添加 2 个玩家', icon: 'none' })
      return
    }

    if (!loserId || !winnerId) {
      Taro.showToast({ title: '先选输家和赢家', icon: 'none' })
      return
    }

    if (loserId === winnerId) {
      Taro.showToast({ title: '输家和赢家不能是同一人', icon: 'none' })
      return
    }

    if (!amount || amount <= 0) {
      Taro.showToast({ title: '请输入正确金额', icon: 'none' })
      return
    }

    applyDraft({
      ...draft,
      records: [
        ...draft.records,
        {
          id: createId('record'),
          loserId,
          winnerId,
          amount: Number(amount.toFixed(2)),
          note,
          createdAt: Date.now(),
        },
      ],
      amountInput: '',
      noteInput: '',
    })
  }

  const onDeleteRecord = (id: string) => {
    applyDraft({
      ...draft,
      records: draft.records.filter((item) => item.id !== id),
    })
  }

  const getResolvedTitle = ({
    sessions,
    sessionId,
    createdAt,
  }: {
    sessions: ReturnType<typeof readSessions>
    sessionId: string
    createdAt: number
  }) => buildSessionTitle({
    sessions,
    sessionId,
    createdAt,
    players: draft.players,
  })

  const onSaveSession = () => {
    if (!draft.players.length || !draft.records.length) {
      Taro.showToast({ title: '先记几笔再保存', icon: 'none' })
      return
    }

    const sessions = readSessions()
    const now = Date.now()
    const sessionId = draft.activeSessionId || createId('session')
    const existingIndex = sessions.findIndex((item) => item.id === sessionId)
    const createdAt = existingIndex >= 0 ? sessions[existingIndex].createdAt : draft.draftStartedAt
    const sessionPayload = {
      id: sessionId,
      title: getResolvedTitle({ sessions, sessionId, createdAt }),
      createdAt,
      updatedAt: now,
      players: clonePlayers(draft.players),
      records: cloneRecords(draft.records),
    }

    if (existingIndex >= 0) {
      sessions.splice(existingIndex, 1, sessionPayload)
    } else {
      sessions.unshift(sessionPayload)
    }

    writeSessions(sessions)
    applyDraft({ ...draft, activeSessionId: sessionId, sessionTitle: '' })
    refreshSavedSessions()

    Taro.showToast({
      title: existingIndex >= 0 ? '已更新到本机' : '已保存到本机',
      icon: 'none',
    })
  }

  const onLoadSession = (id: string) => {
    const session = readSessions().find((item) => item.id === id)

    if (!session) {
      Taro.showToast({ title: '这局记录没找到', icon: 'none' })
      refreshSavedSessions()
      return
    }

    const nextDraft = {
      activeSessionId: session.id,
      draftStartedAt: session.createdAt || Date.now(),
      sessionTitle: session.title || '',
      playerNameInput: '',
      players: clonePlayers(session.players),
      selectedLoserId: '',
      selectedWinnerId: '',
      amountInput: '',
      noteInput: '',
      records: cloneRecords(session.records),
    }

    applyDraft(nextDraft)
    Taro.showToast({ title: '已载入这局牌', icon: 'none' })
  }

  const onDeleteSession = (id: string) => {
    const target = savedSessions.find((item) => item.id === id)
    if (!target) return

    Taro.showModal({
      title: '删除牌局',
      content: `确认删除“${target.title}”吗？`,
      success: ({ confirm }) => {
        if (!confirm) return

        const sessions = readSessions().filter((item) => item.id !== id)
        writeSessions(sessions)
        refreshSavedSessions()

        if (draft.activeSessionId === id) {
          applyDraft(getDefaultDraft())
        }

        Taro.showToast({ title: '已删除', icon: 'none' })
      },
    })
  }

  const resetDraft = () => {
    applyDraft(getDefaultDraft())
  }

  const onNewSession = () => {
    const hasContent = draft.players.length || draft.records.length

    if (!hasContent) {
      resetDraft()
      return
    }

    Taro.showModal({
      title: '开始新牌局',
      content: '当前编辑中的内容会清空，已保存到本机的历史牌局不会受影响。',
      success: ({ confirm }) => {
        if (confirm) resetDraft()
      },
    })
  }

  useShareAppMessage(() => ({
    title: '打牌记账不用算半天，输赢结算自动汇总',
    path: '/packages/tools/poker-ledger/poker-ledger',
  }))

  useShareTimeline(() => ({
    title: '打牌记账工具：记录输赢，自动算谁付谁',
  }))

  const renderSelectorRow = (role: 'loser' | 'winner') => {
    const isLoser = role === 'loser'
    const label = isLoser ? '输' : '赢'
    const toneClass = isLoser ? 'tone-loser' : 'tone-winner'
    const textClass = isLoser ? 'loser' : 'winner'
    const fieldLabel = isLoser ? '输家' : '赢家'
    const selectedName = isLoser ? selectedState.selectedLoserName : selectedState.selectedWinnerName
    const selectedIndex = isLoser ? selectedState.selectedLoserIndex : selectedState.selectedWinnerIndex

    if (draft.players.length < 2) {
      return (
        <View className='field-row compact selector-row is-disabled'>
          <View className={`field-icon ${toneClass}`}>
            <Text className={`field-icon-text ${textClass}`}>{label}</Text>
          </View>
          <View className='field-main'>
            <Text className='field-label'>{fieldLabel}</Text>
            <Text className='selector-value'>先添加至少 2 位玩家</Text>
          </View>
        </View>
      )
    }

    return (
      <Picker
        mode='selector'
        range={draft.players}
        rangeKey='name'
        value={selectedIndex}
        onChange={(e) => onPickerChange(role, Number(e.detail.value))}
      >
        <View className='field-row compact selector-row'>
          <View className={`field-icon ${toneClass}`}>
            <Text className={`field-icon-text ${textClass}`}>{label}</Text>
          </View>
          <View className='field-main'>
            <Text className='field-label'>{fieldLabel}</Text>
            <Text className={`selector-value ${selectedName ? 'is-filled' : ''}`}>
              {selectedName || `点这里选择${fieldLabel}`}
            </Text>
          </View>
          <Text className='selector-action'>{selectedName ? '重选' : '选择'}</Text>
        </View>
      </Picker>
    )
  }

  return (
    <View className='shell'>
      <NavigationBar title='打牌记账' background='var(--s-1-weak, #f5f7fa)' />
      <ScrollView className='page-scroll' scrollY enhanced showScrollbar={false}>
        <View className='page'>
          <ToolIntroCard
            title='输赢记清，收局算清'
            description='单人本地记账，不联网也能自动结算谁付谁。'
          />

          <View className='form-card form-card--first'>
            <Text className='card-title'>当前牌局</Text>

            <View className='field-list'>
              <View className='field-row'>
                <View className='field-icon tone-player'>
                  <Text className='field-icon-emoji'>👥</Text>
                </View>
                <View className='field-main'>
                  <Text className='field-label'>添加玩家</Text>
                  <View className='player-input-row'>
                    <Input
                      className='field-input player-input'
                      type='text'
                      value={draft.playerNameInput}
                      placeholder='输入玩家名字'
                      placeholderClass='input-placeholder'
                      onInput={(e) => onInput('playerNameInput', e.detail.value)}
                    />
                    <View className='mini-action' onClick={onAddPlayer}>添加</View>
                  </View>
                </View>
              </View>
            </View>

            <View className='player-section'>
              <Text className='section-label'>玩家名单</Text>
              {draft.players.length ? (
                <View className='player-list'>
                  {draft.players.map((item) => (
                    <View key={item.id} className='player-chip'>
                      <Text>{item.name}</Text>
                      <View className='player-chip-close' onClick={() => onRemovePlayer(item.id)}>
                        <Text className='chip-close-text'>×</Text>
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <Text className='empty-inline'>先加玩家，再开始记输赢。</Text>
              )}
            </View>

            <Text className='helper-note'>
              记录只保存在当前设备和当前微信里，不会同步到其他手机。记账时建议大家一起确认，收局结算更清楚。
            </Text>
          </View>

          <View className='form-card'>
            <Text className='card-title'>记一笔输赢</Text>

            <View className='field-list compact-fields'>
              {renderSelectorRow('loser')}
              {renderSelectorRow('winner')}
            </View>

            <View className={`selection-preview ${selectedState.selectedLoserName && selectedState.selectedWinnerName ? 'is-ready' : ''}`}>
              <Text>{selectedState.selectedPreviewText}</Text>
            </View>

            <View className='field-list compact-fields amount-fields'>
              <View className='field-row compact'>
                <View className='field-icon tone-amount'>
                  <Text className='field-icon-emoji'>¥</Text>
                </View>
                <View className='field-main'>
                  <Text className='field-label'>金额</Text>
                  <Input
                    className='field-input'
                    type='digit'
                    value={draft.amountInput}
                    placeholder='请输入金额'
                    placeholderClass='input-placeholder'
                    onInput={(e) => onInput('amountInput', e.detail.value)}
                  />
                </View>
                <Text className='field-unit'>元</Text>
              </View>

              <View className='field-row compact'>
                <View className='field-icon tone-note'>
                  <Text className='field-icon-emoji'>📝</Text>
                </View>
                <View className='field-main'>
                  <Text className='field-label'>备注</Text>
                  <Input
                    className='field-input'
                    type='text'
                    value={draft.noteInput}
                    placeholder='可选，例如自摸、包牌'
                    placeholderClass='input-placeholder'
                    onInput={(e) => onInput('noteInput', e.detail.value)}
                  />
                </View>
              </View>
            </View>

            <View className='button-row'>
              <View className='primary-btn' onClick={onAddRecord}>加入这一笔</View>
            </View>

            <View className='record-section'>
              <Text className='section-label'>当前记录</Text>
              {recordsView.length ? (
                <View className='record-list'>
                  {recordsView.map((item) => (
                    <View key={item.id} className='record-item'>
                      <View className='record-main'>
                        <Text className='record-title'>{item.loserName} → {item.winnerName}</Text>
                        {item.noteText ? <Text className='record-note'>{item.noteText}</Text> : null}
                      </View>
                      <View className='record-side'>
                        <Text className='record-amount'>{item.amountText} 元</Text>
                        <Text className='record-delete' onClick={() => onDeleteRecord(item.id)}>删除</Text>
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <Text className='empty-inline'>还没有记录，记上一笔就会自动开始结算。</Text>
              )}
            </View>
          </View>

          <View className='result-card'>
            <View className='settlement-head'>
              <View>
                <Text className='settlement-title'>自动结算</Text>
                <Text className='settlement-subtitle'>按净输赢合并，少转几笔也能算清。</Text>
              </View>
              <Text className='settlement-badge'>{summary.transferCount} 笔转账</Text>
            </View>

            <View className='settlement-stats'>
              <View className='stat-pill'>
                <Text className='stat-label'>玩家</Text>
                <Text className='stat-value'>{draft.players.length}人</Text>
              </View>
              <View className='stat-pill'>
                <Text className='stat-label'>记录</Text>
                <Text className='stat-value'>{summary.totalRounds}笔</Text>
              </View>
              <View className='stat-pill'>
                <Text className='stat-label'>流水</Text>
                <Text className='stat-value'>{summary.totalAmount}元</Text>
              </View>
            </View>

            <View className='detail-card'>
              <Text className='detail-title'>每人净输赢</Text>
              {summary.netPlayers.length ? (
                <View className='balance-list'>
                  {summary.netPlayers.map((item) => (
                    <View key={item.id} className={`balance-item ${item.toneClass}`}>
                      <Text className='balance-name'>{item.name}</Text>
                      <View className='balance-meta'>
                        <Text className='balance-status'>{item.statusText}</Text>
                        <Text className='balance-value'>{item.netText} 元</Text>
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <Text className='empty-inline'>先添加玩家，结算结果会显示在这里。</Text>
              )}

              <Text className='detail-title transfer-title'>建议结算</Text>
              {summary.transfers.length ? (
                <View className='transfer-list'>
                  {summary.transfers.map((item) => (
                    <View key={item.id} className='transfer-item'>
                      <Text className='transfer-text'>{item.fromName} 付给 {item.toName}</Text>
                      <Text className='transfer-value'>{item.amountText} 元</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text className='empty-inline'>记完输赢后，这里会自动算出谁付谁。</Text>
              )}
            </View>

            <View className='settlement-actions'>
              <View className='primary-btn save-button' onClick={onSaveSession}>保存到本机</View>
              <View className='new-session-link' onClick={onNewSession}>清空并新开一局</View>
            </View>
          </View>

          <View className='form-card'>
            <Text className='card-title'>本机牌局</Text>
            {savedSessions.length ? (
              <View className='saved-list'>
                {savedSessions.map((item) => (
                  <View key={item.id} className='saved-item'>
                    <View className='saved-main'>
                      <Text className='saved-title'>{item.title}</Text>
                      <Text className='saved-meta'>{item.metaText} · {item.savedAtText}</Text>
                      <Text className='saved-desc'>
                        当前流水 {item.totalAmountText} 元，建议结算 {item.summary.transferCount} 笔
                      </Text>
                    </View>
                    <View className='saved-actions'>
                      <Text className='saved-action' onClick={() => onLoadSession(item.id)}>继续记</Text>
                      <Text className='saved-action danger' onClick={() => onDeleteSession(item.id)}>删除</Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <Text className='empty-inline'>还没有保存过牌局，点上面的“保存到本机”后会出现在这里。</Text>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  )
}
