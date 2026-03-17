import type { IRedemptionCodeCommandRepository, IRedemptionCodeQueryRepository, RedemptionCodeEntity, NewRedemptionCode } from '../../domain/subscription/IRedemptionCodeRepository'
import type { IRedemptionCodeEventBus } from '../../domain/subscription/events/IRedemptionCodeEventBus'
import type { SubscriptionTier } from '../../domain/subscription/SubscriptionTier'

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const segment = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  return `MYAPP-${segment()}-${segment()}`
}

export class AdminRedemptionCommandService {
  constructor(
    private commandRepo: IRedemptionCodeCommandRepository,
    private queryRepo: IRedemptionCodeQueryRepository,
    private eventBus: IRedemptionCodeEventBus,
  ) {}

  async createCode(tier: SubscriptionTier, durationDays: number | null): Promise<RedemptionCodeEntity> {
    return this.commandRepo.create({
      code: generateCode(),
      tier,
      durationDays,
    })
  }

  async createBatch(tier: SubscriptionTier, durationDays: number | null, count: number): Promise<RedemptionCodeEntity[]> {
    const batchId = crypto.randomUUID()
    const codes: NewRedemptionCode[] = Array.from({ length: count }, () => ({
      code: generateCode(),
      tier,
      durationDays,
      batchId,
    }))
    return this.commandRepo.createBatch(codes)
  }

  async setDisabled(id: string, disabled: boolean): Promise<void> {
    await this.commandRepo.updateDisabled(id, disabled)
  }

  async deleteCode(id: string, deletedBy: string): Promise<void> {
    const success = await this.commandRepo.softDeleteUnused(id)
    if (success) {
      const code = await this.queryRepo.findById(id)
      if (code) {
        this.eventBus.emit({
          type: 'RedemptionCodeDeleted',
          payload: { codeId: id, code: code.code, tier: code.tier, deletedBy },
        })
      }
      return
    }

    const existing = await this.queryRepo.findById(id)
    if (!existing) {
      throw createError({ statusCode: 404, statusMessage: 'Code not found' })
    }
    throw createError({ statusCode: 409, statusMessage: 'Code already used' })
  }
}
