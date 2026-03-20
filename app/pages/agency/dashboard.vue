<script setup lang="ts">
const { api } = useApi()
const today = new Date().toISOString().split('T')[0]
const selectedDate = ref(today)
const data = ref<any>(null)
const loading = ref(false)

const selectedTrip = ref<any>(null)
const showTripModal = ref(false)
const showPendingModal = ref(false)
const showActiveModal = ref(false)

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

function formatTime(dt: string) {
  return new Date(dt).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })
}

function delayMinutes(scheduledAt: string) {
  return Math.floor((Date.now() - new Date(scheduledAt).getTime()) / 60000)
}

function openTrip(trip: any) {
  selectedTrip.value = trip
  showTripModal.value = true
}

function closeTrip() {
  showTripModal.value = false
  selectedTrip.value = null
}
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
      <div
        class="border border-warning/50 bg-warning/5 rounded-xl p-4 cursor-pointer hover:bg-warning/10 transition-colors"
        @click="showPendingModal = true"
      >
        <p class="text-sm text-muted flex items-center gap-1">
          待派訂單
          <UIcon name="i-lucide-chevron-right" class="text-xs" />
        </p>
        <p class="text-3xl font-bold text-warning mt-1">{{ data?.pendingTripCount ?? '—' }}</p>
      </div>
      <div
        class="border border-success/50 bg-success/5 rounded-xl p-4 cursor-pointer hover:bg-success/10 transition-colors"
        @click="showActiveModal = true"
      >
        <p class="text-sm text-muted flex items-center gap-1">
          執行中車輛
          <UIcon name="i-lucide-chevron-right" class="text-xs" />
        </p>
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
          <li
            v-for="trip in data.alerts.delayedDepartures"
            :key="trip.id"
            class="text-sm flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer hover:bg-error/10 transition-colors"
            @click="openTrip(trip)"
          >
            <UIcon name="i-lucide-clock" class="text-error shrink-0" />
            <span class="font-medium">{{ formatTime(trip.scheduledAt) }}</span>
            <span class="text-muted">—</span>
            <span>{{ trip.careRecipientName || '未知個案' }}</span>
            <UBadge color="error" variant="subtle" size="xs" class="ml-auto">
              遲 {{ delayMinutes(trip.scheduledAt) }} 分
            </UBadge>
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

    <!-- 延遲訂單詳情 Modal -->
    <UModal v-model:open="showTripModal" title="訂單詳情" description=" ">
      <template #content>
        <div v-if="selectedTrip" class="p-6 space-y-4">
          <div class="flex items-center gap-2">
            <UBadge color="error" variant="subtle">延遲未出發</UBadge>
            <span class="text-sm text-muted">遲 {{ delayMinutes(selectedTrip.scheduledAt) }} 分鐘</span>
          </div>
          <div class="space-y-4 text-sm">
            <div>
              <p class="text-xs font-semibold text-muted uppercase tracking-wider mb-2">行程資訊</p>
              <div class="space-y-2">
                <div class="flex gap-3">
                  <span class="text-muted w-20 shrink-0">個案</span>
                  <span class="font-medium">{{ selectedTrip.careRecipientName || '—' }}</span>
                </div>
                <div class="flex gap-3">
                  <span class="text-muted w-20 shrink-0">預定時間</span>
                  <span>{{ new Date(selectedTrip.scheduledAt).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) }}</span>
                </div>
                <div class="flex gap-3">
                  <span class="text-muted w-20 shrink-0">上車地點</span>
                  <span>{{ selectedTrip.originAddress || '—' }}</span>
                </div>
                <div class="flex gap-3">
                  <span class="text-muted w-20 shrink-0">目的地</span>
                  <span>{{ selectedTrip.destinationAddress || '—' }}</span>
                </div>
              </div>
            </div>
            <USeparator />
            <div>
              <p class="text-xs font-semibold text-muted uppercase tracking-wider mb-2">司機</p>
              <div class="space-y-2">
                <div class="flex gap-3">
                  <span class="text-muted w-20 shrink-0">姓名</span>
                  <span class="font-medium">{{ selectedTrip.driverName || '—' }}</span>
                </div>
                <div class="flex gap-3 items-center">
                  <span class="text-muted w-20 shrink-0">聯絡電話</span>
                  <a v-if="selectedTrip.driverPhone" :href="`tel:${selectedTrip.driverPhone}`"
                     class="text-primary font-medium flex items-center gap-1 hover:underline">
                    <UIcon name="i-lucide-phone" class="text-xs" />
                    {{ selectedTrip.driverPhone }}
                  </a>
                  <span v-else>—</span>
                </div>
              </div>
            </div>
            <USeparator />
            <div>
              <p class="text-xs font-semibold text-muted uppercase tracking-wider mb-2">車輛</p>
              <div class="space-y-2">
                <div class="flex gap-3">
                  <span class="text-muted w-20 shrink-0">車牌</span>
                  <span class="font-medium font-mono">{{ selectedTrip.vehiclePlate || '—' }}</span>
                </div>
                <div class="flex gap-3">
                  <span class="text-muted w-20 shrink-0">車種</span>
                  <span>{{ selectedTrip.vehicleType || '—' }}</span>
                </div>
              </div>
            </div>
          </div>
          <div class="flex justify-end pt-2">
            <UButton color="neutral" variant="outline" @click="closeTrip">關閉</UButton>
          </div>
        </div>
      </template>
    </UModal>

    <!-- 待派訂單 Modal -->
    <UModal v-model:open="showPendingModal" title="待派訂單" description=" ">
      <template #content>
        <div class="p-6 space-y-3">
          <div v-if="!data?.pendingTrips?.length" class="text-center text-muted text-sm py-4">
            目前無待派訂單
          </div>
          <div
            v-for="trip in data?.pendingTrips"
            :key="trip.id"
            class="border border-default rounded-lg p-3 space-y-1.5 text-sm"
          >
            <div class="flex items-center justify-between">
              <span class="font-medium">{{ trip.careRecipientName || '—' }}</span>
              <div class="flex items-center gap-1.5">
                <UIcon v-if="trip.needsWheelchair" name="i-lucide-accessibility" class="text-warning text-xs" />
                <span class="text-muted text-xs">{{ formatTime(trip.scheduledAt) }}</span>
              </div>
            </div>
            <div class="text-muted text-xs flex items-start gap-1">
              <UIcon name="i-lucide-map-pin" class="shrink-0 mt-0.5" />
              {{ trip.originAddress }}
            </div>
            <div class="text-muted text-xs flex items-start gap-1">
              <UIcon name="i-lucide-flag" class="shrink-0 mt-0.5" />
              {{ trip.destinationAddress }}
            </div>
            <div v-if="trip.careRecipientPhone" class="text-xs">
              <a :href="`tel:${trip.careRecipientPhone}`" class="text-primary flex items-center gap-1 hover:underline">
                <UIcon name="i-lucide-phone" class="text-xs" />
                {{ trip.careRecipientPhone }}
              </a>
            </div>
          </div>
          <div class="flex justify-end pt-2">
            <UButton color="neutral" variant="outline" @click="showPendingModal = false">關閉</UButton>
          </div>
        </div>
      </template>
    </UModal>

    <!-- 執行中車輛 Modal -->
    <UModal v-model:open="showActiveModal" title="執行中車輛" description=" ">
      <template #content>
        <div class="p-6 space-y-3">
          <div v-if="!data?.activeVehicleTrips?.length" class="text-center text-muted text-sm py-4">
            目前無執行中車輛
          </div>
          <div
            v-for="trip in data?.activeVehicleTrips"
            :key="trip.id"
            class="border border-default rounded-lg p-3 space-y-2 text-sm"
          >
            <div class="flex items-center justify-between">
              <span class="font-medium font-mono">{{ trip.vehiclePlate || '—' }}</span>
              <span class="text-muted text-xs">{{ trip.vehicleType }}</span>
            </div>
            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-user" class="text-muted text-xs shrink-0" />
              <span>{{ trip.driverName || '—' }}</span>
              <a v-if="trip.driverPhone" :href="`tel:${trip.driverPhone}`"
                 class="text-primary flex items-center gap-1 hover:underline ml-auto text-xs">
                <UIcon name="i-lucide-phone" class="text-xs" />
                {{ trip.driverPhone }}
              </a>
            </div>
            <div class="text-muted text-xs border-t border-default pt-2 flex items-center gap-2">
              <UIcon name="i-lucide-heart-handshake" class="shrink-0" />
              <span>{{ trip.careRecipientName || '—' }}</span>
              <span class="mx-1">→</span>
              <span class="truncate">{{ trip.destinationAddress }}</span>
            </div>
          </div>
          <div class="flex justify-end pt-2">
            <UButton color="neutral" variant="outline" @click="showActiveModal = false">關閉</UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
