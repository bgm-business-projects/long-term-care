import { requireAdmin } from '../../../../utils/requireAdmin'
import { createOrgStaff } from '../../../../utils/orgStaffServices'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const orgId = getRouterParam(event, 'id')!
  const body = await readBody(event)

  if (!body.name || !body.email) {
    throw createError({ statusCode: 400, statusMessage: '姓名和電子信箱為必填' })
  }

  try {
    return await createOrgStaff(orgId, { name: body.name, email: body.email })
  } catch (err: any) {
    if (err.message === 'EMAIL_EXISTS') {
      throw createError({ statusCode: 409, statusMessage: '此電子信箱已被使用' })
    }
    if (err.message === 'Organization not found') {
      throw createError({ statusCode: 404, statusMessage: '機構不存在' })
    }
    throw createError({ statusCode: 500, statusMessage: '新增失敗' })
  }
})
