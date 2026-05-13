import { z } from 'zod/v4'
import { eq, and } from 'drizzle-orm'
import { requireAdmin } from '../../../../utils/requireAdmin'
import { useDb } from '../../../../infrastructure/db/drizzle'
import { driverProfiles, account } from '../../../../infrastructure/db/schema'
import { useAuth } from '../../../../infrastructure/auth/better-auth'
import { parseBody } from '../../../../shared/contracts/validation'

const Schema = z.object({
  password: z.string().min(6, '密碼至少 6 個字元').max(128),
})

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const driverProfileId = getRouterParam(event, 'id')
  if (!driverProfileId) {
    throw createError({ statusCode: 400, statusMessage: 'driver id required' })
  }

  const { password } = await parseBody(event, Schema)

  const db = useDb()
  const dRows = await db.select({ userId: driverProfiles.userId })
    .from(driverProfiles)
    .where(eq(driverProfiles.id, driverProfileId))
    .limit(1)
  const driver = dRows[0]
  if (!driver) {
    throw createError({ statusCode: 404, statusMessage: '找不到此司機' })
  }

  // 用 better-auth 內部 API hash + 寫入 credential account
  const auth = useAuth()
  const ctx = await (auth as any).$context
  const hashed = await ctx.password.hash(password)

  const existing = await db.select({ id: account.id })
    .from(account)
    .where(and(eq(account.userId, driver.userId), eq(account.providerId, 'credential')))
    .limit(1)

  if (existing.length > 0) {
    // 已有 credential account → 直接更新（用 better-auth internalAdapter 保持一致行為）
    try {
      await ctx.internalAdapter.updatePassword(driver.userId, hashed)
    } catch {
      // fallback：直接更新 DB
      await db.update(account)
        .set({ password: hashed, updatedAt: new Date() })
        .where(eq(account.id, existing[0]!.id))
    }
  } else {
    // 沒有 credential account（例如僅用 OAuth 註冊）→ 建一筆
    await db.insert(account).values({
      id: crypto.randomUUID(),
      accountId: driver.userId,
      providerId: 'credential',
      userId: driver.userId,
      password: hashed,
    } as any)
  }

  // 撤銷該使用者所有 session（強制重新登入）
  try {
    await ctx.internalAdapter.deleteSessions(driver.userId)
  } catch {
    // 忽略，密碼已成功更新
  }

  return { success: true }
})
