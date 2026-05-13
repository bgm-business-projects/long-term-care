<script setup lang="ts">
const { api } = useApi()
const positions = ref<any[]>([])
const mapContainer = ref<HTMLElement | null>(null)
let map: any = null
let L: any = null
let markers: any[] = []

type LogStatus = 'departed' | 'arrived_origin' | 'recipient_boarded' | 'completed'

const STATUS_META: Record<LogStatus, { label: string; color: string; icon: string }> = {
  departed: { label: '已出發', color: '#2563eb', icon: 'i-lucide-car' },
  arrived_origin: { label: '抵達接送點', color: '#f59e0b', icon: 'i-lucide-map-pin' },
  recipient_boarded: { label: '個案已上車', color: '#16a34a', icon: 'i-lucide-user-check' },
  completed: { label: '已完成', color: '#6b7280', icon: 'i-lucide-check-circle-2' },
}

function statusLabel(s: string | null | undefined): string {
  if (!s) return '尚未打卡'
  return STATUS_META[s as LogStatus]?.label ?? s
}

function statusColor(s: string | null | undefined): string {
  return STATUS_META[s as LogStatus]?.color ?? '#6b7280'
}

// 對應每個狀態的 SVG（內嵌避免依賴外部）
const STATUS_SVG: Record<LogStatus, string> = {
  // 車子
  departed: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>',
  // 地址 pin
  arrived_origin: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg>',
  // 人 (打勾)
  recipient_boarded: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M2 21a8 8 0 0 1 13.292-6"/><circle cx="10" cy="8" r="5"/><path d="m16 19 2 2 4-4"/></svg>',
  // 大綠勾
  completed: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>',
}

function buildIcon(status: string | null | undefined) {
  const key = (status as LogStatus) ?? 'departed'
  const color = statusColor(key)
  const svg = STATUS_SVG[key as LogStatus] ?? STATUS_SVG.departed
  const html = `<div class="fleet-marker" style="background:${color}">${svg}</div>`
  return L.divIcon({ html, className: 'fleet-marker-wrap', iconSize: [34, 34], iconAnchor: [17, 17] })
}

async function loadPositions() {
  try {
    positions.value = await api<any[]>('/api/dispatch/fleet/positions')
    updateMarkers()
  } catch (e) {}
}

onMounted(async () => {
  // 動態載入 Leaflet（OpenStreetMap，開源免費）
  L = (await import('leaflet')).default
  await import('leaflet/dist/leaflet.css')

  map = L.map(mapContainer.value!).setView([25.033, 121.565], 12)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
  }).addTo(map)

  await loadPositions()
})

function updateMarkers() {
  markers.forEach(m => m.remove())
  markers = []

  if (!map || !L) return

  positions.value.forEach(pos => {
    if (!pos.lat || !pos.lng) return
    const marker = L.marker([Number(pos.lat), Number(pos.lng)], { icon: buildIcon(pos.last_status) })
      .addTo(map)
    // Tooltip：滑過顯示車牌 + 狀態；點擊開啟訂單 dialog
    marker.bindTooltip(
      `<b>${pos.plate}</b> · <span style="color:${statusColor(pos.last_status)}">${statusLabel(pos.last_status)}</span>`,
      { direction: 'top', offset: [0, -16] },
    )
    marker.on('click', () => openTripDialog(pos.trip_id))
    markers.push(marker)
  })
}

// ── 訂單詳情 dialog ──
const showTripModal = ref(false)
const selectedTripId = ref<string | null>(null)
const tripDetail = ref<any>(null)
const tripDetailLoading = ref(false)
const tripDetailPosition = computed(() =>
  positions.value.find(p => p.trip_id === selectedTripId.value) ?? null,
)

const TRIP_STATUS_LABEL: Record<string, string> = {
  pending: '待派',
  assigned: '已指派',
  in_progress: '進行中',
  completed: '已完成',
  cancelled: '已取消',
}

