<script setup lang="ts">
const toast = useToast()
const { api } = useApi()
const router = useRouter()
const { fetchDistanceMeters } = useDistance()

interface Device { id: string; name: string }
interface Fleet { id: string; name: string }
interface Driver { id: string; userId: string; fleetId: string | null; user: { name: string } }

const recipients = ref<any[]>([])
const servicePoints = ref<any[]>([])
const drivers = ref<Driver[]>([])
const fleets = ref<Fleet[]>([])
const devices = ref<Device[]>([])
const submitting = ref(false)
const showSuccessModal = ref(false)

const formData = reactive({
  careRecipientId: null as string | null,
  scheduledAt: '',
  originAddress: '',
  originLat: null as number | null,
  originLng: null as number | null,
  destinationAddress: '',
  destinationLat: null as number | null,
  destinationLng: null as number | null,
  deviceIds: [] as string[],
  fleetId: null as string | null,
  driverUserId: null as string | null,
  notes: '',
  roundTrip: false,
  returnScheduledAt: '',
  returnEstimatedDuration: 0,
})

const selectedServicePoint = ref<string | null>(null)

const recipientOptions = computed(() =>
  recipients.value.map((r: any) => ({
    label: `${r.name}　${r.address || ''}`,
    value: r.id,
  }))
)

function spScopeTag(sp: any) {
  if (sp.careRecipientId) return '個案'
  if (sp.organizationId) return '機構'
  return '共用'
}

const servicePointOptions = computed(() => [
  { label: '手動輸入地址', value: null },
  ...servicePoints.value.map((sp: any) => ({
    label: `[${spScopeTag(sp)}] ${sp.name}`,
    value: sp.id,
  })),
])

const fleetOptions = computed(() => [
  { label: '全部車行', value: null },
  ...fleets.value.map(f => ({ label: f.name, value: f.id })),
  { label: '獨立司機 (無車行)', value: '__none__' },
])

const filteredDrivers = computed<Driver[]>(() => {
  if (formData.fleetId === null) return drivers.value
  if (formData.fleetId === '__none__') return drivers.value.filter(d => !d.fleetId)
  return drivers.value.filter(d => d.fleetId === formData.fleetId)
})

const driverOptions = computed(() => [
  { label: '（不指派）', value: null },
  ...filteredDrivers.value.map(d => ({
    label: d.user?.name || d.userId,
    value: d.userId,
  })),
])

const deviceOptions = computed(() => devices.value.map(d => ({ label: d.name, value: d.id })))

async function loadData() {
  try {
    const [r, d, f, dev] = await Promise.all([
      api<any[]>('/api/dispatch/care-recipients'),
      api<Driver[]>('/api/dispatch/drivers').catch(() => [] as Driver[]),
      api<Fleet[]>('/api/fleets').catch(() => [] as Fleet[]),
      api<Device[]>('/api/dispatch/devices').catch(() => [] as Device[]),
    ])
    recipients.value = r
    drivers.value = d
    fleets.value = f
    devices.value = dev
  } catch (err: any) {
    toast.add({ title: '載入資料失敗', color: 'error' })
  }
}

watch(() => formData.fleetId, () => {
  if (!formData.driverUserId) return
  const driverInList = filteredDrivers.value.some(d => d.userId === formData.driverUserId)
  if (!driverInList) formData.driverUserId = null
})

async function loadRecipientDevices(id: string) {
  try {
    const detail = await api<{ devices?: Device[] }>(`/api/dispatch/care-recipients/${id}`)
    formData.deviceIds = (detail.devices || []).map(d => d.id)
  } catch {
    formData.deviceIds = []
  }
}

async function loadServicePoints(careRecipientId: string | null) {
  if (!careRecipientId) {
    servicePoints.value = []
    return
  }
  try {
    servicePoints.value = await api<any[]>(
      `/api/dispatch/service-points?scope=order&careRecipientId=${careRecipientId}`
    )
  } catch {
    servicePoints.value = []
  }
}

onMounted(loadData)

watch(() => formData.careRecipientId, (id) => {
  selectedServicePoint.value = null
  loadServicePoints(id)
  if (!id) {
    formData.deviceIds = []
    return
  }
  const recipient = recipients.value.find((r: any) => r.id === id)
  if (recipient) {
    formData.originAddress = recipient.address || ''
    formData.originLat = recipient.lat != null ? Number(recipient.lat) : null
    formData.originLng = recipient.lng != null ? Number(recipient.lng) : null
  }
  loadRecipientDevices(id)
})

// 距離計算
const distanceMeters = ref<number | null>(null)
const distanceText = ref<string>('')
const distanceLoading = ref(false)
const distanceKm = computed(() => distanceMeters.value == null ? null : distanceMeters.value / 1000)
const isLongDistance = computed(() => distanceKm.value != null && distanceKm.value > 10)

