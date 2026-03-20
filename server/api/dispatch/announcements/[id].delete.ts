import { requireAdmin } from '../../../utils/requireAdmin'
import { useAnnouncementServices } from '../../../utils/announcementServices'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Announcement ID required' })
  }

  const { getById, remove } = useAnnouncementServices()

  const existing = await getById(id)
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Announcement not found' })
  }

  await remove(id)

  return { success: true }
})
