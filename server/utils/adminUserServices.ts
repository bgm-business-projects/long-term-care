import { DrizzleUserQueryRepository } from '../infrastructure/db/DrizzleUserQueryRepository'
import { DrizzleUserCommandRepository } from '../infrastructure/db/DrizzleUserCommandRepository'
import { BetterAuthIdentityService } from '../infrastructure/auth/BetterAuthIdentityService'
import { AdminUserQueryService } from '../application/user/AdminUserQueryService'
import { AdminUserCommandService } from '../application/user/AdminUserCommandService'

export function useAdminUserServices() {
  const queryRepo = new DrizzleUserQueryRepository()
  const commandRepo = new DrizzleUserCommandRepository()
  const emailService = useEmailService()
  const config = useRuntimeConfig()
  const identityService = new BetterAuthIdentityService(emailService, config.betterAuth.url)

  const { subscriptionEventBus } = useSubscriptionEventBus()

  return {
    query: new AdminUserQueryService(queryRepo),
    command: new AdminUserCommandService(commandRepo, queryRepo, identityService, subscriptionEventBus),
  }
}
