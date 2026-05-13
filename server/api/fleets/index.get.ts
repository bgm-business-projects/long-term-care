import { useFleetServices } from '../../utils/fleetServices'

// 公開：給司機註冊時選擇車行
export default defineEventHandler(async () => {
  const { listActive } = useFleetServices()
  const rows = await listActive()
  return rows.map(f => ({
    id: f.id,
    name: f.name,
    contactPerson: f.contactPerson,
    phone: f.phone,
  }))
})
