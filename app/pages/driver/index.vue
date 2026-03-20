<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header -->
    <div class="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-10">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">今日任務</h1>
          <p class="text-base text-gray-500 mt-0.5">{{ dateLabel }}</p>
        </div>
        <div class="flex items-center gap-2">
          <UButton
            icon="i-lucide-history"
            color="neutral"
            variant="ghost"
            size="lg"
            to="/driver/history"
            aria-label="歷史記錄"
          />
          <UDropdownMenu
            :items="[
              [{ label: driverName, disabled: true, icon: 'i-lucide-user-circle' }],
              [{ label: '登出', icon: 'i-lucide-log-out', color: 'error' as const, onSelect: handleSignOut }],
            ]"
          >
            <UButton
              icon="i-lucide-user-circle"
              color="neutral"
              variant="ghost"
              size="lg"
              aria-label="帳號"
            />
          </UDropdownMenu>
        </div>
      </div>
    </div>

    <!-- Content -->
    <div class="px-4 py-4 space-y-3 pb-24">
      <!-- Loading -->
      <template v-if="pending">
        <div v-for="i in 3" :key="i" class="bg-white rounded-2xl p-5 shadow-sm animate-pulse">
          <div class="h-5 bg-gray-200 rounded w-1/3 mb-3" />
          <div class="h-6 bg-gray-200 rounded w-2/3 mb-2" />
          <div class="h-5 bg-gray-200 rounded w-full" />
        </div>
      </template>

      <!-- Empty -->
      <div v-else-if="trips.length === 0" class="text-center py-20">
        <div class="text-6xl mb-4">🚗</div>
        <p class="text-xl font-medium text-gray-600">今日沒有任務</p>
        <p class="text-base text-gray-400 mt-1">好好休息！</p>
      </div>

      <!-- Trip Cards -->
      <NuxtLink
        v-for="trip in trips"
        :key="trip.id"
        :to="`/driver/trip/${trip.id}`"
        class="block bg-white rounded-2xl p-5 shadow-sm border border-gray-100 active:scale-[0.98] transition-transform"
      >
        <div class="flex items-center justify-between mb-3">
          <span class="text-lg font-bold text-blue-600">{{ formatTime(trip.scheduledAt) }}</span>
          <TripStatusBadge :status="trip.status" />
        </div>

        <p class="text-xl font-semibold text-gray-900 mb-3">{{ trip.careRecipient.name }}</p>

        <div class="space-y-2 text-base text-gray-600">
          <div class="flex items-start gap-2">
            <span class="text-green-500 mt-0.5 shrink-0">▲</span>
            <span class="leading-snug">{{ trip.originAddress }}</span>
          </div>
          <div class="flex items-start gap-2">
            <span class="text-red-500 mt-0.5 shrink-0">●</span>
            <span class="leading-snug">{{ trip.destinationAddress }}</span>
          </div>
        </div>

        <div v-if="trip.needsWheelchair" class="mt-3 inline-flex items-center gap-1.5 text-sm text-amber-700 bg-amber-50 px-3 py-1 rounded-full">
          ♿ 需要輪椅空間
        </div>
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: false })

const { api } = useApi()
const { user, signOut } = useAuth()
const driverName = computed(() => (user.value as any)?.name || (user.value as any)?.email || '司機')

async function handleSignOut() {
  await signOut()
  navigateTo('/driver/login')
}

const today = new Date()
const dateLabel = today.toLocaleDateString('zh-TW', { month: 'long', day: 'numeric', weekday: 'long' })
const dateParam = today.toISOString().split('T')[0]

const { data, pending, error } = await useAsyncData('driver-trips', async () => {
  console.log('[driver/index] fetching trips for date:', dateParam)
  const result = await api<any[]>(`/api/driver/trips?date=${dateParam}`)
  console.log('[driver/index] received trips:', result.length)
  return result
})
const trips = computed(() => data.value ?? [])

watch(error, (e) => { if (e) console.error('[driver/index] fetch error:', e) })

function formatTime(scheduledAt: string | Date) {
  return new Date(scheduledAt).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false })
}
</script>
