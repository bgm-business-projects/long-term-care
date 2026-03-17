import { z } from 'zod/v4'
import { requireAuth } from '../../utils/requireAuth'
import { useSubscriptionServices } from '../../utils/subscriptionServices'

const QuerySchema = z.object({
  code: z.string().min(1),
})

export default defineEventHandler(async (event) => {
  await requireAuth(event)
  const query = getQuery(event)
  const { code } = QuerySchema.parse(query)

  const { command } = useSubscriptionServices()
  return command.previewCode(code)
})
