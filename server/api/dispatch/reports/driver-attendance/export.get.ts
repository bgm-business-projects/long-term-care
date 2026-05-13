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
  await requireAgencyStaff(event)
  const query = getQuery(event)

  const { getDriverAttendanceReport } = useReportServices()
  const rows = await getDriverAttendanceReport({
    startDate: String(query.startDate),
    endDate: String(query.endDate),
    driverUserId: query.driverUserId as string | undefined,
    vehicleId: query.vehicleId as string | undefined,
  })

  const ExcelJS = await import('exceljs').then(m => m.default || m)
  const workbook = new ExcelJS.Workbook()
  const ws = workbook.addWorksheet('司機出勤報表')

  ws.columns = [
    { header: '日期', key: 'date', width: 12 },
    { header: '司機', key: 'driverName', width: 12 },
    { header: '車牌', key: 'vehiclePlate', width: 12 },
    { header: '序號', key: 'dailySeq', width: 6 },
    { header: '時間', key: 'time', width: 10 },
    { header: '個案', key: 'careRecipientName', width: 14 },
    { header: '方向', key: 'directionLabel', width: 8 },
    { header: '共乘', key: 'carpoolInfo', width: 14 },
    { header: '上車順序', key: 'carpoolOrder', width: 8 },
    { header: '下車順序', key: 'carpoolDropoffOrder', width: 8 },
    { header: '起點', key: 'originAddress', width: 30 },
    { header: '終點', key: 'destinationAddress', width: 30 },
    { header: '預估里程(km)', key: 'mileageEstimated', width: 14 },
    { header: '實際里程(km)', key: 'mileageActual', width: 14 },
    { header: '狀態', key: 'status', width: 10 },
  ]
  ws.getRow(1).font = { bold: true }
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } }

  let lastKey = ''
  for (const r of rows) {
    const day = r.scheduledAt ? new Date(r.scheduledAt).toLocaleDateString('zh-TW') : ''
    const key = `${r.driverName ?? ''}|${day}`
    // 不同司機/日分隔線
    if (lastKey && lastKey !== key) {
      ws.addRow({})
    }
    lastKey = key
    ws.addRow({
      date: day,
      driverName: r.driverName ?? '',
      vehiclePlate: r.vehiclePlate ?? '',
      dailySeq: r.dailySeq,
      time: r.scheduledAt ? new Date(r.scheduledAt).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }) : '',
      careRecipientName: r.careRecipientName ?? '',
      directionLabel: r.directionLabel,
      carpoolInfo: r.carpoolSize ? `共乘 ${r.carpoolSize} 人` : '',
      carpoolOrder: r.carpoolOrder ?? '',
      carpoolDropoffOrder: r.carpoolDropoffOrder ?? '',
      originAddress: r.originAddress,
      destinationAddress: r.destinationAddress,
      mileageEstimated: r.mileageEstimated ? Number(r.mileageEstimated) : '',
      mileageActual: r.mileageActual ? Number(r.mileageActual) : '',
      status: STATUS_LABEL[r.status] ?? r.status,
    })
  }

  setHeader(event, 'Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  setHeader(event, 'Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(`司機出勤報表_${query.startDate}_${query.endDate}.xlsx`)}`)
  return workbook.xlsx.writeBuffer()
})
