import { eq, ilike, or, and, sql, asc, desc, count, isNull, isNotNull, type SQL } from 'drizzle-orm'
import { useDb } from './drizzle'
import { user, session } from './schema'
import type { IUserQueryRepository, UserListFilter, UserListPagination, UserListResult } from '../../domain/user/IUserQueryRepository'
import type { UserEntity } from '../../domain/user/UserEntity'
import type { UserListItemDTO } from '../../domain/user/UserReadModels'
import { isValidTier, type SubscriptionTier } from '../../domain/subscription/SubscriptionTier'

export class DrizzleUserQueryRepository implements IUserQueryRepository {
  private get db() {
    return useDb()
  }

  async findMany(filter: UserListFilter, pagination: UserListPagination): Promise<UserListResult> {
    const conditions: SQL[] = []

    if (filter.search) {
      const pattern = `%${filter.search}%`
      const searchCond = or(ilike(user.name, pattern), ilike(user.email, pattern))
      if (searchCond) conditions.push(searchCond)
    }
    if (filter.role) {
      conditions.push(eq(user.role, filter.role))
    }
    if (filter.organizationId) {
      conditions.push(eq(user.organizationId, filter.organizationId))
    }
    if (filter.tier) {
      conditions.push(eq(user.subscriptionTier, filter.tier))
    }
    if (filter.convertedFromGuest === true) {
      conditions.push(isNotNull(user.convertedFromGuestAt))
    } else if (filter.convertedFromGuest === false) {
      conditions.push(isNull(user.convertedFromGuestAt))
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    // Count total
    const countResult = await this.db
      .select({ total: count() })
      .from(user)
      .where(whereClause)
    const total = countResult[0]?.total ?? 0

    // Sort
    const sortCol = pagination.sortBy === 'name' ? user.name
      : pagination.sortBy === 'email' ? user.email
      : user.createdAt
    const sortFn = pagination.sortOrder === 'asc' ? asc : desc

    // Query users with aggregates
    const offset = (pagination.page - 1) * pagination.pageSize
    const rows = await this.db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        role: user.role,
        subscriptionTier: user.subscriptionTier,
        emailVerified: user.emailVerified,
        banned: user.banned,
        convertedFromGuestAt: user.convertedFromGuestAt,
        createdAt: user.createdAt,
        lastLoginAt: sql<string | null>`(SELECT MAX(${session.createdAt}) FROM ${session} WHERE ${session.userId} = ${user.id})`,
      })
      .from(user)
      .where(whereClause)
      .orderBy(sortFn(sortCol))
      .limit(pagination.pageSize)
      .offset(offset)

    const items: UserListItemDTO[] = rows.map(row => ({
      id: row.id,
      name: row.name,
      email: row.email,
      image: row.image,
      role: row.role,
      subscriptionTier: row.subscriptionTier,
      emailVerified: row.emailVerified,
      banned: row.banned,
      convertedFromGuest: row.convertedFromGuestAt !== null,
      createdAt: row.createdAt.toISOString(),
      lastLoginAt: row.lastLoginAt ? new Date(row.lastLoginAt).toISOString() : null,
    }))

    return { items, total }
  }

  async findById(id: string): Promise<UserEntity | null> {
    const row = await this.db.query.user.findFirst({
      where: eq(user.id, id),
    })
    if (!row) return null
    const tier = isValidTier(row.subscriptionTier) ? row.subscriptionTier : 'free' as SubscriptionTier
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      emailVerified: row.emailVerified,
      image: row.image,
      role: row.role,
      subscriptionTier: tier,
      subscriptionExpiresAt: row.subscriptionExpiresAt,
      banned: row.banned,
      convertedFromGuestAt: row.convertedFromGuestAt ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }
  }
}
