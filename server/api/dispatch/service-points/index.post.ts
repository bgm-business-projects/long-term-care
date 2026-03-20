import { requireAgencyStaff } from '../../../utils/requireAgencyStaff'
import { useServicePointServices } from '../../../utils/servicePointServices'

export default defineEventHandler(async (event) => {
  const session = await requireAgencyStaff(event)
  const body = await readBody(event)

  if (!body.name) throw createError({ statusCode: 400, statusMessage: 'name is required' })
  if (!body.address) throw createError({ statusCode: 400, statusMessage: 'address is required' })

  const userRole = (session.user as any).role
  const userOrgId = (session.user as any).organizationId as string | null

  let organizationId: string | null = body.organizationId ?? null
  const careRecipientId: string | null = body.careRecipientId ?? null

  if (userRole === 'agency_staff') {
    // 個案據點：careRecipientId 有值即可，organizationId 留 null
    // 機構據點：organizationId 強制設為自己的機構
    // 全域據點：agency_staff 無權建立（careRecipientId 和 organizationId 都沒有）
    if (!careRecipientId && !organizationId) {
      // 沒有指定 careRecipientId → 視為機構據點，自動帶入 orgId
      organizationId = userOrgId
    } else if (organizationId && organizationId !== userOrgId) {
      throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
    }
  }

  const { create } = useServicePointServices()
  return create({
    name: body.name,
    address: body.address,
    lat: body.lat,
    lng: body.lng,
    category: body.category,
    organizationId,
    careRecipientId,
  })
})
