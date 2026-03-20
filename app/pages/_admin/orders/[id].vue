<script setup lang="ts">
const route = useRoute()
const { api } = useApi()
const toast = useToast()

const trip = ref<any>(null)
const loading = ref(false)

const statusLabel: Record<string, string> = {
  pending: '待派車',
  assigned: '已指派',
  in_progress: '進行中',
  completed: '已完成',
  cancelled: '已取消',
}
const statusColor: Record<string, string> = {
  pending: 'warning',
  assigned: 'info',
  in_progress: 'primary',
  completed: 'success',
  cancelled: 'neutral',
}

async function load() {
  loading.value = true
  try {
    trip.value = await api<any>(`/api/dispatch/trips/${route.params.id}`)
  } catch {
    toast.add({ title: '載入失敗', color: 'error' })
  } finally {
    loading.value = false
  }
}

function formatDateTime(dt: string | null) {
  if (!dt) return '—'
  return new Date(dt).toLocaleString('zh-TW', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

onMounted(load)
</script>

<template>
  <div class="max-w-2xl space-y-6">
    <div class="flex items-center gap-3">
      <NuxtLink to="/_admin/orders">
        <UButton icon="i-lucide-arrow-left" variant="ghost" size="sm" />
      </NuxtLink>
      <h1 class="text-xl font-bold">訂單詳情</h1>
    </div>

    <div v-if="loading" class="text-center py-12 text-muted">
      <UIcon name="i-lucide-loader-2" class="text-2xl animate-spin" />
    </div>

    <template v-else-if="trip">
      <!-- 狀態 -->
      <div class="flex items-center gap-2">
        <UBadge :color="statusColor[trip.status] || 'neutral'" variant="subtle" size="lg">
          {{ statusLabel[trip.status] || trip.status }}
        </UBadge>
        <span class="text-xs text-muted">ID: {{ trip.id }}</span>
      </div>

      <!-- 基本資訊 -->
      <div class="border border-default rounded-xl divide-y divide-default">
        <div class="px-4 py-3 grid grid-cols-3 gap-2">
          <span class="text-sm text-muted">案主</span>
          <span class="col-span-2 text-sm font-medium">{{ trip.careRecipient?.name || '—' }}</span>
        </div>
        <div class="px-4 py-3 grid grid-cols-3 gap-2">
          <span class="text-sm text-muted">特殊需求</span>
          <span class="col-span-2 text-sm">{{ trip.careRecipient?.specialNeeds || '無' }}</span>
        </div>
        <div class="px-4 py-3 grid grid-cols-3 gap-2">
          <span class="text-sm text-muted">輪椅需求</span>
          <span class="col-span-2 text-sm">
            <UBadge v-if="trip.needsWheelchair" label="需要" color="info" size="xs" />
            <span v-else class="text-muted">不需要</span>
          </span>
        </div>
        <div class="px-4 py-3 grid grid-cols-3 gap-2">
          <span class="text-sm text-muted">預定出發</span>
          <span class="col-span-2 text-sm">{{ formatDateTime(trip.scheduledAt) }}</span>
        </div>
        <div class="px-4 py-3 grid grid-cols-3 gap-2">
          <span class="text-sm text-muted">預定抵達</span>
          <span class="col-span-2 text-sm">{{ formatDateTime(trip.scheduledEndAt) }}</span>
        </div>
        <div class="px-4 py-3 grid grid-cols-3 gap-2">
          <span class="text-sm text-muted">起點</span>
          <span class="col-span-2 text-sm">{{ trip.originAddress || '—' }}</span>
        </div>
        <div class="px-4 py-3 grid grid-cols-3 gap-2">
          <span class="text-sm text-muted">終點</span>
          <span class="col-span-2 text-sm">{{ trip.destinationAddress || '—' }}</span>
        </div>
        <div class="px-4 py-3 grid grid-cols-3 gap-2">
          <span class="text-sm text-muted">司機</span>
          <span class="col-span-2 text-sm">{{ trip.driver?.name || '未指派' }}</span>
        </div>
        <div class="px-4 py-3 grid grid-cols-3 gap-2">
          <span class="text-sm text-muted">車輛</span>
          <span class="col-span-2 text-sm">
            {{ trip.vehicle ? `${trip.vehicle.plate}（${trip.vehicle.vehicleType}）` : '未指派' }}
          </span>
        </div>
        <div v-if="trip.mileageActual" class="px-4 py-3 grid grid-cols-3 gap-2">
          <span class="text-sm text-muted">實際里程</span>
          <span class="col-span-2 text-sm">{{ trip.mileageActual }} km</span>
        </div>
        <div v-if="trip.notes" class="px-4 py-3 grid grid-cols-3 gap-2">
          <span class="text-sm text-muted">備註</span>
          <span class="col-span-2 text-sm">{{ trip.notes }}</span>
        </div>
      </div>

      <!-- 建立時間 -->
      <p class="text-xs text-muted">建立於 {{ formatDateTime(trip.createdAt) }}</p>
    </template>

    <div v-else class="text-center py-12 text-muted">找不到此訂單</div>
  </div>
</template>
