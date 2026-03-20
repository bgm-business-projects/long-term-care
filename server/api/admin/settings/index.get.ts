import { requireAdmin } from '../../../utils/requireAdmin'
import { useDb } from '../../../infrastructure/db/drizzle'
import { systemSettings } from '../../../infrastructure/db/schema'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const db = useDb()
  const settings = await db.select().from(systemSettings)
  // 回傳 key-value 物件，隱藏 google_maps_api_key 的值（只回傳是否已設定）
  return settings.map(s => ({
    key: s.key,
    hasValue: !!s.value,
    // 不回傳實際 value，避免洩漏
    value: s.key === 'google_maps_api_key' ? (s.value ? '••••••••' : '') : s.value,
    updatedAt: s.updatedAt,
  }))
})
