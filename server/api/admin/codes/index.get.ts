import { requireAdmin } from '../../../utils/requireAdmin'
import { useSubscriptionServices } from '../../../utils/subscriptionServices'
import type { SubscriptionTier } from '../../../domain/subscription/SubscriptionTier'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const query = getQuery(event)
  const { adminQuery } = useSubscriptionServices()

  const statusRaw = (query.status as string) || 'all'
  const validStatuses = ['all', 'used', 'unused', 'disabled'] as const
  const status = validStatuses.includes(statusRaw as any)
    ? (statusRaw as typeof validStatuses[number])
    : 'all'

  const filter = {
    tier: query.tier as SubscriptionTier | undefined,
    status,
  }

  const pagination = {
    page: Math.max(1, Number(query.page) || 1),
    pageSize: Math.min(100, Math.max(1, Number(query.pageSize) || 20)),
  }

  return adminQuery.listCodes(filter, pagination)
})
