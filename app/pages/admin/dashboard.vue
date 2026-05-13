<script setup lang="ts">
const { api } = useApi()
const toast = useToast()
const today = new Date().toISOString().split('T')[0]!
const dateRange = ref<{ from: string; to: string }>({ from: today, to: today })
const data = ref<any>(null)
const loading = ref(false)

const selectedTrip = ref<any>(null)
const showTripModal = ref(false)
const showPendingModal = ref(false)
const showActiveModal = ref(false)
const showIncidentsModal = ref(false)

const showResolveModal = ref(false)
const resolvingIncident = ref<any>(null)
const resolutionNote = ref('')
const resolving = ref(false)

const incidentTypeLabel: Record<string, string> = {
  sick: '🤒 個案生病',
  missing: '👻 個案失聯',
  no_show: '🚫 個案未到',
  accident: '🚗 行車事故',
  other: '✏️ 其他',
}
const incidentTypeColor: Record<string, 'error' | 'warning' | 'info' | 'neutral'> = {
  sick: 'warning',
  missing: 'error',
  no_show: 'warning',
  accident: 'error',
  other: 'info',
}

async function load() {
  loading.value = true
  try {
    data.value = await api<any>(`/api/dispatch/dashboard?dateFrom=${dateRange.value.from}&dateTo=${dateRange.value.to}`)
  } finally {
    loading.value = false
  }
}
onMounted(load)
watch(dateRange, load, { deep: true })

function formatTime(dt: string) {
  return new Date(dt).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })
}

function formatDateTime(dt: string) {
  return new Date(dt).toLocaleString('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function delayMinutes(scheduledAt: string) {
  return Math.floor((Date.now() - new Date(scheduledAt).getTime()) / 60000)
}

function estimatedArrival(trip: any): string {
  if (trip.scheduledEndAt) return formatTime(trip.scheduledEndAt)
  const dur = trip.estimatedDuration || 60
  const eta = new Date(new Date(trip.scheduledAt).getTime() + dur * 60000)
  return eta.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })
}

function openTrip(trip: any) {
  selectedTrip.value = trip
  showTripModal.value = true
}

function openResolve(incident: any) {
  resolvingIncident.value = incident
  resolutionNote.value = ''
  showResolveModal.value = true
}

