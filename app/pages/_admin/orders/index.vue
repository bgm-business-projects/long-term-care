<script setup lang="ts">
const toast = useToast()
const { api } = useApi()

const trips = ref<any[]>([])
const loading = ref(false)

const filterDate = ref(new Date().toISOString().slice(0, 10))
const filterStatus = ref('')

const showCancelModal = ref(false)
const cancellingItem = ref<any>(null)

const statusOptions = [
  { label: '全部狀態', value: '' },
  { label: '待確認', value: 'pending' },
  { label: '已確認', value: 'confirmed' },
  { label: '進行中', value: 'in_progress' },
  { label: '已完成', value: 'completed' },
  { label: '已取消', value: 'cancelled' },
]

const statusLabel: Record<string, string> = {
  pending: '待確認',
  confirmed: '已確認',
  in_progress: '進行中',
  completed: '已完成',
  cancelled: '已取消',
}

const statusColor: Record<string, string> = {
  pending: 'warning',
  confirmed: 'info',
  in_progress: 'primary',
  completed: 'success',
  cancelled: 'neutral',
}

const filteredTrips = computed(() => {
  return trips.value.filter((t: any) => {
    if (filterStatus.value && t.status !== filterStatus.value) return false
    return true
  })
})

async function loadTrips() {
  loading.value = true
  try {
    const params = new URLSearchParams()
    if (filterDate.value) params.set('date', filterDate.value)
    if (filterStatus.value) params.set('status', filterStatus.value)
    const query = params.toString()
    trips.value = await api<any[]>(`/api/dispatch/trips${query ? '?' + query : ''}`)
  } catch (err: any) {
    toast.add({ title: err?.data?.statusMessage || '載入訂單失敗', color: 'error' })
  } finally {
    loading.value = false
  }
}

onMounted(loadTrips)

watch([filterDate], loadTrips)

function formatDateTime(dt: string) {
  if (!dt) return '-'
  return new Date(dt).toLocaleString('zh-TW', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function shortAddress(addr: string) {
  if (!addr) return '-'
  return addr.length > 12 ? addr.slice(0, 12) + '…' : addr
}

function openCancel(t: any) {
  cancellingItem.value = t
  showCancelModal.value = true
}

async function handleCancel() {
  if (!cancellingItem.value) return
  try {
    await api(`/api/dispatch/trips/${cancellingItem.value.id}`, { method: 'DELETE' })
    toast.add({ title: '訂單已取消', color: 'success' })
    showCancelModal.value = false
    await loadTrips()
  } catch (err: any) {
    toast.add({ title: err?.data?.statusMessage || '取消失敗', color: 'error' })
  }
}
</script>

<template>
  <div class="space-y-4">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <h2 class="text-lg font-semibold text-highlighted">訂單列表</h2>
      <NuxtLink to="/_admin/orders/new">
        <UButton icon="i-lucide-plus-circle">新增訂單</UButton>
      </NuxtLink>
    </div>

    <!-- Filters -->
    <div class="flex gap-3 flex-wrap">
      <div>
        <label class="text-xs text-muted block mb-1">日期</label>
        <input
          v-model="filterDate"
          type="date"
          class="px-3 py-2 border border-default rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>
      <div>
        <label class="text-xs text-muted block mb-1">狀態</label>
        <USelect
          v-model="filterStatus"
          :options="statusOptions"
          class="w-36"
          @change="loadTrips"
        />
      </div>
      <div class="flex items-end">
        <UButton color="neutral" variant="outline" icon="i-lucide-refresh-cw" @click="loadTrips">重新整理</UButton>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex justify-center py-12">
      <UIcon name="i-lucide-loader-2" class="text-2xl animate-spin text-muted" />
    </div>

    <!-- Empty -->
    <div v-else-if="filteredTrips.length === 0" class="text-center py-12 text-muted">
      該日期無訂單資料
    </div>

    <!-- Table -->
    <div v-else class="overflow-x-auto rounded-lg border border-muted">
      <table class="w-full text-sm">
        <thead class="bg-muted/40">
          <tr>
            <th class="text-left px-4 py-3 font-medium text-muted">預約時間</th>
            <th class="text-left px-4 py-3 font-medium text-muted">個案姓名</th>
            <th class="text-left px-4 py-3 font-medium text-muted">起點 → 迄點</th>
            <th class="text-left px-4 py-3 font-medium text-muted">司機</th>
            <th class="text-left px-4 py-3 font-medium text-muted">車牌</th>
            <th class="text-center px-4 py-3 font-medium text-muted">狀態</th>
            <th class="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-muted">
          <tr v-for="t in filteredTrips" :key="t.id" class="hover:bg-muted/20 transition-colors">
            <td class="px-4 py-3 whitespace-nowrap">{{ formatDateTime(t.scheduledAt) }}</td>
            <td class="px-4 py-3 font-medium text-highlighted">{{ t.careRecipient?.name || t.careRecipientName || '-' }}</td>
            <td class="px-4 py-3 text-muted">
              {{ shortAddress(t.originAddress) }} → {{ shortAddress(t.destinationAddress) }}
            </td>
            <td class="px-4 py-3 text-muted">{{ t.driver?.name || t.driverName || '-' }}</td>
            <td class="px-4 py-3 text-muted">{{ t.vehicle?.plate || t.vehiclePlate || '-' }}</td>
            <td class="px-4 py-3 text-center">
              <UBadge :color="statusColor[t.status] || 'neutral'" variant="subtle">
                {{ statusLabel[t.status] || t.status }}
              </UBadge>
            </td>
            <td class="px-4 py-3">
              <div class="flex items-center justify-end gap-2">
                <NuxtLink :to="`/_admin/orders/${t.id}`">
                  <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-eye">查看詳情</UButton>
                </NuxtLink>
                <UButton
                  v-if="t.status !== 'cancelled' && t.status !== 'completed'"
                  size="xs"
                  color="error"
                  variant="ghost"
                  icon="i-lucide-x-circle"
                  @click="openCancel(t)"
                >取消</UButton>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Cancel Confirm Modal -->
    <UModal v-model:open="showCancelModal" title="確認取消訂單" description=" ">
      <template #content>
        <div class="p-6 space-y-4">
          <p class="text-sm text-muted">
            確定要取消
            <span class="font-semibold text-highlighted">{{ cancellingItem?.careRecipient?.name || cancellingItem?.careRecipientName }}</span>
            於 <span class="font-semibold text-highlighted">{{ formatDateTime(cancellingItem?.scheduledAt) }}</span> 的訂單嗎？
          </p>
          <div class="flex justify-end gap-2">
            <UButton color="neutral" variant="outline" @click="showCancelModal = false">返回</UButton>
            <UButton color="error" @click="handleCancel">確認取消</UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
