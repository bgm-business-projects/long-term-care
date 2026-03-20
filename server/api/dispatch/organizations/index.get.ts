import { requireAgencyStaff } from '../../../utils/requireAgencyStaff'
import { useOrganizationServices } from '../../../utils/organizationServices'

export default defineEventHandler(async (event) => {
  await requireAgencyStaff(event)
  const query = getQuery(event)
  const { list } = useOrganizationServices()
  return list({ search: query.search as string | undefined })
})
