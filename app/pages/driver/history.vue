<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header -->
    <div class="bg-white border-b border-gray-200 px-4 py-4 sticky top-0 z-10 flex items-center gap-3">
      <UButton icon="i-lucide-arrow-left" color="neutral" variant="ghost" size="lg" @click="$router.back()" />
      <h1 class="text-xl font-bold text-gray-900">歷史記錄</h1>
    </div>

    <div class="px-4 py-4 space-y-3 pb-8">
      <!-- Loading -->
      <template v-if="pending && trips.length === 0">
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
      <div v-if="trips.length > 0 && trips.length % 20 === 0" class="pt-2">
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

const page = ref(1)
const trips = ref<any[]>([])
const loadingMore = ref(false)

const { pending } = await useAsyncData('driver-history', async () => {
  console.log('[driver/history] fetching page 1')
  const data = await api<any[]>(`/api/driver/trips/history?page=1`)
  console.log('[driver/history] received', data.length, 'trips')
  trips.value = data
  return data
})

async function loadMore() {
  loadingMore.value = true
  try {
    page.value++
    console.log('[driver/history] loading more, page:', page.value)
    const data = await api<any[]>(`/api/driver/trips/history?page=${page.value}`)
    console.log('[driver/history] received', data.length, 'more trips')
    trips.value.push(...data)
  } catch (e) {
    console.error('[driver/history] loadMore error:', e)
  } finally {
    loadingMore.value = false
  }
}

function formatDate(val: string | Date) {
  return new Date(val).toLocaleDateString('zh-TW', { year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'short' })
}
</script>
