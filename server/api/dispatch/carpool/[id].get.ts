import { requireAgencyStaff } from '../../../utils/requireAgencyStaff'
import { getCarpoolDetail } from '../../../utils/carpoolServices'

export default defineEventHandler(async (event) => {
  await requireAgencyStaff(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Group ID required' })
  return getCarpoolDetail(id)
})
