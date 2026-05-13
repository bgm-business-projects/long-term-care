<script setup lang="ts">
interface Props {
  open: boolean
  carpoolGroupId: string | null
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:open': [value: boolean]
  dissolved: []
}>()

const { api } = useApi()
const toast = useToast()

interface Stop {
  tripId: string
  careRecipientName: string | null
  careRecipientPhone: string | null
  originAddress: string
  originLat: string | null
  originLng: string | null
  destinationAddress: string
  destinationLat: string | null
  destinationLng: string | null
  scheduledAt: string
  carpoolOrder: number | null
  carpoolPickupAt: string | null
  carpoolDropoffOrder: number | null
  carpoolDropoffAt: string | null
  scheduledEndAt: string | null
  needsWheelchair: boolean
}
interface Group {
  id: string
  driverUserId: string | null
  vehicleId: string | null
  destinationAddress: string
  destinationLat: string | null
  destinationLng: string | null
  scheduledAt: string
  scheduledEndAt: string | null
  status: string
  totalDistanceMeters: number | null
  totalDurationMinutes: number | null
}
interface Detail {
  group: Group
  stops: Stop[]
  driver: { userId: string; name: string; phone: string | null; fleetName: string | null } | null
  vehicle: { id: string; plate: string; vehicleType: string; homeAddress: string | null; homeLat: string | null; homeLng: string | null } | null
}

const detail = ref<Detail | null>(null)
const loading = ref(false)
const dissolving = ref(false)

watch(() => [props.open, props.carpoolGroupId], async ([isOpen, id]) => {
  if (isOpen && id) {
    loading.value = true
    try {
      detail.value = await api<Detail>(`/api/dispatch/carpool/${id}`)
    } catch {
      detail.value = null
    } finally {
      loading.value = false
    }
  }
})

function formatTime(dt: string | null | undefined): string {
  if (!dt) return '—'
  return new Date(dt).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })
}

function pickupWaitMinutes(stop: Stop): number {
  if (!stop.carpoolPickupAt) return 0
  return Math.round((new Date(stop.carpoolPickupAt).getTime() - new Date(stop.scheduledAt).getTime()) / 60_000)
}

const totalKm = computed(() => detail.value?.group.totalDistanceMeters
  ? (detail.value.group.totalDistanceMeters / 1000).toFixed(1)
  : null,
)

// 依下車順序（缺失時用 pickup 順序當 fallback）
const dropoffStops = computed<Stop[]>(() => {
  if (!detail.value) return []
  return [...detail.value.stops].sort((a, b) => {
    const ao = a.carpoolDropoffOrder ?? a.carpoolOrder ?? 0
    const bo = b.carpoolDropoffOrder ?? b.carpoolOrder ?? 0
    return ao - bo
  })
})

const isMultiDestination = computed(() => {
  if (!detail.value) return false
  const keys = new Set(detail.value.stops.map(s => `${s.destinationLat},${s.destinationLng}`))
  return keys.size > 1
})

function dropoffTime(stop: Stop): string | null {
  return stop.carpoolDropoffAt || stop.scheduledEndAt || null
}

// 地圖檢視
const showMap = ref(false)

interface MapPoint {
  lat: number
  lng: number
  label: string
  sub?: string
  kind: 'start' | 'stop' | 'dest'
  order?: number
}

