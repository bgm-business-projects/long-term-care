import { eq, and, isNull, isNotNull, count, sql } from 'drizzle-orm'
import { useDb } from './drizzle'
import { redemptionCode, user } from './schema'
import type {
  IRedemptionCodeRepository,
  RedemptionCodeEntity,
  NewRedemptionCode,
  CodeFilter,
  Pagination,
} from '../../domain/subscription/IRedemptionCodeRepository'
import type { SubscriptionTier } from '../../domain/subscription/SubscriptionTier'

function rowToEntity(row: typeof redemptionCode.$inferSelect, usedByName?: string | null, usedByEmail?: string | null): RedemptionCodeEntity {
  return {
    id: row.id,
    code: row.code,
    tier: row.tier as SubscriptionTier,
    durationDays: row.durationDays,
    disabled: row.disabled,
    batchId: row.batchId,
    usedById: row.usedById,
    usedByName: usedByName ?? null,
    usedByEmail: usedByEmail ?? null,
    usedAt: row.usedAt,
    createdAt: row.createdAt,
  }
}

export class DrizzleRedemptionCodeRepository implements IRedemptionCodeRepository {
  private get db() {
    return useDb()
  }

  async findByCode(code: string): Promise<RedemptionCodeEntity | null> {
    const rows = await this.db.select().from(redemptionCode).where(eq(redemptionCode.code, code)).limit(1)
    return rows[0] ? rowToEntity(rows[0]) : null
  }

  async findById(id: string): Promise<RedemptionCodeEntity | null> {
    const rows = await this.db.select().from(redemptionCode).where(eq(redemptionCode.id, id)).limit(1)
    return rows[0] ? rowToEntity(rows[0]) : null
  }

  async markAsUsed(id: string, userId: string, usedAt: Date): Promise<void> {
    await this.db.update(redemptionCode).set({ usedById: userId, usedAt }).where(eq(redemptionCode.id, id))
  }

  async create(data: NewRedemptionCode): Promise<RedemptionCodeEntity> {
    const id = crypto.randomUUID()
    const now = new Date()
    await this.db.insert(redemptionCode).values({
      id,
      code: data.code,
      tier: data.tier,
      durationDays: data.durationDays,
      batchId: data.batchId ?? null,
      createdAt: now,
    })
    return {
      id,
      code: data.code,
      tier: data.tier as SubscriptionTier,
      durationDays: data.durationDays,
      disabled: false,
      batchId: data.batchId ?? null,
      usedById: null,
      usedByName: null,
      usedByEmail: null,
      usedAt: null,
      createdAt: now,
    }
  }

  async createBatch(codes: NewRedemptionCode[]): Promise<RedemptionCodeEntity[]> {
    const now = new Date()
    const rows = codes.map(c => ({
      id: crypto.randomUUID(),
      code: c.code,
      tier: c.tier,
      durationDays: c.durationDays,
      batchId: c.batchId ?? null,
      createdAt: now,
    }))
    await this.db.insert(redemptionCode).values(rows)
    return rows.map(r => ({
      ...r,
      tier: r.tier as SubscriptionTier,
      disabled: false,
      usedById: null,
      usedByName: null,
      usedByEmail: null,
      usedAt: null,
    }))
  }

  async findMany(filter: CodeFilter, pagination: Pagination): Promise<{ items: RedemptionCodeEntity[]; total: number }> {
    const conditions = [isNull(redemptionCode.deletedAt)]

    if (filter.tier) {
      conditions.push(eq(redemptionCode.tier, filter.tier))
    }

    if (filter.status === 'used') {
      conditions.push(isNotNull(redemptionCode.usedById))
    } else if (filter.status === 'unused') {
      conditions.push(isNull(redemptionCode.usedById))
      conditions.push(eq(redemptionCode.disabled, false))
    } else if (filter.status === 'disabled') {
      conditions.push(eq(redemptionCode.disabled, true))
    }

    const where = and(...conditions)

    const [items, totalResult] = await Promise.all([
      this.db.select({
        code: redemptionCode,
        userName: user.name,
        userEmail: user.email,
      }).from(redemptionCode)
        .leftJoin(user, eq(redemptionCode.usedById, user.id))
        .where(where)
        .orderBy(sql`${redemptionCode.createdAt} DESC`)
        .limit(pagination.pageSize)
        .offset((pagination.page - 1) * pagination.pageSize),
      this.db.select({ count: count() }).from(redemptionCode).where(where),
    ])

    return {
      items: items.map(row => rowToEntity(row.code, row.userName, row.userEmail)),
      total: totalResult[0]?.count ?? 0,
    }
  }

  async updateDisabled(id: string, disabled: boolean): Promise<void> {
    await this.db.update(redemptionCode).set({ disabled }).where(eq(redemptionCode.id, id))
  }

  async softDeleteUnused(id: string): Promise<boolean> {
    const result = await this.db.update(redemptionCode)
      .set({ deletedAt: new Date() })
      .where(and(
        eq(redemptionCode.id, id),
        isNull(redemptionCode.usedById),
        isNull(redemptionCode.deletedAt)
      ))
    return (result as any).rowCount > 0
  }
}
