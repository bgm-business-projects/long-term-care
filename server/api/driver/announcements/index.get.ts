import { requireDriver } from '../../../utils/requireDriver'
import { useAnnouncementServices } from '../../../utils/announcementServices'

export default defineEventHandler(async (event) => {
  await requireDriver(event)

  const { list } = useAnnouncementServices()

  // Driver sees only published and non-expired announcements
  return list({ publishedOnly: true, includeExpired: false })
})
