import type { SubscriptionTier } from './SubscriptionTier'

export interface RedemptionCodeEntity {
  id: string
  code: string
  tier: SubscriptionTier
  durationDays: number | null
  disabled: boolean
  batchId: string | null
  usedById: string | null
  usedByName: string | null
  usedByEmail: string | null
  usedAt: Date | null
  createdAt: Date
}

export interface NewRedemptionCode {
  code: string
  tier: SubscriptionTier
  durationDays: number | null
  batchId?: string | null
}

export interface CodeFilter {
  tier?: SubscriptionTier
  status?: 'all' | 'used' | 'unused' | 'disabled'
}

export interface Pagination {
  page: number
  pageSize: number
}

export interface IRedemptionCodeQueryRepository {
  findByCode(code: string): Promise<RedemptionCodeEntity | null>
  findById(id: string): Promise<RedemptionCodeEntity | null>
  findMany(filter: CodeFilter, pagination: Pagination): Promise<{ items: RedemptionCodeEntity[]; total: number }>
}

export interface IRedemptionCodeCommandRepository {
  create(data: NewRedemptionCode): Promise<RedemptionCodeEntity>
  createBatch(codes: NewRedemptionCode[]): Promise<RedemptionCodeEntity[]>
  markAsUsed(id: string, userId: string, usedAt: Date): Promise<void>
  updateDisabled(id: string, disabled: boolean): Promise<void>
  softDeleteUnused(id: string): Promise<boolean>
}

export type IRedemptionCodeRepository = IRedemptionCodeQueryRepository & IRedemptionCodeCommandRepository
