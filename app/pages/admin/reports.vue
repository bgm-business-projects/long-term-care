<script setup lang="ts">
const { api } = useApi()
const toast = useToast()
const filter = reactive({
  startDate: new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0],
  endDate: new Date().toISOString().split('T')[0],
  driverUserId: '',
  vehicleId: '',
})
const rows = ref<any[]>([])
const loading = ref(false)
const exporting = ref(false)
const drivers = ref<any[]>([])
const vehicles = ref<any[]>([])

onMounted(async () => {
  const [d, v] = await Promise.all([
    api<any[]>('/api/dispatch/drivers'),
    api<any[]>('/api/dispatch/vehicles'),
  ])
  drivers.value = d
  vehicles.value = v
})

async function search() {
  loading.value = true
  try {
    const params = new URLSearchParams(filter as any)
    rows.value = await api<any[]>(`/api/dispatch/reports/mileage?${params}`)
  } finally {
    loading.value = false
  }
}

async function exportExcel() {
  exporting.value = true
  try {
    const params = new URLSearchParams(filter as any)
    const blob = await $fetch(`/api/dispatch/reports/mileage/export?${params}`, {
      responseType: 'blob',
      credentials: 'include',
    }) as Blob
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `里程報表_${filter.startDate}_${filter.endDate}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
  } catch {
    toast.add({ title: '匯出失敗', color: 'error' })
  } finally {
    exporting.value = false
  }
}
</script>

<template>
  <div class="space-y-4">
    <h1 class="text-xl font-bold">出勤里程報表</h1>
    <!-- 篩選列 -->
    <div class="flex flex-wrap gap-3 p-4 border border-default rounded-xl bg-default/30">
      <div class="flex items-center gap-2">
        <span class="text-sm">起始日</span>
        <input type="date" v-model="filter.startDate" class="border border-default rounded px-2 py-1 text-sm" />
      </div>
      <div class="flex items-center gap-2">
        <span class="text-sm">結束日</span>
        <input type="date" v-model="filter.endDate" class="border border-default rounded px-2 py-1 text-sm" />
      </div>
      <UButton @click="search" :loading="loading">查詢</UButton>
      <UButton @click="exportExcel" :loading="exporting" color="success" icon="i-lucide-download">
        匯出 Excel
      </UButton>
    </div>
    <!-- 資料表 -->
    <div class="overflow-x-auto border border-default rounded-xl">
      <table class="w-full text-sm">
        <thead class="bg-default/50 border-b border-default">
          <tr>
            <th class="px-3 py-2 text-left">日期</th>
            <th class="px-3 py-2 text-left">車牌</th>
            <th class="px-3 py-2 text-left">司機</th>
            <th class="px-3 py-2 text-left">個案</th>
            <th class="px-3 py-2 text-left">起點</th>
            <th class="px-3 py-2 text-left">終點</th>
            <th class="px-3 py-2 text-right">預估里程</th>
            <th class="px-3 py-2 text-right">實際里程</th>
            <th class="px-3 py-2 text-center">狀態</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in rows" :key="r.tripDate" class="border-b border-default/50 hover:bg-default/30">
            <td class="px-3 py-2">{{ r.tripDate ? new Date(r.tripDate).toLocaleDateString('zh-TW') : '—' }}</td>
            <td class="px-3 py-2">{{ r.vehiclePlate || '—' }}</td>
            <td class="px-3 py-2">{{ r.driverName || '—' }}</td>
            <td class="px-3 py-2">{{ r.careRecipientName || '—' }}</td>
            <td class="px-3 py-2 max-w-32 truncate">{{ r.originAddress }}</td>
            <td class="px-3 py-2 max-w-32 truncate">{{ r.destinationAddress }}</td>
            <td class="px-3 py-2 text-right">{{ r.mileageEstimated || '—' }}</td>
            <td class="px-3 py-2 text-right">{{ r.mileageActual || '—' }}</td>
            <td class="px-3 py-2 text-center">{{ r.status }}</td>
          </tr>
          <tr v-if="rows.length === 0">
            <td colspan="9" class="px-3 py-8 text-center text-muted">請點擊「查詢」載入資料</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
