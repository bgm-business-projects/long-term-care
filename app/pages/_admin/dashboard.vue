<script setup lang="ts">
const { api } = useApi()
const today = new Date().toISOString().split('T')[0]
const selectedDate = ref(today)
const data = ref<any>(null)
const loading = ref(false)

async function load() {
  loading.value = true
  try {
    data.value = await api<any>(`/api/dispatch/dashboard?date=${selectedDate.value}`)
  } finally {
    loading.value = false
  }
}
onMounted(load)
watch(selectedDate, load)
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold">營運總覽</h1>
      <input type="date" v-model="selectedDate" class="border border-default rounded px-3 py-1.5 text-sm" />
    </div>

    <!-- 統計卡片 -->
    <div class="grid grid-cols-3 gap-4">
      <div class="border border-default rounded-xl p-4">
        <p class="text-sm text-muted">今日訂單總數</p>
        <p class="text-3xl font-bold mt-1">{{ data?.todayTripCount ?? '—' }}</p>
      </div>
      <div class="border border-warning/50 bg-warning/5 rounded-xl p-4">
        <p class="text-sm text-muted">待派訂單</p>
        <p class="text-3xl font-bold text-warning mt-1">{{ data?.pendingTripCount ?? '—' }}</p>
      </div>
      <div class="border border-success/50 bg-success/5 rounded-xl p-4">
        <p class="text-sm text-muted">執行中車輛</p>
        <p class="text-3xl font-bold text-success mt-1">{{ data?.activeVehicleCount ?? '—' }}</p>
      </div>
    </div>

    <!-- 告警區塊 -->
    <div class="space-y-4">
      <!-- 延遲出發告警 -->
      <div v-if="data?.alerts?.delayedDepartures?.length" class="border border-error/50 bg-error/5 rounded-xl p-4">
        <h3 class="font-semibold text-error flex items-center gap-2">
          <UIcon name="i-lucide-alert-triangle" />
          延遲未出發（{{ data.alerts.delayedDepartures.length }} 筆）
        </h3>
        <ul class="mt-2 space-y-1">
          <li v-for="trip in data.alerts.delayedDepartures" :key="trip.id" class="text-sm">
            {{ new Date(trip.scheduledAt).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }) }}
            — {{ trip.careRecipientName || '未知個案' }}
          </li>
        </ul>
      </div>

      <!-- 駕照到期告警 -->
      <div v-if="data?.alerts?.licenseExpiringSoon?.length" class="border border-warning/50 bg-warning/5 rounded-xl p-4">
        <h3 class="font-semibold text-warning flex items-center gap-2">
          <UIcon name="i-lucide-id-card" />
          駕照即將到期（{{ data.alerts.licenseExpiringSoon.length }} 人）
        </h3>
        <ul class="mt-2 space-y-1">
          <li v-for="driver in data.alerts.licenseExpiringSoon" :key="driver.id" class="text-sm">
            {{ driver.name }} — 到期日：{{ driver.licenseExpiry }}
          </li>
        </ul>
      </div>

      <div v-if="!data?.alerts?.delayedDepartures?.length && !data?.alerts?.licenseExpiringSoon?.length && data"
           class="text-center text-muted text-sm py-4">
        ✓ 目前無異常告警
      </div>
    </div>
  </div>
</template>
