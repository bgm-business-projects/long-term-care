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

          <!-- 輪椅 / 特殊需求 / 輔具 標籤 -->
          <div class="mb-4 flex flex-wrap gap-2">
            <span v-if="trip.needsWheelchair" class="inline-flex items-center gap-1 text-base text-amber-700 bg-amber-50 px-3 py-1.5 rounded-full">
              ♿ 需輪椅空間
            </span>
            <span
              v-for="n in (trip.careRecipient.specialNeeds ?? [])"
              :key="`sn-${n.id}`"
              class="inline-flex items-center gap-1 text-base text-rose-700 bg-rose-50 px-3 py-1.5 rounded-full"
              :title="n.description ?? undefined"
            >
              ⚠ {{ n.name }}
            </span>
            <span
              v-for="d in (trip.careRecipient.devices ?? [])"
              :key="`dv-${d.id}`"
              class="inline-flex items-center gap-1 text-base text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-full"
              :title="d.description ?? undefined"
            >
              🧰 {{ d.name }}
            </span>
          </div>

          <!-- 特殊需求 / 輔具 詳細描述（有描述時展開） -->
          <div
            v-if="(trip.careRecipient.specialNeeds ?? []).some((n: any) => n.description) || (trip.careRecipient.devices ?? []).some((d: any) => d.description)"
            class="mb-4 space-y-1.5 text-sm text-gray-700 border-l-4 border-rose-200 pl-3 py-1"
          >
            <p v-for="n in (trip.careRecipient.specialNeeds ?? []).filter((n: any) => n.description)" :key="`snd-${n.id}`">
              <span class="font-medium">{{ n.name }}：</span>{{ n.description }}
            </p>
            <p v-for="d in (trip.careRecipient.devices ?? []).filter((d: any) => d.description)" :key="`dvd-${d.id}`">
              <span class="font-medium">{{ d.name }}：</span>{{ d.description }}
            </p>
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

        <!-- 異常回報（任何狀態都可回報，含已完成） -->
        <UButton
          v-if="trip.status !== 'cancelled'"
          icon="i-lucide-alert-octagon"
          color="error"
          variant="outline"
          size="lg"
          block
          @click="showIncidentModal = true"
        >
          回報異常
        </UButton>
      </div>

      <!-- 異常回報 Modal -->
      <UModal v-model:open="showIncidentModal" title="回報異常" description=" ">
        <template #content>
          <div class="p-5 space-y-4 max-h-[85vh] overflow-y-auto">
            <p class="text-sm text-muted">請選擇異常類型：</p>
            <div class="grid grid-cols-2 gap-2">
              <UButton
                v-for="t in incidentTypes"
                :key="t.value"
                :variant="incidentForm.type === t.value ? 'solid' : 'outline'"
                :color="incidentForm.type === t.value ? 'error' : 'neutral'"
                size="lg"
                block
                @click="incidentForm.type = t.value"
              >
                {{ t.label }}
              </UButton>
            </div>

            <!-- 快速範本：依選定類型顯示 5 個常用語句 -->
            <div v-if="currentTemplates.length" class="space-y-1.5">
              <p class="text-xs text-muted flex items-center gap-1">
                <UIcon name="i-lucide-zap" class="text-amber-500" />
                快速範本（點選自動填入，可疊加）
              </p>
              <div class="flex flex-wrap gap-1.5">
                <button
                  v-for="(tpl, i) in currentTemplates"
                  :key="i"
                  type="button"
                  class="text-left text-sm border border-gray-200 bg-gray-50 hover:bg-amber-50 hover:border-amber-300 rounded-lg px-3 py-1.5 transition-colors"
                  @click="applyTemplate(tpl)"
                >
                  {{ tpl }}
                </button>
              </div>
            </div>

            <UFormField :label="incidentForm.type === 'other' ? '請描述（必填）' : '補充說明（選填）'">
              <UTextarea v-model="incidentForm.description" :rows="4" placeholder="點選上方範本快速填入，或自行描述" class="w-full" />
            </UFormField>

            <div class="flex justify-between items-center gap-2 pt-2">
              <UButton
                v-if="incidentForm.description"
                color="neutral"
                variant="ghost"
                size="sm"
                icon="i-lucide-eraser"
                @click="incidentForm.description = ''"
              >清空</UButton>
              <span v-else />
              <div class="flex gap-2">
                <UButton color="neutral" variant="ghost" @click="showIncidentModal = false">取消</UButton>
                <UButton color="error" :loading="reporting" :disabled="!incidentForm.type || (incidentForm.type === 'other' && !incidentForm.description.trim())" @click="submitIncident">送出回報</UButton>
              </div>
            </div>
          </div>
        </template>
      </UModal>

      <!-- Action Bar -->
      <div class="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 space-y-3">
        <!-- Mileage input (shown only when completing) -->
        <div v-if="showMileageInput" class="bg-amber-50 border-2 border-amber-300 rounded-xl p-3 space-y-2">
          <label class="flex items-center gap-1.5 text-base font-bold text-amber-900">
            <UIcon name="i-lucide-gauge" class="text-amber-700" />
            完成行程前請輸入實際里程
          </label>
          <div class="flex items-center gap-2">
            <input
              ref="mileageInputRef"
              v-model="mileageInput"
              type="number"
              inputmode="decimal"
              placeholder="例：12.5"
              class="flex-1 border-2 border-amber-400 bg-white rounded-xl px-4 py-3 text-2xl font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <span class="text-lg font-medium text-amber-900 shrink-0">km</span>
          </div>
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
const toast = useToast()

