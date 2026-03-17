import { requireAdmin } from '../../../utils/requireAdmin'
import { useAdminUserServices } from '../../../utils/adminUserServices'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const query = getQuery(event)
  const { query: queryService } = useAdminUserServices()

  const filter = {
    search: (query.search as string) || undefined,
    role: (query.role as string) || undefined,
    tier: (query.tier as string) || undefined,
    convertedFromGuest: query.convertedFromGuest === 'true' ? true
      : query.convertedFromGuest === 'false' ? false
      : undefined,
  }

  const pagination = {
    page: Math.max(1, Number(query.page) || 1),
    pageSize: Math.min(100, Math.max(1, Number(query.pageSize) || 20)),
    sortBy: (['createdAt', 'name', 'email'].includes(query.sortBy as string)
      ? query.sortBy as 'createdAt' | 'name' | 'email'
      : 'createdAt'),
    sortOrder: (query.sortOrder === 'asc' ? 'asc' : 'desc') as 'asc' | 'desc',
  }

  return queryService.listUsers(filter, pagination)
})
