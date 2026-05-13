<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header -->
    <div class="bg-white border-b border-gray-200 px-4 py-4 sticky top-0 z-10">
      <div class="flex items-center gap-3 mb-3">
        <UButton icon="i-lucide-arrow-left" color="neutral" variant="ghost" size="lg" @click="$router.back()" />
        <h1 class="text-xl font-bold text-gray-900">歷史記錄</h1>
      </div>

      <!-- 快捷區間 -->
      <div class="grid grid-cols-4 gap-2 bg-gray-100 rounded-xl p-1 mb-2">
        <button
          v-for="opt in quickRanges"
          :key="opt.key"
          class="py-2 rounded-lg text-sm font-medium transition-colors"
          :class="activeQuick === opt.key
            ? 'bg-white text-blue-600 shadow-sm'
            : 'text-gray-600'"
          @click="applyQuickRange(opt.key)"
        >{{ opt.label }}</button>
      </div>

      <!-- 自訂日期 -->
      <div class="flex items-center gap-2">
        <input
          v-model="filterStart"
          type="date"
          :max="todayIso"
          class="flex-1 border border-gray-300 rounded-lg px-2 py-2 text-sm"
          @change="onCustomChange"
        />
        <span class="text-gray-400 text-sm">~</span>
        <input
          v-model="filterEnd"
          type="date"
          :max="todayIso"
          class="flex-1 border border-gray-300 rounded-lg px-2 py-2 text-sm"
          @change="onCustomChange"
        />
        <UButton
          v-if="filterStart || filterEnd"
          icon="i-lucide-x"
          size="sm"
          color="neutral"
          variant="ghost"
          @click="clearFilter"
        />
      </div>
    </div>

    <div class="px-4 py-4 space-y-3 pb-8">
      <!-- Loading -->
      <template v-if="loading && trips.length === 0">
        <div v-for="i in 5" :key="i" class="bg-white rounded-2xl p-5 shadow-sm animate-pulse">
          <div class="h-5 bg-gray-200 rounded w-1/3 mb-3" />
          <div class="h-6 bg-gray-200 rounded w-2/3 mb-2" />
          <div class="h-4 bg-gray-200 rounded w-full" />
        </div>
      </template>

      <!-- Empty -->
      <div v-else-if="trips.length === 0" class="text-center py-20">
        <div class="text-5xl mb-4">📋</div>
        <p class="text-xl font-medium text-gray-600">尚無歷史記錄</p>
        <p v-if="filterStart || filterEnd" class="text-sm text-gray-400 mt-2">
          區間：{{ filterStart || '—' }} ~ {{ filterEnd || '—' }}
        </p>
      </div>

      <!-- List -->
      <NuxtLink
        v-for="trip in trips"
        :key="trip.id"
        :to="`/driver/trip/${trip.id}`"
        class="block bg-white rounded-2xl p-5 shadow-sm border border-gray-100 active:scale-[0.98] transition-transform"
      >
        <div class="flex items-center justify-between mb-2">
          <span class="text-base text-gray-500">{{ formatDate(trip.scheduledAt) }}</span>
          <TripStatusBadge :status="trip.status" />
        </div>
        <p class="text-xl font-semibold text-gray-900 mb-2">{{ trip.careRecipient.name }}</p>
        <p class="text-base text-gray-500 truncate">{{ trip.originAddress }} → {{ trip.destinationAddress }}</p>
        <p v-if="trip.mileageActual" class="text-sm text-gray-400 mt-1">實際里程：{{ trip.mileageActual }} km</p>
      </NuxtLink>

      <!-- Load More -->
      <div v-if="hasMore && trips.length > 0" class="pt-2">
        <UButton
          label="載入更多"
          color="neutral"
          variant="outline"
          block
          size="lg"
          :loading="loadingMore"
          @click="loadMore"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: false })

const { api } = useApi()

type QuickKey = 'all' | 'this_week' | 'this_month' | 'last_month'
const quickRanges: { key: QuickKey; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'this_week', label: '本週' },
  { key: 'this_month', label: '本月' },
  { key: 'last_month', label: '上月' },
]

const todayIso = new Date().toISOString().split('T')[0]!
const filterStart = ref('')
const filterEnd = ref('')
const activeQuick = ref<QuickKey>('all')

const page = ref(1)
const PAGE_SIZE = 20
const trips = ref<any[]>([])
const loading = ref(false)
const loadingMore = ref(false)
const hasMore = ref(false)

function toIso(d: Date): string {
  return d.toISOString().split('T')[0]!
}

function applyQuickRange(key: QuickKey) {
  activeQuick.value = key
  const now = new Date()
  if (key === 'all') {
    filterStart.value = ''
    filterEnd.value = ''
  } else if (key === 'this_week') {
    const d = new Date(now)
    const day = d.getDay() // 0=Sun
    const diffToMon = (day === 0 ? -6 : 1 - day)
    const monday = new Date(d)
    monday.setDate(d.getDate() + diffToMon)
    filterStart.value = toIso(monday)
    filterEnd.value = toIso(now)
  } else if (key === 'this_month') {
    filterStart.value = toIso(new Date(now.getFullYear(), now.getMonth(), 1))
    filterEnd.value = toIso(now)
  } else if (key === 'last_month') {
    const first = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const last = new Date(now.getFullYear(), now.getMonth(), 0)
    filterStart.value = toIso(first)
    filterEnd.value = toIso(last)
  }
  void reload()
}

function clearFilter() {
  filterStart.value = ''
  filterEnd.value = ''
  activeQuick.value = 'all'
  void reload()
}

function onCustomChange() {
  // 使用者手改日期 → 切換到自訂模式
  activeQuick.value = 'all'
  if (filterStart.value && filterEnd.value && filterStart.value > filterEnd.value) {
    // 簡易交換
    const tmp = filterStart.value
    filterStart.value = filterEnd.value
    filterEnd.value = tmp
  }
  void reload()
}

function buildQuery(p: number): string {
  const params = new URLSearchParams({ page: String(p) })
  if (filterStart.value) params.set('startDate', filterStart.value)
  if (filterEnd.value) params.set('endDate', filterEnd.value)
  return params.toString()
}

async function reload() {
  loading.value = true
  page.value = 1
  trips.value = []
  hasMore.value = false
  try {
    const data = await api<any[]>(`/api/driver/trips/history?${buildQuery(1)}`)
    trips.value = data
    hasMore.value = data.length === PAGE_SIZE
  } catch (e) {
    console.error('[driver/history] reload error:', e)
  } finally {
    loading.value = false
  }
}

async function loadMore() {
  loadingMore.value = true
  try {
    page.value++
    const data = await api<any[]>(`/api/driver/trips/history?${buildQuery(page.value)}`)
    trips.value.push(...data)
    hasMore.value = data.length === PAGE_SIZE
  } catch (e) {
    console.error('[driver/history] loadMore error:', e)
  } finally {
    loadingMore.value = false
  }
}

function formatDate(val: string | Date) {
  return new Date(val).toLocaleDateString('zh-TW', { year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'short' })
}

// 初始載入
void reload()
</script>