async function submitResolve() {
  if (!resolvingIncident.value) return
  resolving.value = true
  try {
    await api(`/api/dispatch/incidents/${resolvingIncident.value.id}/resolve`, {
      method: 'POST',
      body: { resolutionNote: resolutionNote.value.trim() || null },
    })
    toast.add({ title: '已標記處理完成', color: 'success' })
    showResolveModal.value = false
    await load()
  } catch (err: any) {
    toast.add({ title: err?.data?.statusMessage || '操作失敗', color: 'error' })
  } finally {
    resolving.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between flex-wrap gap-3">
      <h1 class="text-2xl font-bold">營運總覽</h1>
      <DateRangePicker v-model="dateRange" />
    </div>

    <!-- 統計卡片 -->
    <div class="grid grid-cols-4 gap-4">
      <div class="border border-default rounded-xl p-4">
        <p class="text-sm text-muted">區間訂單總數</p>
        <p class="text-3xl font-bold mt-1">{{ data?.totalTripCount ?? '—' }}</p>
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
          進行中任務
          <UIcon name="i-lucide-chevron-right" class="text-xs" />
        </p>
        <p class="text-3xl font-bold text-success mt-1">{{ data?.activeTripCount ?? '—' }}</p>
      </div>
      <div
        class="border border-error/50 bg-error/5 rounded-xl p-4 cursor-pointer hover:bg-error/10 transition-colors"
        @click="showIncidentsModal = true"
      >
        <p class="text-sm text-muted flex items-center gap-1">
          異常回報（未處理 / 全部）
          <UIcon name="i-lucide-chevron-right" class="text-xs" />
        </p>
        <p class="text-3xl font-bold text-error mt-1">
          {{ data?.unresolvedIncidentCount ?? '—' }}
          <span class="text-base text-muted">/ {{ data?.incidents?.length ?? '—' }}</span>
        </p>
      </div>
    </div>

    <!-- 進行中任務（卡片列表） -->
    <div v-if="data?.activeTrips?.length" class="border border-default rounded-xl overflow-hidden">
      <div class="px-4 py-3 bg-success/10 border-b border-default flex items-center gap-2">
        <UIcon name="i-lucide-truck" class="text-success" />
        <h3 class="font-semibold">進行中任務（{{ data.activeTrips.length }}）</h3>
      </div>
      <div class="divide-y divide-default">
        <div
          v-for="trip in data.activeTrips"
          :key="trip.id"
          class="p-4 grid grid-cols-12 gap-3 text-sm hover:bg-muted/20 cursor-pointer"
          @click="openTrip(trip)"
        >
          <div class="col-span-2">
            <p class="text-xs text-muted">出發 → 預計抵達</p>
            <p class="font-mono">
              {{ formatTime(trip.scheduledAt) }}
              <span class="text-muted">→</span>
              <span class="text-success font-semibold">{{ estimatedArrival(trip) }}</span>
            </p>
          </div>
          <div class="col-span-3">
            <p class="text-xs text-muted">個案 / 機構</p>
            <p class="font-medium truncate">{{ trip.careRecipientName || '—' }}</p>
            <p v-if="trip.organizationName" class="text-xs text-muted truncate">{{ trip.organizationName }}</p>
          </div>
          <div class="col-span-3">
            <p class="text-xs text-muted">司機 / 車輛</p>
            <p class="truncate">{{ trip.driverName || '—' }}</p>
            <p v-if="trip.vehiclePlate" class="text-xs text-muted font-mono">{{ trip.vehiclePlate }}</p>
          </div>
          <div class="col-span-4">
            <p class="text-xs text-muted">目的地</p>
            <p class="truncate">{{ trip.destinationAddress || '—' }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- 異常回報區塊 -->
    <div v-if="data?.incidents?.length" class="border border-default rounded-xl overflow-hidden">
      <div class="px-4 py-3 bg-error/10 border-b border-default flex items-center gap-2">
        <UIcon name="i-lucide-alert-octagon" class="text-error" />
        <h3 class="font-semibold">異常回報（{{ data.unresolvedIncidentCount }} 筆未處理 / {{ data.incidents.length }} 筆全部）</h3>
      </div>
      <div class="divide-y divide-default">
        <div
          v-for="i in data.incidents.slice(0, 6)"
          :key="i.id"
          class="p-4 flex items-start gap-3 text-sm"
          :class="i.resolved ? 'opacity-60' : ''"
        >
          <UBadge :color="incidentTypeColor[i.type] || 'neutral'" variant="subtle" size="md" class="shrink-0">
            {{ incidentTypeLabel[i.type] || i.type }}
          </UBadge>
          <div class="flex-1 min-w-0">
            <p class="font-medium">
              {{ i.careRecipientName || '—' }}
              <span class="text-muted text-xs">/ 司機 {{ i.driverName || '—' }}</span>
            </p>
            <p v-if="i.description" class="text-xs text-muted mt-0.5 whitespace-pre-line">{{ i.description }}</p>
            <p class="text-xs text-muted mt-0.5">回報時間：{{ formatDateTime(i.reportedAt) }}</p>
          </div>
          <UButton
            v-if="!i.resolved"
            size="xs"
            color="primary"
            variant="outline"
            icon="i-lucide-check"
            @click="openResolve(i)"
          >處理</UButton>
          <UBadge v-else color="success" variant="subtle" size="xs">已處理</UBadge>
        </div>
      </div>
    </div>

    <!-- 告警區塊 -->
    <div class="space-y-4">
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
    </div>

    <!-- 訂單詳情 Modal -->
    <UModal v-model:open="showTripModal" title="訂單詳情" description=" ">
      <template #content>
        <div v-if="selectedTrip" class="p-6 space-y-3 text-sm">
          <div><span class="text-muted">個案：</span>{{ selectedTrip.careRecipientName || '—' }}</div>
          <div><span class="text-muted">時間：</span>{{ formatDateTime(selectedTrip.scheduledAt) }}</div>
          <div><span class="text-muted">起點：</span>{{ selectedTrip.originAddress || '—' }}</div>
          <div><span class="text-muted">終點：</span>{{ selectedTrip.destinationAddress || '—' }}</div>
          <div><span class="text-muted">司機：</span>{{ selectedTrip.driverName || '—' }}</div>
          <div><span class="text-muted">車牌：</span>{{ selectedTrip.vehiclePlate || '—' }}</div>
          <div class="flex justify-end pt-2">
            <UButton color="neutral" variant="outline" @click="showTripModal = false">關閉</UButton>
          </div>
        </div>
      </template>
    </UModal>

    <!-- 待派訂單 Modal -->
    <UModal v-model:open="showPendingModal" title="待派訂單" description=" ">
      <template #content>
        <div class="p-6 space-y-3">
          <div v-if="!data?.pendingTrips?.length" class="text-center text-muted text-sm py-4">目前無待派訂單</div>
          <div
            v-for="trip in data?.pendingTrips"
            :key="trip.id"
            class="border border-default rounded-lg p-3 space-y-1.5 text-sm"
          >
            <div class="flex items-center justify-between">
              <span class="font-medium">{{ trip.careRecipientName || '—' }}</span>
              <span class="text-muted text-xs">{{ formatTime(trip.scheduledAt) }}</span>
            </div>
            <div class="text-muted text-xs">{{ trip.originAddress }} → {{ trip.destinationAddress }}</div>
          </div>
          <div class="flex justify-end pt-2">
            <UButton color="neutral" variant="outline" @click="showPendingModal = false">關閉</UButton>
          </div>
        </div>
      </template>
    </UModal>

    <!-- 進行中 Modal -->
    <UModal v-model:open="showActiveModal" title="進行中任務" description=" ">
      <template #content>
        <div class="p-6 space-y-3">
          <div v-if="!data?.activeTrips?.length" class="text-center text-muted text-sm py-4">目前無進行中任務</div>
          <div
            v-for="trip in data?.activeTrips"
            :key="trip.id"
            class="border border-default rounded-lg p-3 space-y-2 text-sm"
          >
            <div class="flex items-center justify-between">
              <span class="font-medium">{{ trip.careRecipientName || '—' }}</span>
              <span class="text-success font-semibold text-xs">預計 {{ estimatedArrival(trip) }}</span>
            </div>
            <p class="text-xs text-muted truncate">→ {{ trip.destinationAddress }}</p>
            <p class="text-xs text-muted">司機：{{ trip.driverName || '—' }} {{ trip.vehiclePlate || '' }}</p>
          </div>
          <div class="flex justify-end pt-2">
            <UButton color="neutral" variant="outline" @click="showActiveModal = false">關閉</UButton>
          </div>
        </div>
      </template>
    </UModal>

    <!-- 異常回報全部列表 Modal -->
    <UModal v-model:open="showIncidentsModal" title="異常回報" description=" " size="lg">
      <template #content>
        <div class="p-6 space-y-3 max-h-[80vh] overflow-y-auto">
          <div v-if="!data?.incidents?.length" class="text-center text-muted text-sm py-4">區間內無異常回報</div>
          <div
            v-for="i in data?.incidents"
            :key="i.id"
            class="border border-default rounded-lg p-3 space-y-1 text-sm"
            :class="i.resolved ? 'opacity-60' : ''"
          >
            <div class="flex items-center gap-2">
              <UBadge :color="incidentTypeColor[i.type] || 'neutral'" variant="subtle" size="xs">
                {{ incidentTypeLabel[i.type] || i.type }}
              </UBadge>
              <span class="font-medium text-xs">{{ i.careRecipientName || '—' }}</span>
              <UBadge v-if="i.resolved" color="success" variant="subtle" size="xs">已處理</UBadge>
              <UButton
                v-else
                size="xs"
                color="primary"
                variant="outline"
                icon="i-lucide-check"
                class="ml-auto"
                @click="openResolve(i)"
              >處理</UButton>
            </div>
            <p v-if="i.description" class="text-xs whitespace-pre-line">{{ i.description }}</p>
            <p class="text-xs text-muted">司機：{{ i.driverName || '—' }} · 回報於 {{ formatDateTime(i.reportedAt) }}</p>
          </div>
          <div class="flex justify-end pt-2">
            <UButton color="neutral" variant="outline" @click="showIncidentsModal = false">關閉</UButton>
          </div>
        </div>
      </template>
    </UModal>

    <!-- 處理 incident Modal -->
    <UModal v-model:open="showResolveModal" title="標記處理完成" description=" ">
      <template #content>
        <div class="p-6 space-y-4">
          <p class="text-sm">
            <UBadge :color="incidentTypeColor[resolvingIncident?.type] || 'neutral'" variant="subtle" size="xs">
              {{ incidentTypeLabel[resolvingIncident?.type] || resolvingIncident?.type }}
            </UBadge>
            <span class="ml-2 text-muted">{{ resolvingIncident?.careRecipientName || '—' }}</span>
          </p>
          <UFormField label="處理說明（選填）">
            <UTextarea v-model="resolutionNote" :rows="3" placeholder="例：已聯絡個案家屬處理、已協調改派時段" class="w-full" />
          </UFormField>
          <div class="flex justify-end gap-2">
            <UButton color="neutral" variant="ghost" @click="showResolveModal = false">取消</UButton>
            <UButton color="primary" :loading="resolving" @click="submitResolve">確認處理</UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
