import { requireAgencyStaff } from '../../../../utils/requireAgencyStaff'
import { useReportServices } from '../../../../utils/reportServices'

export default defineEventHandler(async (event) => {
  await requireAgencyStaff(event)
  const query = getQuery(event)

  const { getMileageData } = useReportServices()
  const rows = await getMileageData({
    startDate: String(query.startDate),
    endDate: String(query.endDate),
    driverUserId: query.driverUserId as string | undefined,
    vehicleId: query.vehicleId as string | undefined,
  })

  // 動態 import exceljs
  const ExcelJS = await import('exceljs').then(m => m.default || m)
  const workbook = new ExcelJS.Workbook()
  const ws = workbook.addWorksheet('里程報表')

  ws.columns = [
    { header: '日期', key: 'tripDate', width: 14 },
    { header: '車牌', key: 'vehiclePlate', width: 12 },
    { header: '司機', key: 'driverName', width: 12 },
    { header: '個案', key: 'careRecipientName', width: 14 },
    { header: '起點', key: 'originAddress', width: 30 },
    { header: '終點', key: 'destinationAddress', width: 30 },
    { header: '預估里程(km)', key: 'mileageEstimated', width: 14 },
    { header: '實際里程(km)', key: 'mileageActual', width: 14 },
    { header: '狀態', key: 'status', width: 10 },
    { header: '需輪椅', key: 'needsWheelchair', width: 8 },
  ]

  ws.getRow(1).font = { bold: true }
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } }

  rows.forEach(row => {
    ws.addRow({
      ...row,
      tripDate: row.tripDate ? new Date(row.tripDate).toLocaleDateString('zh-TW') : '',
      mileageEstimated: row.mileageEstimated ? Number(row.mileageEstimated) : '',
      mileageActual: row.mileageActual ? Number(row.mileageActual) : '',
      needsWheelchair: row.needsWheelchair ? '是' : '否',
    })
  })

  setHeader(event, 'Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  setHeader(event, 'Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(`里程報表_${query.startDate}_${query.endDate}.xlsx`)}`)

  return workbook.xlsx.writeBuffer()
})
