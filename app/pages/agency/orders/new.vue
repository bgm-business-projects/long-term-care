<script setup lang="ts">
const toast = useToast()
const { api } = useApi()
const router = useRouter()

const recipients = ref<any[]>([])
const servicePoints = ref<any[]>([])
const drivers = ref<any[]>([])
const vehicles = ref<any[]>([])
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
  needsWheelchair: false,
  driverUserId: null as string | null,
  vehicleId: null as string | null,
  notes: '',
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

const driverOptions = computed(() => [
  { label: '（不指派）', value: null },
  ...drivers.value.map((d: any) => ({
    label: d.name || d.user?.name || d.userId,
    value: d.userId || d.id,
  })),
])

const vehicleOptions = computed(() => [
  { label: '（不指派）', value: null },
  ...vehicles.value.map((v: any) => ({
    label: `${v.plate}　${v.vehicleType}`,
    value: v.id,
  })),
])

async function loadData() {
  try {
    const [r, d, v] = await Promise.all([
      api<any[]>('/api/dispatch/care-recipients'),
      api<any[]>('/api/dispatch/drivers').catch(() => [] as any[]),
      api<any[]>('/api/dispatch/vehicles').catch(() => [] as any[]),
    ])
    recipients.value = r
    drivers.value = d
    vehicles.value = v
  } catch (err: any) {
    toast.add({ title: '載入資料失敗', color: 'error' })
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
  if (!id) return
  const recipient = recipients.value.find((r: any) => r.id === id)
  if (recipient) {
    formData.originAddress = recipient.address || ''
    formData.originLat = recipient.lat != null ? Number(recipient.lat) : null
    formData.originLng = recipient.lng != null ? Number(recipient.lng) : null
    formData.needsWheelchair = ['wheelchair', 'bedridden'].includes(recipient.specialNeeds)
  }
})

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
  formData.needsWheelchair = false
  formData.driverUserId = null
  formData.vehicleId = null
  formData.notes = ''
  selectedServicePoint.value = null
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

  submitting.value = true
  try {
    await api('/api/dispatch/trips', {
      method: 'POST',
      body: { ...formData },
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

      <!-- 是否需輪椅 -->
      <div class="flex items-center gap-3">
        <UCheckbox v-model="formData.needsWheelchair" />
        <label class="text-sm font-medium">需要輪椅輔助</label>
      </div>

      <!-- 指派司機 -->
      <UFormField label="指派司機（選填）">
        <USelect
          v-model="formData.driverUserId"
          :items="driverOptions"
          class="w-full"
        />
      </UFormField>

      <!-- 指派車輛 -->
      <UFormField label="指派車輛（選填）">
        <USelect
          v-model="formData.vehicleId"
          :items="vehicleOptions"
          class="w-full"
        />
      </UFormField>

      <!-- 備註 -->
      <UFormField label="備註（選填）">
        <UTextarea v-model="formData.notes" placeholder="備注事項..." class="w-full" />
      </UFormField>

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
