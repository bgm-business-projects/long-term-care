<script setup lang="ts">
const toast = useToast()
const { api } = useApi()

const trips = ref<any[]>([])
const loading = ref(false)

const filterDate = ref(new Date().toISOString().slice(0, 10))
const filterStatus = ref<string | null>(null)

const showCancelModal = ref(false)
const cancellingItem = ref<any>(null)

// 從排程建立訂單
const showGenerateModal = ref(false)
const generateStep = ref<'range' | 'preview'>('range')
const generating = ref(false)
const previewing = ref(false)
const previewItems = ref<any[]>([])
const previewTab = ref('')

const today = new Date().toISOString().slice(0, 10)
function addDays(dateStr: string, days: number) {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

const generateStartDate = ref(today)
const generateEndDate = ref(addDays(today, 6))

function setGenerateRange(weeks: number) {
  generateStartDate.value = today
  generateEndDate.value = addDays(today, weeks * 7 - 1)
}

function openGenerateModal() {
  generateStep.value = 'range'
  previewItems.value = []
  showGenerateModal.value = true
}

// 個案 tabs
const previewRecipients = computed(() => {
  const map = new Map<string, { id: string; name: string }>()
  for (const o of previewItems.value) {
    if (!map.has(o.careRecipientId)) map.set(o.careRecipientId, { id: o.careRecipientId, name: o.careRecipientName })
  }
  return [...map.values()]
})

const previewFiltered = computed(() =>
  previewItems.value.filter(o => o.careRecipientId === previewTab.value)
)

async function handlePreview() {
  previewing.value = true
  try {
    const items = await api<any[]>('/api/dispatch/recurring-schedules/preview', {
      method: 'POST',
      body: { startDate: generateStartDate.value, endDate: generateEndDate.value },
    })
    previewItems.value = items
    if (previewRecipients.value.length > 0) {
      previewTab.value = previewRecipients.value[0].id
    }
    generateStep.value = 'preview'
  } catch (err: any) {
    toast.add({ title: err?.data?.statusMessage || '預覽失敗', color: 'error' })
  } finally {
    previewing.value = false
  }
}

async function handleGenerate() {
  generating.value = true
  try {
    const result = await api<{ created: number; skipped: number }>('/api/dispatch/recurring-schedules/generate', {
      method: 'POST',
      body: { startDate: generateStartDate.value, endDate: generateEndDate.value },
    })
    toast.add({ title: `已建立 ${result.created} 筆訂單，略過重複 ${result.skipped} 筆`, color: 'success' })
    showGenerateModal.value = false
    await loadTrips()
  } catch (err: any) {
    toast.add({ title: err?.data?.statusMessage || '建立失敗', color: 'error' })
  } finally {
    generating.value = false
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('zh-TW', { month: '2-digit', day: '2-digit', weekday: 'short', hour: '2-digit', minute: '2-digit' })
}

// 個案排程詳情
const showRecipientSchedulesModal = ref(false)
const recipientSchedules = ref<any[]>([])
const recipientSchedulesLoading = ref(false)

const dayLabel = ['日', '一', '二', '三', '四', '五', '六']

function parseDays(daysOfWeek: any): number[] {
  if (Array.isArray(daysOfWeek)) return daysOfWeek
  try { return JSON.parse(daysOfWeek) } catch { return [] }
}

async function viewRecipientSchedules(careRecipientId: string) {
  showRecipientSchedulesModal.value = true
  recipientSchedulesLoading.value = true
  try {
    recipientSchedules.value = await api<any[]>(`/api/dispatch/recurring-schedules?careRecipientId=${careRecipientId}`)
  } catch {
    recipientSchedules.value = []
  } finally {
    recipientSchedulesLoading.value = false
  }
}

const showDetailModal = ref(false)
const detailTrip = ref<any>(null)
const detailLoading = ref(false)

async function openDetail(t: any) {
  showDetailModal.value = true
  detailTrip.value = t
  detailLoading.value = true
  try {
    detailTrip.value = await api<any>(`/api/dispatch/trips/${t.id}`)
  } catch {
    toast.add({ title: '載入詳情失敗', color: 'error' })
  } finally {
    detailLoading.value = false
  }
}

const statusOptions = [
  { label: '全部狀態', value: null },
  { label: '待派車', value: 'pending' },
  { label: '已指派', value: 'assigned' },
  { label: '進行中', value: 'in_progress' },
  { label: '已完成', value: 'completed' },
  { label: '已取消', value: 'cancelled' },
]

const statusLabel: Record<string, string> = {
  pending: '待派車',
  assigned: '已指派',
  in_progress: '進行中',
  completed: '已完成',
  cancelled: '已取消',
}

const specialNeedsLabel: Record<string, string> = {
  general: '一般',
  wheelchair: '輪椅',
  bedridden: '臥床',
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
      <div class="flex gap-2">
        <UButton color="neutral" variant="outline" icon="i-lucide-calendar-check" @click="openGenerateModal">從排程建立訂單</UButton>
        <NuxtLink to="/agency/orders/new">
          <UButton icon="i-lucide-plus-circle">新增訂單</UButton>
        </NuxtLink>
      </div>
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
          :items="statusOptions"
          class="w-36"
          @update:model-value="loadTrips"
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
                <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-eye" @click="openDetail(t)">查看詳情</UButton>
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

    <!-- 從排程建立訂單 Modal -->
    <UModal v-model:open="showGenerateModal" title="從排程建立訂單" description=" " size="xl">
      <template #content>
        <!-- Step 1: 選擇期間 -->
        <div v-if="generateStep === 'range'" class="p-6 space-y-5">
          <p class="text-sm text-muted">依據機構下所有啟用中的週期性排程，批次建立訂單。</p>
          <div class="space-y-3">
            <label class="text-sm font-medium">建立期間</label>
            <div class="flex gap-2 flex-wrap">
              <UButton size="sm" :color="generateEndDate === addDays(today, 6) ? 'primary' : 'neutral'" variant="outline" @click="setGenerateRange(1)">1 週</UButton>
              <UButton size="sm" :color="generateEndDate === addDays(today, 13) ? 'primary' : 'neutral'" variant="outline" @click="setGenerateRange(2)">2 週</UButton>
              <UButton size="sm" :color="generateEndDate === addDays(today, 20) ? 'primary' : 'neutral'" variant="outline" @click="setGenerateRange(3)">3 週</UButton>
              <UButton size="sm" :color="generateEndDate === addDays(today, 27) ? 'primary' : 'neutral'" variant="outline" @click="setGenerateRange(4)">4 週</UButton>
            </div>
            <div class="flex items-center gap-3">
              <div>
                <label class="text-xs text-muted block mb-1">開始日期</label>
                <input v-model="generateStartDate" type="date"
                  class="px-3 py-2 border border-default rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <span class="text-muted mt-5">→</span>
              <div>
                <label class="text-xs text-muted block mb-1">結束日期</label>
                <input v-model="generateEndDate" type="date"
                  class="px-3 py-2 border border-default rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
            </div>
          </div>
          <div class="flex justify-end gap-2 pt-2">
            <UButton color="neutral" variant="outline" @click="showGenerateModal = false">取消</UButton>
            <UButton color="primary" :loading="previewing" icon="i-lucide-eye" @click="handlePreview">預覽訂單</UButton>
          </div>
        </div>

        <!-- Step 2: 預覽確認 -->
        <div v-else class="flex flex-col" style="max-height: 80vh;">
          <div class="px-6 pt-6 pb-3 border-b border-default">
            <p class="text-sm text-muted">
              期間：{{ generateStartDate }} ～ {{ generateEndDate }}
              共 <span class="font-semibold text-highlighted">{{ previewItems.filter(o => !o.exists).length }}</span> 筆待建立，
              <span class="text-muted">{{ previewItems.filter(o => o.exists).length }} 筆已存在</span>
            </p>
          </div>

          <!-- 個案 Tabs -->
          <div v-if="previewRecipients.length > 0" class="flex items-center gap-1 px-6 pt-3 flex-wrap border-b border-default pb-2">
            <button
              v-for="r in previewRecipients"
              :key="r.id"
              class="px-3 py-1.5 text-sm rounded-md transition-colors"
              :class="previewTab === r.id ? 'bg-primary text-white font-medium' : 'text-muted hover:bg-muted/30'"
              @click="previewTab = r.id"
            >
              {{ r.name }}
              <span class="ml-1 text-xs opacity-70">
                {{ previewItems.filter(o => o.careRecipientId === r.id && !o.exists).length }}
              </span>
            </button>
            <UButton
              v-if="previewTab"
              size="xs"
              color="neutral"
              variant="ghost"
              icon="i-lucide-calendar-clock"
              class="ml-auto shrink-0"
              @click="viewRecipientSchedules(previewTab)"
            >查看排程</UButton>
          </div>

          <!-- 訂單列表 -->
          <div class="flex-1 overflow-y-auto px-6 py-3 space-y-1.5" style="min-height: 200px; max-height: 400px;">
            <div v-if="previewFiltered.length === 0" class="text-center py-8 text-muted text-sm">此個案在該期間無排程</div>
            <div
              v-for="(o, i) in previewFiltered"
              :key="i"
              class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm"
              :class="o.exists ? 'bg-muted/20 opacity-60' : 'bg-default border border-default'"
            >
              <UIcon :name="o.exists ? 'i-lucide-check-circle' : 'i-lucide-clock'" :class="o.exists ? 'text-success' : 'text-primary'" class="shrink-0" />
              <div class="flex-1 min-w-0">
                <span class="font-medium">{{ formatDate(o.scheduledAt) }}</span>
                <span class="text-muted ml-2 text-xs truncate">{{ o.originAddress }} → {{ o.destinationAddress }}</span>
              </div>
              <UBadge v-if="o.exists" label="已存在" color="neutral" size="xs" />
              <UBadge v-if="o.needsWheelchair" label="輪椅" color="warning" size="xs" />
            </div>
          </div>

          <div class="flex justify-between items-center gap-2 px-6 py-4 border-t border-default">
            <UButton color="neutral" variant="ghost" icon="i-lucide-arrow-left" @click="generateStep = 'range'">返回修改</UButton>
            <div class="flex gap-2">
              <UButton color="neutral" variant="outline" @click="showGenerateModal = false">取消</UButton>
              <UButton
                color="primary"
                :loading="generating"
                :disabled="previewItems.filter(o => !o.exists).length === 0"
                icon="i-lucide-zap"
                @click="handleGenerate"
              >
                確認建立 {{ previewItems.filter(o => !o.exists).length }} 筆
              </UButton>
            </div>
          </div>
        </div>
      </template>
    </UModal>

    <!-- 個案排程詳情 Modal -->
    <UModal v-model:open="showRecipientSchedulesModal" title="個案週期排程" description=" ">
      <template #content>
        <div class="p-6 space-y-3">
          <div v-if="recipientSchedulesLoading" class="flex justify-center py-8">
            <UIcon name="i-lucide-loader-2" class="text-2xl animate-spin text-muted" />
          </div>
          <div v-else-if="recipientSchedules.length === 0" class="text-center py-8 text-muted text-sm">此個案尚無排程</div>
          <div v-else class="space-y-2">
            <div v-for="s in recipientSchedules" :key="s.id" class="border border-default rounded-lg px-4 py-3 space-y-1">
              <div class="flex items-center gap-2">
                <div class="flex gap-1">
                  <span v-for="d in parseDays(s.daysOfWeek)" :key="d"
                    class="text-xs font-medium px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                    週{{ dayLabel[d] }}
                  </span>
                </div>
                <span class="text-sm font-semibold">{{ s.departureTime }}</span>
                <UBadge v-if="!s.isActive" label="停用" color="neutral" size="xs" />
              </div>
              <p class="text-xs text-muted">{{ s.originAddress }} → {{ s.destinationAddress }}</p>
              <p v-if="s.effectiveStartDate || s.effectiveEndDate" class="text-xs text-muted">
                有效期：{{ s.effectiveStartDate || '—' }} ～ {{ s.effectiveEndDate || '—' }}
              </p>
            </div>
          </div>
          <div class="flex justify-end pt-2">
            <UButton color="neutral" variant="outline" @click="showRecipientSchedulesModal = false">關閉</UButton>
          </div>
        </div>
      </template>
    </UModal>

    <!-- Detail Modal -->
    <UModal v-model:open="showDetailModal" title="訂單詳情" description=" " size="lg">
      <template #content>
        <div class="p-6 space-y-4">
          <div v-if="detailLoading" class="flex justify-center py-8">
            <UIcon name="i-lucide-loader-2" class="text-2xl animate-spin text-muted" />
          </div>
          <template v-else-if="detailTrip">
            <div class="flex items-center gap-2">
              <UBadge :color="statusColor[detailTrip.status] || 'neutral'" variant="subtle">
                {{ statusLabel[detailTrip.status] || detailTrip.status }}
              </UBadge>
            </div>
            <div class="border border-default rounded-xl divide-y divide-default text-sm">
              <div class="px-4 py-3 grid grid-cols-3 gap-2">
                <span class="text-muted">案主</span>
                <span class="col-span-2 font-medium">{{ detailTrip.careRecipient?.name || '—' }}</span>
              </div>
              <div class="px-4 py-3 grid grid-cols-3 gap-2">
                <span class="text-muted">輪椅需求</span>
                <span class="col-span-2">
                  <UBadge v-if="detailTrip.needsWheelchair" label="需要" color="info" size="xs" />
                  <span v-else class="text-muted">不需要</span>
                </span>
              </div>
              <div v-if="detailTrip.careRecipient?.specialNeeds && detailTrip.careRecipient.specialNeeds !== 'general'" class="px-4 py-3 grid grid-cols-3 gap-2">
                <span class="text-muted">特殊需求</span>
                <span class="col-span-2">{{ specialNeedsLabel[detailTrip.careRecipient.specialNeeds] || detailTrip.careRecipient.specialNeeds }}</span>
              </div>
              <div class="px-4 py-3 grid grid-cols-3 gap-2">
                <span class="text-muted">預定出發</span>
                <span class="col-span-2">{{ formatDateTime(detailTrip.scheduledAt) }}</span>
              </div>
              <div class="px-4 py-3 grid grid-cols-3 gap-2">
                <span class="text-muted">起點</span>
                <span class="col-span-2">{{ detailTrip.originAddress || '—' }}</span>
              </div>
              <div class="px-4 py-3 grid grid-cols-3 gap-2">
                <span class="text-muted">終點</span>
                <span class="col-span-2">{{ detailTrip.destinationAddress || '—' }}</span>
              </div>
              <div class="px-4 py-3 grid grid-cols-3 gap-2">
                <span class="text-muted">司機</span>
                <span class="col-span-2">
                  <template v-if="detailTrip.driver?.name || detailTrip.driverName">
                    {{ detailTrip.driver?.name || detailTrip.driverName }}
                    <a v-if="detailTrip.driver?.phone || detailTrip.driverPhone"
                      :href="`tel:${detailTrip.driver?.phone || detailTrip.driverPhone}`"
                      class="ml-2 text-primary underline">
                      {{ detailTrip.driver?.phone || detailTrip.driverPhone }}
                    </a>
                  </template>
                  <span v-else class="text-muted">未指派</span>
                </span>
              </div>
              <div class="px-4 py-3 grid grid-cols-3 gap-2">
                <span class="text-muted">車輛</span>
                <span class="col-span-2">
                  {{ detailTrip.vehicle ? `${detailTrip.vehicle.plate}（${detailTrip.vehicle.vehicleType}）` : '未指派' }}
                </span>
              </div>
              <div v-if="detailTrip.notes" class="px-4 py-3 grid grid-cols-3 gap-2">
                <span class="text-muted">備註</span>
                <span class="col-span-2">{{ detailTrip.notes }}</span>
              </div>
            </div>
            <p class="text-xs text-muted">建立於 {{ formatDateTime(detailTrip.createdAt) }}</p>
          </template>
          <div class="flex justify-end pt-2">
            <UButton color="neutral" variant="outline" @click="showDetailModal = false">關閉</UButton>
          </div>
        </div>
      </template>
    </UModal>

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
