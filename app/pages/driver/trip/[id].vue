<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header -->
    <div class="bg-white border-b border-gray-200 px-4 py-4 sticky top-0 z-10 flex items-center gap-3">
      <UButton icon="i-lucide-arrow-left" color="neutral" variant="ghost" size="lg" @click="$router.back()" />
      <h1 class="text-xl font-bold text-gray-900 truncate">行程詳情</h1>
    </div>

    <div v-if="pending" class="p-4 space-y-4 animate-pulse">
      <div class="bg-white rounded-2xl h-40" />
      <div class="bg-white rounded-2xl h-32" />
    </div>

    <template v-else-if="trip">
      <div class="px-4 py-4 space-y-4 pb-40">
        <!-- Client Info -->
        <div class="bg-white rounded-2xl p-5 shadow-sm">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-2xl font-bold text-gray-900">{{ trip.careRecipient.name }}</h2>
            <TripStatusBadge :status="trip.status" />
          </div>
          <p class="text-lg text-gray-500 mb-4">{{ formatDateTime(trip.scheduledAt) }}</p>

          <div v-if="trip.careRecipient.specialNeeds !== 'general'" class="mb-4 inline-flex items-center gap-2 text-base text-amber-700 bg-amber-50 px-3 py-1.5 rounded-full">
            <span>{{ specialNeedsLabel(trip.careRecipient.specialNeeds) }}</span>
          </div>

          <!-- Contact Buttons -->
          <div v-if="trip.careRecipient.contactPhone" class="flex gap-3">
            <a
              :href="`tel:${trip.careRecipient.contactPhone}`"
              class="flex-1 flex items-center justify-center gap-2 bg-green-50 text-green-700 font-semibold text-lg py-3.5 rounded-xl active:bg-green-100"
            >
              📞 撥打電話
            </a>
          </div>
        </div>

        <!-- Route -->
        <div class="bg-white rounded-2xl p-5 shadow-sm space-y-4">
          <h3 class="text-lg font-semibold text-gray-700">路線</h3>

          <div class="space-y-3">
            <div class="flex items-start gap-3">
              <span class="text-2xl mt-0.5">▲</span>
              <div class="flex-1">
                <p class="text-base text-gray-500 font-medium">出發地</p>
                <p class="text-lg text-gray-900 leading-snug">{{ trip.originAddress }}</p>
              </div>
              <a
                :href="mapsUrl(trip.originAddress)"
                target="_blank"
                class="shrink-0 bg-blue-600 text-white text-base font-semibold px-4 py-2 rounded-xl active:bg-blue-700"
              >
                導航
              </a>
            </div>

            <div class="flex items-start gap-3">
              <span class="text-2xl mt-0.5">●</span>
              <div class="flex-1">
                <p class="text-base text-gray-500 font-medium">目的地</p>
                <p class="text-lg text-gray-900 leading-snug">{{ trip.destinationAddress }}</p>
              </div>
              <a
                :href="mapsUrl(trip.destinationAddress)"
                target="_blank"
                class="shrink-0 bg-blue-600 text-white text-base font-semibold px-4 py-2 rounded-xl active:bg-blue-700"
              >
                導航
              </a>
            </div>
          </div>
        </div>

        <!-- Status Log History -->
        <div v-if="trip.statusLogs.length > 0" class="bg-white rounded-2xl p-5 shadow-sm">
          <h3 class="text-lg font-semibold text-gray-700 mb-3">打卡記錄</h3>
          <div class="space-y-2">
            <div
              v-for="log in trip.statusLogs"
              :key="log.id"
              class="flex items-center gap-3 text-base"
            >
              <span class="text-gray-400 shrink-0 w-12 text-sm">{{ formatTime(log.timestamp) }}</span>
              <span class="font-medium text-gray-700">{{ logLabel(log.status) }}</span>
            </div>
          </div>
        </div>

        <!-- Notes -->
        <div v-if="trip.notes" class="bg-amber-50 rounded-2xl p-4">
          <p class="text-base text-amber-800"><span class="font-semibold">備註：</span>{{ trip.notes }}</p>
        </div>
      </div>

      <!-- Action Bar -->
      <div class="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 space-y-3">
        <!-- Mileage input (shown only when completing) -->
        <div v-if="showMileageInput" class="flex items-center gap-3">
          <label class="text-base font-medium text-gray-700 shrink-0">實際里程</label>
          <input
            v-model="mileageInput"
            type="number"
            inputmode="decimal"
            placeholder="公里數"
            class="flex-1 border border-gray-300 rounded-xl px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span class="text-base text-gray-500 shrink-0">km</span>
        </div>

        <UButton
          v-if="nextAction"
          :label="nextAction.label"
          size="xl"
          :color="nextAction.color"
          block
          :loading="submitting"
          class="text-xl font-bold py-5"
          @click="handleAction"
        />

        <p v-else-if="trip.status === 'completed'" class="text-center text-lg font-medium text-green-600 py-3">
          ✅ 行程已完成
        </p>
        <p v-else-if="trip.status === 'cancelled'" class="text-center text-lg font-medium text-gray-500 py-3">
          已取消
        </p>
        <p v-else class="text-center text-base text-gray-400 py-3">
          等待派車確認
        </p>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: false })

