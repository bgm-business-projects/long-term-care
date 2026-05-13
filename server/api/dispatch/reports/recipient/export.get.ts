import { requireAgencyStaff } from '../../../../utils/requireAgencyStaff'
import { useReportServices } from '../../../../utils/reportServices'

const STATUS_LABEL: Record<string, string> = {
  pending: '待派',
  assigned: '已指派',
  in_progress: '進行中',
  completed: '已完成',
  cancelled: '已取消',
}

export default defineEventHandler(async (event) => {
  const session = await requireAgencyStaff(event)
  const query = getQuery(event)
  const role = (session.user as any).role
  const sessionOrgId = (session.user as any).organizationId as string | null
  const organizationId = role === 'agency_staff'
    ? (sessionOrgId ?? '__none__')
    : (query.organizationId as string | undefined)

  const { getRecipientReport } = useReportServices()
  const rows = await getRecipientReport({
    startDate: String(query.startDate),
    endDate: String(query.endDate),
    driverUserId: query.driverUserId as string | undefined,
    careRecipientId: query.careRecipientId as string | undefined,
    organizationId,
  })

  const ExcelJS = await import('exceljs').then(m => m.default || m)
  const workbook = new ExcelJS.Workbook()
  const ws = workbook.addWorksheet('個案接送報表')

  ws.columns = [
    { header: '日期', key: 'date', width: 12 },
    { header: '個案', key: 'careRecipientName', width: 14 },
    { header: '機構', key: 'organizationName', width: 16 },
    { header: '方向', key: 'directionLabel', width: 8 },
    { header: '預約時間', key: 'time', width: 10 },
    { header: '配對時間', key: 'pairedTime', width: 10 },
    { header: '起點', key: 'originAddress', width: 30 },
    { header: '終點', key: 'destinationAddress', width: 30 },
    { header: '司機', key: 'driverName', width: 12 },
    { header: '車牌', key: 'vehiclePlate', width: 12 },
    { header: '預估里程(km)', key: 'mileageEstimated', width: 14 },
    { header: '實際里程(km)', key: 'mileageActual', width: 14 },
    { header: '輪椅', key: 'needsWheelchair', width: 6 },
    { header: '狀態', key: 'status', width: 10 },
  ]
  ws.getRow(1).font = { bold: true }
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } }

  for (const r of rows) {
    ws.addRow({
      date: r.scheduledAt ? new Date(r.scheduledAt).toLocaleDateString('zh-TW') : '',
      careRecipientName: r.careRecipientName ?? '',
      organizationName: r.organizationName ?? '平台直接建立',
      directionLabel: r.directionLabel,
      time: r.scheduledAt ? new Date(r.scheduledAt).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }) : '',
      pairedTime: r.pairedScheduledAt ? new Date(r.pairedScheduledAt).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }) : '',
      originAddress: r.originAddress,
      destinationAddress: r.destinationAddress,
      driverName: r.driverName ?? '',
      vehiclePlate: r.vehiclePlate ?? '',
      mileageEstimated: r.mileageEstimated ? Number(r.mileageEstimated) : '',
      mileageActual: r.mileageActual ? Number(r.mileageActual) : '',
      needsWheelchair: r.needsWheelchair ? '是' : '否',
      status: STATUS_LABEL[r.status] ?? r.status,
    })
  }

  setHeader(event, 'Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  setHeader(event, 'Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(`個案接送報表_${query.startDate}_${query.endDate}.xlsx`)}`)
  return workbook.xlsx.writeBuffer()
})