async function recalcDistance() {
  const origin = (formData.originLat != null && formData.originLng != null)
    ? { lat: formData.originLat, lng: formData.originLng }
    : (formData.originAddress.trim() || null)
  const destination = (formData.destinationLat != null && formData.destinationLng != null)
    ? { lat: formData.destinationLat, lng: formData.destinationLng }
    : (formData.destinationAddress.trim() || null)

  if (!origin || !destination) {
    distanceMeters.value = null
    distanceText.value = ''
    return
  }

  distanceLoading.value = true
  const result = await fetchDistanceMeters(origin, destination)
  distanceLoading.value = false
  if (result) {
    distanceMeters.value = result.meters
    distanceText.value = result.text
  } else {
    distanceMeters.value = null
    distanceText.value = ''
  }
}

let distanceDebounceTimer: ReturnType<typeof setTimeout> | null = null
watch(
  () => [formData.originLat, formData.originLng, formData.destinationLat, formData.destinationLng,
    formData.originAddress, formData.destinationAddress],
  () => {
    if (distanceDebounceTimer) clearTimeout(distanceDebounceTimer)
    distanceDebounceTimer = setTimeout(recalcDistance, 600)
  },
)

function onServicePointSelect(val: string | null) {
  if (!val) return
  const sp = servicePoints.value.find((s: any) => s.id === val)
  if (sp) {
    formData.destinationAddress = sp.address || sp.name
    formData.destinationLat = sp.lat != null ? Number(sp.lat) : null
    formData.destinationLng = sp.lng != null ? Number(sp.lng) : null
  }
}

function resetForm() {
  formData.careRecipientId = null
  formData.scheduledAt = ''
  formData.originAddress = ''
  formData.originLat = null
  formData.originLng = null
  formData.destinationAddress = ''
  formData.destinationLat = null
  formData.destinationLng = null
  formData.deviceIds = []
  formData.fleetId = null
  formData.driverUserId = null
  formData.notes = ''
  selectedServicePoint.value = null
  distanceMeters.value = null
  distanceText.value = ''
}