const route = useRoute()
const { api } = useApi()

const { data, pending, error, refresh } = await useAsyncData(`trip-${route.params.id}`, async () => {
  console.log('[driver/trip] fetching trip id:', route.params.id)
  const result = await api<any>(`/api/driver/trips/${route.params.id}`)
  console.log('[driver/trip] received trip:', result?.id, 'status:', result?.status)
  return result
})

watch(error, (e) => { if (e) console.error('[driver/trip] fetch error:', e) })
const trip = computed(() => data.value)

const submitting = ref(false)
const mileageInput = ref('')
const showMileageInput = ref(false)

type ActionConfig = { logStatus: string; label: string; color: 'primary' | 'success' | 'warning' | 'error' }

const NEXT_ACTIONS: Record<string, ActionConfig | null> = {
  assigned:    { logStatus: 'departed',          label: '🚗 出發',       color: 'primary' },
  in_progress: null, // determined by last log
  completed:   null,
  cancelled:   null,
  pending:     null,
}

const LOG_SEQUENCE: ActionConfig[] = [
  { logStatus: 'departed',          label: '🚗 出發',       color: 'primary' },
  { logStatus: 'arrived_origin',    label: '📍 抵達案家',   color: 'warning' },
  { logStatus: 'recipient_boarded', label: '🙋 案主上車',   color: 'warning' },
  { logStatus: 'completed',         label: '✅ 完成行程',   color: 'success' },
]

const nextAction = computed((): ActionConfig | null => {
  if (!trip.value) return null
  const { status, statusLogs } = trip.value
  if (status === 'completed' || status === 'cancelled') return null
  if (status === 'pending') return null

  const lastLog = statusLogs.at(-1)
  if (!lastLog) return LOG_SEQUENCE[0]

  const idx = LOG_SEQUENCE.findIndex(a => a.logStatus === lastLog.status)
  return LOG_SEQUENCE[idx + 1] ?? null
})

watch(nextAction, (action) => {
  showMileageInput.value = action?.logStatus === 'completed'
})

async function handleAction() {
  if (!nextAction.value || submitting.value) return

  if (nextAction.value.logStatus === 'completed' && !mileageInput.value) {
    alert('請輸入實際里程')
    return
  }

  submitting.value = true
  try {
    const payload = {
      logStatus: nextAction.value.logStatus,
      ...(mileageInput.value ? { mileageActual: mileageInput.value } : {}),
    }
    console.log('[driver/trip] posting status update:', payload)
    await api(`/api/driver/trips/${route.params.id}/status`, { method: 'POST', body: payload })
    console.log('[driver/trip] status update ok, refreshing...')
    await refresh()
    mileageInput.value = ''
  } catch (e) {
    console.error('[driver/trip] status update failed:', e)
    throw e
  } finally {
    submitting.value = false
  }
}

function mapsUrl(address: string) {
  return `https://maps.google.com/?q=${encodeURIComponent(address)}`
}

function formatDateTime(val: string | Date) {
  return new Date(val).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
}

function formatTime(val: string | Date) {
  return new Date(val).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function specialNeedsLabel(v: string) {
  return v === 'wheelchair' ? '♿ 輪椅需求' : '🛏 臥床需求'
}

function logLabel(status: string) {
  const MAP: Record<string, string> = {
    departed:          '出發',
    arrived_origin:    '抵達案家',
    recipient_boarded: '案主上車',
    completed:         '完成行程',
  }
  return MAP[status] ?? status
}
</script>
