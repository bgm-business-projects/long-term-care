import { useDb } from '../infrastructure/db/drizzle'
import { systemSettings } from '../infrastructure/db/schema'
import { inArray } from 'drizzle-orm'

export interface CarpoolSettings {
  /** 共乘目的地最大距離（公尺）— 兩筆訂單目的地距離 < 此值才視為同一目的地 */
  maxDestinationDistanceMeters: number
  /** 共乘出發時間最大差距（分鐘）— 兩筆訂單 scheduledAt 差距 ≤ 此值才可同組 */
  maxDepartureWindowMinutes: number
}

const DEFAULTS: CarpoolSettings = {
  maxDestinationDistanceMeters: 500,
  maxDepartureWindowMinutes: 30,
}

const KEYS = {
  maxDistance: 'carpool.maxDestinationDistanceMeters',
  maxWindow: 'carpool.maxDepartureWindowMinutes',
} as const

export function useCarpoolSettings() {
  const db = useDb()

  return {
    get: async (): Promise<CarpoolSettings> => {
      const rows = await db
        .select({ key: systemSettings.key, value: systemSettings.value })
        .from(systemSettings)
        .where(inArray(systemSettings.key, [KEYS.maxDistance, KEYS.maxWindow]))

      const map = new Map(rows.map(r => [r.key, r.value]))
      const dist = Number(map.get(KEYS.maxDistance) ?? '')
      const win = Number(map.get(KEYS.maxWindow) ?? '')

      return {
        maxDestinationDistanceMeters: Number.isFinite(dist) && dist > 0 ? dist : DEFAULTS.maxDestinationDistanceMeters,
        maxDepartureWindowMinutes: Number.isFinite(win) && win > 0 ? win : DEFAULTS.maxDepartureWindowMinutes,
      }
    },

    set: async (s: Partial<CarpoolSettings>, updatedBy: string) => {
      const writes: Array<{ key: string; value: string }> = []
      if (s.maxDestinationDistanceMeters !== undefined) {
        writes.push({ key: KEYS.maxDistance, value: String(s.maxDestinationDistanceMeters) })
      }
      if (s.maxDepartureWindowMinutes !== undefined) {
        writes.push({ key: KEYS.maxWindow, value: String(s.maxDepartureWindowMinutes) })
      }
      for (const w of writes) {
        await db
          .insert(systemSettings)
          .values({ key: w.key, value: w.value, updatedBy })
          .onConflictDoUpdate({
            target: systemSettings.key,
            set: { value: w.value, updatedBy },
          })
      }
    },
  }
}