async function submitOrder() {
  if (!formData.careRecipientId) {
    toast.add({ title: '請選擇個案', color: 'error' })
    return
  }
  if (!formData.scheduledAt) {
    toast.add({ title: '請填寫出發時間', color: 'error' })
    return
  }
  if (!formData.originAddress) {
    toast.add({ title: '請填寫起點地址', color: 'error' })
    return
  }
  if (!formData.destinationAddress) {
    toast.add({ title: '請填寫終點地址', color: 'error' })
    return
  }
  if (formData.roundTrip && !formData.returnScheduledAt) {
    toast.add({ title: '勾選來回時請填寫回程出發時間', color: 'error' })
    return
  }
  if (formData.roundTrip && formData.returnScheduledAt && formData.returnScheduledAt <= formData.scheduledAt) {
    toast.add({ title: '回程時間必須晚於去程時間', color: 'error' })
    return
  }

  const wheelchairDevice = devices.value.find(d => d.name.includes('輪椅'))
  const needsWheelchair = wheelchairDevice ? formData.deviceIds.includes(wheelchairDevice.id) : false

  submitting.value = true
  try {
    const { fleetId: _fleetId, ...payload } = formData
    void _fleetId
    await api('/api/dispatch/trips', {
      method: 'POST',
      body: { ...payload, needsWheelchair },
    })
    resetForm()
    showSuccessModal.value = true
  } catch (err: any) {
    toast.add({ title: err?.data?.statusMessage || '建立訂單失敗', color: 'error' })
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="space-y-6 max-w-2xl">
    <!-- Header -->
    <div class="flex items-center gap-3">
      <NuxtLink to="/agency/orders">
        <UButton color="neutral" variant="ghost" size="sm" icon="i-lucide-arrow-left" />
      </NuxtLink>
      <h2 class="text-lg font-semibold text-highlighted">新增訂單</h2>
    </div>

    <div class="space-y-5">
      <!-- 個案 -->
      <UFormField label="個案 *">
        <USelect
          v-model="formData.careRecipientId"
          :items="recipientOptions"
          placeholder="請選擇個案..."
          class="w-full"
        />
      </UFormField>

      <!-- 出發時間 -->
      <div>
        <label class="text-sm font-medium block mb-1">出發時間 *</label>
        <input
          v-model="formData.scheduledAt"
          type="datetime-local"
          class="w-full px-3 py-2 border border-default rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      <!-- 起點地址 -->
      <div>
        <label class="text-sm font-medium block mb-1">起點地址 *</label>
        <UInput
          v-model="formData.originAddress"
          placeholder="選擇個案後自動帶入，可手動修改"
          class="w-full"
        />
        <p v-if="formData.originLat && formData.originLng" class="text-xs text-muted mt-1">
          座標：{{ Number(formData.originLat).toFixed(6) }}, {{ Number(formData.originLng).toFixed(6) }}
        </p>
      </div>

      <!-- 終點地址 -->
      <div class="space-y-2">
        <label class="text-sm font-medium block">終點地址 *</label>
        <USelect
          v-model="selectedServicePoint"
          :items="servicePointOptions"
          :disabled="!formData.careRecipientId"
          :placeholder="formData.careRecipientId ? '選擇常用服務據點...' : '請先選擇個案'"
          class="w-full"
          @update:model-value="onServicePointSelect"
        />
        <UInput
          v-model="formData.destinationAddress"
          placeholder="或手動輸入地址"
          class="w-full"
        />
      </div>

      <!-- 距離 -->
      <div v-if="distanceLoading" class="text-xs text-muted">計算距離中…</div>
      <div v-else-if="distanceKm != null" class="flex items-center gap-2 text-sm">
        <UIcon name="i-lucide-route" class="w-4 h-4" />
        <span :class="isLongDistance ? 'text-red-500 font-semibold' : ''">
          預估駕駛距離：{{ distanceText }}
          <span v-if="isLongDistance">（超過 10 公里，請留意）</span>
        </span>
      </div>

      <!-- 攜帶輔具 -->
      <UFormField label="會攜帶輔具">
        <USelectMenu
          v-model="formData.deviceIds"
          :items="deviceOptions"
          value-key="value"
          multiple
          searchable
          placeholder="可多選；選擇個案後會自動帶入該個案常用輔具"
          class="w-full"
        />
      </UFormField>

      <!-- 指派車行 -->
      <UFormField label="指派車行（選填）" hint="先選車行可篩選下方司機">
        <USelect
          v-model="formData.fleetId"
          :items="fleetOptions"
          class="w-full"
        />
      </UFormField>

      <!-- 指派司機 -->
      <UFormField label="指派司機（選填）" hint="指派司機後系統自動帶入該司機的車輛">
        <USelect
          v-model="formData.driverUserId"
          :items="driverOptions"
          class="w-full"
        />
      </UFormField>

      <!-- 備註 -->
      <UFormField label="備註（選填）">
        <UTextarea v-model="formData.notes" placeholder="備注事項..." class="w-full" />
      </UFormField>

      <!-- 來回 -->
      <div class="border border-default rounded-md p-3 space-y-2">
        <label class="flex items-center gap-2 cursor-pointer">
          <UCheckbox v-model="formData.roundTrip" />
          <span class="text-sm font-medium">需要回程（原車去原車回）</span>
        </label>
        <div v-if="formData.roundTrip" class="grid grid-cols-2 gap-3 pl-6 pt-1">
          <div>
            <label class="text-xs text-muted block mb-1">回程出發時間 *</label>
            <input
              v-model="formData.returnScheduledAt"
              type="datetime-local"
              class="w-full px-3 py-2 border border-default rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label class="text-xs text-muted block mb-1">回程預估時長 (分鐘)</label>
            <input
              v-model.number="formData.returnEstimatedDuration"
              type="number"
              min="0"
              placeholder="留 0 = 與去程相同"
              class="w-full px-3 py-2 border border-default rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>
        <p v-if="formData.roundTrip" class="text-xs text-muted pl-6">
          回程起點為去程終點、回程終點為去程起點；指派的司機/車輛同一台。
        </p>
      </div>

      <!-- Actions -->
      <div class="flex items-center gap-3 pt-2">
        <UButton color="primary" size="lg" :loading="submitting" icon="i-lucide-send" @click="submitOrder">
          建立訂單
        </UButton>
        <UButton color="neutral" variant="outline" size="lg" @click="resetForm">
          清空表單
        </UButton>
      </div>
    </div>
  </div>

  <UModal v-model:open="showSuccessModal" title="訂單建立成功" description=" " :dismissible="false">
    <template #content>
      <div class="p-6 space-y-4">
        <div class="flex items-center gap-3">
          <UIcon name="i-lucide-check-circle-2" class="text-3xl text-success shrink-0" />
          <p class="text-sm text-muted">訂單已成功建立，請選擇下一步。</p>
        </div>
        <div class="flex gap-3 justify-end pt-2">
          <UButton
            color="neutral"
            variant="outline"
            icon="i-lucide-plus"
            @click="showSuccessModal = false"
          >
            繼續新增
          </UButton>
          <NuxtLink to="/agency/orders">
            <UButton color="primary" icon="i-lucide-list">
              回到訂單列表
            </UButton>
          </NuxtLink>
        </div>
      </div>
    </template>
  </UModal>
</template>
