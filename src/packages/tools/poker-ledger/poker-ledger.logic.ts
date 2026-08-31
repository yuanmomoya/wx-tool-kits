import type { LedgerRecord, Player } from '@/utils/poker-ledger'

export function removePlayerAndRecords(players: Player[], records: LedgerRecord[], playerId: string) {
  return {
    players: players.filter((player) => player.id !== playerId),
    records: records.filter((record) => record.loserId !== playerId && record.winnerId !== playerId),
  }
}
