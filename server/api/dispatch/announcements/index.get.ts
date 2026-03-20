import { requireAdmin } from '../../../utils/requireAdmin'
import { useAnnouncementServices } from '../../../utils/announcementServices'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const { list } = useAnnouncementServices()

  // Admin sees all: including unpublished and expired
  return list({ publishedOnly: false, includeExpired: true })
})
