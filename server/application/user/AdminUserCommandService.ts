import type { IUserCommandRepository } from '../../domain/user/IUserCommandRepository'
import type { IUserQueryRepository } from '../../domain/user/IUserQueryRepository'
import type { IIdentityServiceProvider } from '../../domain/user/IIdentityServiceProvider'
import type { ISubscriptionEventBus } from '../../domain/subscription/events/ISubscriptionEventBus'
import type { SubscriptionTier } from '../../domain/subscription/SubscriptionTier'
import { UserPolicy } from '../../domain/user/UserPolicy'

export class AdminUserCommandService {
  constructor(
    private commandRepo: IUserCommandRepository,
    private queryRepo: IUserQueryRepository,
    private identityService: IIdentityServiceProvider,
    private subscriptionEventBus?: ISubscriptionEventBus
  ) {}

  async changeRole(userId: string, role: string, adminUserId: string, actorRole: string): Promise<{ success: true }> {
    if (!UserPolicy.canChangeRole(userId, adminUserId, actorRole)) {
      throw createError({ statusCode: 403, statusMessage: 'Only developers can change roles' })
    }
    if (!UserPolicy.isValidRole(role)) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid role' })
    }

    const target = await this.queryRepo.findById(userId)
    if (!target) {
      throw createError({ statusCode: 404, statusMessage: 'User not found' })
    }

    await this.commandRepo.updateRole(userId, role)
    return { success: true }
  }

  async changeSubscription(userId: string, tier: SubscriptionTier, expiresAt: Date | null): Promise<{ success: true }> {
    const target = await this.queryRepo.findById(userId)
    if (!target) {
      throw createError({ statusCode: 404, statusMessage: 'User not found' })
    }

    await this.commandRepo.updateSubscription(userId, tier, expiresAt)

    this.subscriptionEventBus?.emit({
      type: 'AdminSubscriptionChanged',
      payload: { userId, tier },
    })

    return { success: true }
  }

  async toggleBan(userId: string, banned: boolean, adminUserId: string): Promise<{ success: true }> {
    if (!UserPolicy.canBan(userId, adminUserId)) {
      throw createError({ statusCode: 400, statusMessage: 'Cannot ban yourself' })
    }

    const target = await this.queryRepo.findById(userId)
    if (!target) {
      throw createError({ statusCode: 404, statusMessage: 'User not found' })
    }

    await this.commandRepo.updateBanned(userId, banned)

    // Immediately revoke all sessions when banning
    if (banned) {
      await this.identityService.revokeAllSessions(userId)
    }

    this.subscriptionEventBus?.emit({
      type: 'UserBanned',
      payload: { userId, banned },
    })

    return { success: true }
  }

  async resetPassword(userId: string): Promise<{ success: true }> {
    const target = await this.queryRepo.findById(userId)
    if (!target) {
      throw createError({ statusCode: 404, statusMessage: 'User not found' })
    }

    await this.identityService.sendPasswordResetEmail(userId, target.email)
    return { success: true }
  }

  async deleteUser(userId: string, adminUserId: string): Promise<{ success: true }> {
    if (!UserPolicy.canDelete(userId, adminUserId)) {
      throw createError({ statusCode: 400, statusMessage: 'Cannot delete yourself' })
    }

    const target = await this.queryRepo.findById(userId)
    if (!target) {
      throw createError({ statusCode: 404, statusMessage: 'User not found' })
    }

    await this.commandRepo.deleteUser(userId)
    return { success: true }
  }
}
