import { eq } from 'drizzle-orm'
import { useDb } from '../../infrastructure/db/drizzle'
import { systemSettings } from '../../infrastructure/db/schema'

const DEFAULT_TERMS = `本平台為長照接送媒合服務，司機加入需遵守下列事項：

1. 證件真實性：所提供之身分證、職業駕照、汽車行照需為真實有效，如有偽造或塗改即取消資格。
2. 保險義務：應自行維持有效之強制汽車責任保險與其他承保險種，並於到期前更新並通知平台。
3. 服務品質：對於每筆派遣應準時抵達、安全駕駛、並保持車輛清潔、無菸無異味。
4. 個案保密：對於接送之長照個案個人資料負保密義務，禁止對外揭露。
5. 平台抽成：平台得依公告之費率收取服務費，並以結算月報方式給付司機收入。
6. 違規處置：對個案有不當行為、未到場、酒駕等違規情事，平台得逕予停權並依法究責。
7. 終止合作：雙方得依本條款規範隨時終止合作關係，未結案件應完成後始得離隊。

完成註冊即視同您閱讀並同意上述條款。`

export default defineEventHandler(async () => {
  const db = useDb()
  const rows = await db.select({ value: systemSettings.value, updatedAt: systemSettings.updatedAt })
    .from(systemSettings)
    .where(eq(systemSettings.key, 'driver_terms_of_service'))
    .limit(1)

  return {
    content: rows[0]?.value || DEFAULT_TERMS,
    updatedAt: rows[0]?.updatedAt ?? null,
  }
})
