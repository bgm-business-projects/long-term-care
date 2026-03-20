import { requireAdmin } from '../../../utils/requireAdmin'
import { useAnnouncementServices } from '../../../utils/announcementServices'

export default defineEventHandler(async (event) => {
  const session = await requireAdmin(event)

  const body = await readBody(event)

  if (!body.title || !body.body) {
    throw createError({ statusCode: 400, statusMessage: 'title and body are required' })
  }

  const { create } = useAnnouncementServices()

  const announcement = await create({
    title: body.title,
    body: body.body,
    authorUserId: (session.user as any).id,
    expiresAt: body.expiresAt,
  })

  setResponseStatus(event, 201)
  return announcement
})