// 異常回報
const incidentTypes = [
  { label: '🤒 個案生病', value: 'sick' },
  { label: '👻 個案失聯', value: 'missing' },
  { label: '🚫 個案未到', value: 'no_show' },
  { label: '🚗 行車事故', value: 'accident' },
  { label: '✏️ 其他', value: 'other' },
] as const

type IncidentType = 'sick' | 'missing' | 'no_show' | 'accident' | 'other'

// 各類型快速範本（5 案例）
const INCIDENT_TEMPLATES: Record<IncidentType, string[]> = {
  sick: [
    '個案臨時不適，已通知家屬',
    '個案高燒無法外出，當日取消',
    '個案血壓不穩，建議改期',
    '個案表示頭暈不適，已協助返家',
    '個案家屬告知個案急性腸胃炎',
  ],
  missing: [
    '抵達時個案不在家，電話無人接聽',
    '家屬說個案外出未歸',
    '門口按鈴無人應答，已等候 15 分鐘',
    '聯絡個案與家屬皆無回應',
    '個案在約定地點未見蹤影',
  ],
  no_show: [
    '依約時段個案未現身',
    '個案臨時取消未事先通知',
    '個案家屬已通知不需此趟',
    '抵達後個案改口不前往',
    '個案不在約定地點，無法聯絡',
  ],
  accident: [
    '前車追撞，輕微擦撞，已報警處理',
    '輪胎故障，已聯絡道路救援',
    '路口擦撞，雙方無人員受傷',
    '車輛故障熄火，已通知派車支援',
    '行進中追撞，個案無受傷',
  ],
  other: [
    '交通管制改道，預計延誤 15 分鐘',
    '個案要求臨時改地點',
    '前一趟超時，延後本趟出發',
    '導航繞路，比預估晚 10 分鐘抵達',
    '機構臨時要求順道幫忙',
  ],
}

const showIncidentModal = ref(false)
const reporting = ref(false)
const incidentForm = reactive({
  type: '' as '' | IncidentType,
  description: '',
})

const currentTemplates = computed<string[]>(() => {
  if (!incidentForm.type) return []
  return INCIDENT_TEMPLATES[incidentForm.type]
})

function applyTemplate(text: string) {
  // 已有內容 → 加換行附加；否則直接套用
  if (incidentForm.description.trim()) {
    incidentForm.description = `${incidentForm.description.trim()}\n${text}`
  } else {
    incidentForm.description = text
  }
}

async function submitIncident() {
  if (!incidentForm.type) return
  reporting.value = true
  try {
    await api(`/api/driver/trips/${route.params.id}/incidents`, {
      method: 'POST',
      body: {
        type: incidentForm.type,
        description: incidentForm.description.trim() || null,
      },
    })
    toast.add({ title: '已回報異常', color: 'success' })
    showIncidentModal.value = false
    incidentForm.type = ''
    incidentForm.description = ''
  } catch (err: any) {
    toast.add({ title: err?.data?.statusMessage || '回報失敗', color: 'error' })
  } finally {
    reporting.value = false
  }
}

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
const mileageInputRef = ref<HTMLInputElement | null>(null)

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
  if (!lastLog) return LOG_SEQUENCE[0] ?? null

  const idx = LOG_SEQUENCE.findIndex(a => a.logStatus === lastLog.status)
  return LOG_SEQUENCE[idx + 1] ?? null
})

const showMileageInput = computed(() => nextAction.value?.logStatus === 'completed')

watch(showMileageInput, async (show) => {
  if (show) {
    await nextTick()
    mileageInputRef.value?.focus()
  }
}, { immediate: true })

async function handleAction() {
  if (!nextAction.value || submitting.value) return

  if (nextAction.value.logStatus === 'completed' && !mileageInput.value) {
    toast.add({ title: '請輸入實際里程後再完成行程', color: 'warning' })
    mileageInputRef.value?.focus()
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