const mapPoints = computed<MapPoint[]>(() => {
  const d = detail.value
  if (!d) return []
  const pts: MapPoint[] = []
  if (d.vehicle?.homeLat && d.vehicle?.homeLng) {
    pts.push({
      lat: Number(d.vehicle.homeLat),
      lng: Number(d.vehicle.homeLng),
      label: '司機起點',
      sub: d.vehicle.homeAddress || undefined,
      kind: 'start',
    })
  }
  // 上車站（依 carpoolOrder）
  for (const s of d.stops) {
    if (s.originLat && s.originLng) {
      pts.push({
        lat: Number(s.originLat),
        lng: Number(s.originLng),
        label: `${s.careRecipientName || '乘客'} 上車`,
        sub: s.originAddress,
        kind: 'stop',
        order: s.carpoolOrder ?? undefined,
      })
    }
  }
  // 下車站（依 carpoolDropoffOrder，多目的地 = 多個 marker；單目的地 = 一個合併）
  if (isMultiDestination.value) {
    for (const s of dropoffStops.value) {
      if (s.destinationLat && s.destinationLng) {
        pts.push({
          lat: Number(s.destinationLat),
          lng: Number(s.destinationLng),
          label: `${s.careRecipientName || '乘客'} 下車`,
          sub: s.destinationAddress,
          kind: 'dest',
          order: s.carpoolDropoffOrder ?? undefined,
        })
      }
    }
  } else if (d.group.destinationLat && d.group.destinationLng) {
    pts.push({
      lat: Number(d.group.destinationLat),
      lng: Number(d.group.destinationLng),
      label: '目的地',
      sub: d.group.destinationAddress,
      kind: 'dest',
    })
  }
  return pts
})

const canShowMap = computed(() => mapPoints.value.length >= 2)

async function dissolve() {
  if (!detail.value) return
  if (!confirm(`確認解散此共乘？所有 ${detail.value.stops.length} 筆訂單將回到待派狀態。`)) return
  dissolving.value = true
  try {
    await api(`/api/dispatch/carpool/${detail.value.group.id}`, { method: 'DELETE' })
    toast.add({ title: '已解散共乘', color: 'success' })
    emit('dissolved')
  } catch (err: any) {
    toast.add({ title: err?.data?.statusMessage || '操作失敗', color: 'error' })
  } finally {
    dissolving.value = false
  }
}
</script>