function tripStatusLabel(s: string | null | undefined): string {
  return s ? TRIP_STATUS_LABEL[s] ?? s : '—'
}

async function openTripDialog(tripId: string) {
  selectedTripId.value = tripId
  showTripModal.value = true
  tripDetail.value = null
  tripDetailLoading.value = true
  try {
    tripDetail.value = await api(`/api/dispatch/trips/${tripId}`)
  } catch {
    tripDetail.value = null
  } finally {
    tripDetailLoading.value = false
  }
}

function formatTime(dt: string | null | undefined): string {
  if (!dt) return '—'
  return new Date(dt).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })
}

function formatDateTime(dt: string | null | undefined): string {
  if (!dt) return '—'
  return new Date(dt).toLocaleString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

// 30 秒自動刷新
const refreshInterval = setInterval(loadPositions, 30000)
onUnmounted(() => clearInterval(refreshInterval))
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between flex-wrap gap-3">
      <h1 class="text-xl font-bold">車隊即時動態</h1>
      <div class="flex items-center gap-3 flex-wrap">
        <!-- 圖例 -->
        <div class="flex items-center gap-3 text-xs border border-default rounded-md px-3 py-1.5">
          <span class="flex items-center gap-1">
            <span class="w-4 h-4 rounded-full" style="background:#2563eb" />已出發
          </span>
          <span class="flex items-center gap-1">
            <span class="w-4 h-4 rounded-full" style="background:#f59e0b" />抵達接送點
          </span>
          <span class="flex items-center gap-1">
            <span class="w-4 h-4 rounded-full" style="background:#16a34a" />個案已上車
          </span>
          <span class="flex items-center gap-1">
            <span class="w-4 h-4 rounded-full" style="background:#6b7280" />已完成
          </span>
        </div>
        <span class="text-xs text-muted">每 30 秒自動更新</span>
        <UButton size="sm" icon="i-lucide-refresh-cw" variant="outline" @click="loadPositions">
          立即更新
        </UButton>
      </div>
    </div>
    <div ref="mapContainer" class="w-full h-[calc(100vh-200px)] rounded-xl border border-default" />

    <!-- 訂單詳情 -->
    <UModal v-model:open="showTripModal" title="訂單詳情" description=" " size="lg">
      <template #content>
        <div class="p-6 space-y-4 max-h-[85vh] overflow-y-auto">
          <div v-if="tripDetailLoading" class="text-center py-12 text-muted">載入中…</div>
          <template v-else-if="tripDetail">
            <!-- Header -->
            <div class="flex items-start justify-between gap-3 pb-3 border-b border-default">
              <div>
                <p class="text-xs text-muted">{{ tripDetail.id }}</p>
                <h3 class="font-semibold text-lg mt-1">{{ tripDetail.careRecipientName || '未知個案' }}</h3>
                <p class="text-sm text-muted mt-0.5">
                  {{ formatDateTime(tripDetail.scheduledAt) }}
                  <span v-if="tripDetail.scheduledEndAt"> ~ {{ formatTime(tripDetail.scheduledEndAt) }}</span>
                </p>
              </div>
              <div class="flex flex-col items-end gap-1">
                <UBadge :label="tripStatusLabel(tripDetail.status)"
                  :color="tripDetail.status === 'in_progress' ? 'success' : tripDetail.status === 'assigned' ? 'info' : tripDetail.status === 'completed' ? 'neutral' : tripDetail.status === 'cancelled' ? 'error' : 'warning'"
                  size="sm" />
                <UBadge v-if="tripDetail.needsWheelchair" label="輪椅" color="info" variant="subtle" size="xs" />
              </div>
            </div>

            <!-- 司機/車輛 -->
            <div class="grid grid-cols-2 gap-3">
              <div class="bg-elevated rounded-lg p-3">
                <p class="text-xs text-muted mb-1">司機</p>
                <p class="font-medium">{{ tripDetail.driverName || '—' }}</p>
                <p class="text-xs text-muted truncate">{{ tripDetail.driverEmail || '' }}</p>
              </div>
              <div class="bg-elevated rounded-lg p-3">
                <p class="text-xs text-muted mb-1">車輛</p>
                <p class="font-medium">{{ tripDetail.vehiclePlate || '—' }}</p>
                <p class="text-xs text-muted">{{ tripDetail.vehicleType || '' }}</p>
              </div>
            </div>

            <!-- 即時動態狀態 -->
            <div v-if="tripDetailPosition" class="border border-default rounded-lg p-3 space-y-1.5">
              <p class="text-xs font-medium text-muted flex items-center gap-1">
                <UIcon name="i-lucide-radio" class="text-success" />
                即時狀態
              </p>
              <p class="text-sm">
                <span class="text-muted">最新打卡：</span>
                <span class="font-medium" :style="`color: ${statusColor(tripDetailPosition.last_status)}`">
                  {{ statusLabel(tripDetailPosition.last_status) }}
                </span>
                <span class="text-muted ml-2">{{ formatTime(tripDetailPosition.last_update) }}</span>
              </p>
              <p class="text-xs text-muted">
                位置：{{ tripDetailPosition.lat }}, {{ tripDetailPosition.lng }}
              </p>
            </div>

            <!-- 路線 -->
            <div class="space-y-2">
              <p class="text-sm font-medium">路線</p>
              <div class="space-y-2">
                <div class="flex items-start gap-3">
                  <div class="shrink-0 w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center mt-0.5">
                    <UIcon name="i-lucide-map-pin" class="text-primary" />
                  </div>
                  <div class="flex-1 min-w-0 text-sm">
                    <p class="text-muted text-xs">上車地點</p>
                    <p>{{ tripDetail.originAddress }}</p>
                  </div>
                </div>
                <div class="flex items-start gap-3">
                  <div class="shrink-0 w-7 h-7 rounded-full bg-success/20 flex items-center justify-center mt-0.5">
                    <UIcon name="i-lucide-flag" class="text-success" />
                  </div>
                  <div class="flex-1 min-w-0 text-sm">
                    <p class="text-muted text-xs">目的地</p>
                    <p>{{ tripDetail.destinationAddress }}</p>
                  </div>
                </div>
              </div>
            </div>

            <!-- 里程 / 備註 -->
            <div v-if="tripDetail.mileageActual || tripDetail.mileageEstimated || tripDetail.notes" class="grid grid-cols-2 gap-3 text-xs">
              <div v-if="tripDetail.mileageActual || tripDetail.mileageEstimated" class="bg-elevated rounded-lg p-3">
                <p class="text-muted">里程</p>
                <p class="font-medium text-sm mt-0.5">
                  {{ tripDetail.mileageActual ?? tripDetail.mileageEstimated }} km
                  <span v-if="tripDetail.mileageActual" class="text-muted text-xs">（實際）</span>
                  <span v-else class="text-muted text-xs">（預估）</span>
                </p>
              </div>
              <div v-if="tripDetail.notes" class="bg-elevated rounded-lg p-3 col-span-2">
                <p class="text-muted mb-0.5">備註</p>
                <p class="text-sm whitespace-pre-line">{{ tripDetail.notes }}</p>
              </div>
            </div>
          </template>
          <div v-else class="text-center py-12 text-error">找不到此訂單</div>

          <div class="flex justify-end pt-3 border-t border-default">
            <UButton color="neutral" variant="outline" @click="showTripModal = false">關閉</UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>

<style>
.fleet-marker-wrap { background: transparent; border: none; }
.fleet-marker {
  width: 34px; height: 34px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  color: white;
  box-shadow: 0 2px 8px rgba(0,0,0,0.35);
  border: 2px solid white;
}
</style>