<template>
  <UModal :open="props.open" title="共乘詳情" description=" " size="xl" @update:open="(v: boolean) => emit('update:open', v)">
    <template #content>
      <div class="p-6 space-y-4 max-h-[85vh] overflow-y-auto">
        <div v-if="loading" class="text-center py-12 text-muted">載入中…</div>
        <template v-else-if="detail">
          <!-- Header -->
          <div class="flex items-start justify-between gap-3 pb-3 border-b border-default">
            <div>
              <h3 class="font-semibold text-lg flex items-center gap-2">
                <UIcon name="i-lucide-users" class="text-purple-600" />
                共乘 {{ detail.stops.length }} 人
                <UBadge v-if="detail.group.status !== 'planned'" :label="detail.group.status" color="info" size="xs" />
              </h3>
              <p class="text-sm text-muted mt-1">→ {{ detail.group.destinationAddress }}</p>
            </div>
            <div class="text-right text-xs text-muted">
              <p>{{ formatTime(detail.group.scheduledAt) }} - {{ formatTime(detail.group.scheduledEndAt) }}</p>
              <p v-if="totalKm">{{ totalKm }} km / {{ detail.group.totalDurationMinutes }} 分鐘</p>
            </div>
          </div>

          <!-- 司機資訊 -->
          <div v-if="detail.driver" class="bg-elevated rounded p-3 text-sm">
            <p>
              <span class="text-muted">司機：</span>
              <span class="font-medium">{{ detail.driver.name }}</span>
              <span v-if="detail.driver.fleetName" class="text-muted ml-1">（{{ detail.driver.fleetName }}）</span>
            </p>
            <p v-if="detail.vehicle" class="text-muted text-xs mt-1">
              {{ detail.vehicle.plate }} · {{ detail.vehicle.vehicleType }}
            </p>
            <p v-if="detail.vehicle?.homeAddress" class="text-muted text-xs mt-0.5">
              起始地：{{ detail.vehicle.homeAddress }}
            </p>
          </div>

          <!-- 路線 -->
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <p class="text-sm font-medium">路線順序</p>
              <UButton
                v-if="canShowMap"
                size="xs"
                color="neutral"
                variant="outline"
                icon="i-lucide-map"
                @click="showMap = true"
              >地圖檢視</UButton>
            </div>
            <div class="relative space-y-2">
              <!-- 起點 -->
              <div v-if="detail.vehicle?.homeAddress" class="flex items-start gap-3">
                <div class="shrink-0 w-7 h-7 rounded-full bg-muted/30 flex items-center justify-center mt-0.5">
                  <UIcon name="i-lucide-warehouse" class="text-muted" />
                </div>
                <div class="flex-1 min-w-0 text-sm">
                  <p class="text-muted text-xs">司機起點</p>
                  <p class="truncate">{{ detail.vehicle.homeAddress }}</p>
                </div>
              </div>

              <!-- 各乘客上車點 -->
              <div v-for="stop in detail.stops" :key="stop.tripId" class="flex items-start gap-3">
                <div class="shrink-0 w-7 h-7 rounded-full bg-primary text-white font-bold text-xs flex items-center justify-center mt-0.5">
                  {{ stop.carpoolOrder }}
                </div>
                <div class="flex-1 min-w-0 text-sm">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="font-medium">{{ stop.careRecipientName }}</span>
                    <UBadge v-if="stop.needsWheelchair" label="輪椅" color="info" variant="subtle" size="xs" />
                  </div>
                  <p class="text-muted text-xs truncate">{{ stop.originAddress }}</p>
                  <p class="text-xs mt-0.5">
                    <span class="text-muted">原約 {{ formatTime(stop.scheduledAt) }}</span>
                    <span class="mx-1">→</span>
                    <span class="font-medium">實際 {{ formatTime(stop.carpoolPickupAt) }}</span>
                    <template v-if="pickupWaitMinutes(stop) > 0">
                      <span class="ml-2 text-warning">⏱ 多等 {{ pickupWaitMinutes(stop) }} 分鐘</span>
                    </template>
                    <template v-else>
                      <span class="ml-2 text-success">準時</span>
                    </template>
                  </p>
                </div>
              </div>

              <!-- 下車站 -->
              <template v-if="isMultiDestination">
                <div
                  v-for="drop in dropoffStops"
                  :key="`dp-${drop.tripId}`"
                  class="flex items-start gap-3 pt-2 border-t border-default/60"
                >
                  <div class="shrink-0 w-7 h-7 rounded-full bg-success text-white font-bold text-xs flex items-center justify-center mt-0.5">
                    {{ drop.carpoolDropoffOrder ?? '·' }}
                  </div>
                  <div class="flex-1 min-w-0 text-sm">
                    <p class="font-medium">{{ drop.careRecipientName }} 下車</p>
                    <p class="text-muted text-xs truncate">{{ drop.destinationAddress }}</p>
                    <p class="text-success text-xs mt-0.5">預估 {{ formatTime(dropoffTime(drop)) }}</p>
                  </div>
                </div>
              </template>
              <!-- 單目的地：合併一筆 -->
              <div v-else class="flex items-start gap-3 pt-2 border-t border-default">
                <div class="shrink-0 w-7 h-7 rounded-full bg-success/20 flex items-center justify-center mt-0.5">
                  <UIcon name="i-lucide-flag" class="text-success" />
                </div>
                <div class="flex-1 min-w-0 text-sm">
                  <p class="font-medium">抵達目的地</p>
                  <p class="text-muted text-xs truncate">{{ detail.group.destinationAddress }}</p>
                  <p class="text-success text-xs mt-0.5">預估 {{ formatTime(detail.group.scheduledEndAt) }}</p>
                </div>
              </div>
            </div>
          </div>

          <!-- 動作 -->
          <div class="flex justify-between pt-3 border-t border-default">
            <UButton color="error" variant="ghost" icon="i-lucide-unlink" :loading="dissolving" @click="dissolve">
              解散共乘
            </UButton>
            <UButton color="neutral" variant="outline" @click="emit('update:open', false)">關閉</UButton>
          </div>
        </template>
      </div>
    </template>
  </UModal>

  <!-- 地圖檢視 modal -->
  <GanttCarpoolMapModal
    v-model:open="showMap"
    :points="mapPoints"
    title="共乘路線地圖"
  />
</template>
