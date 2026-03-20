<script setup lang="ts">
const toast = useToast()
const { api } = useApi()
const { user } = useAuth()

const userOrgId = computed(() => (user.value as any)?.organizationId as string | undefined)
const orgName = ref('')

watch(userOrgId, async (id) => {
  if (!id) { orgName.value = ''; return }
  try {
    const org = await api<any>(`/api/dispatch/organizations/${id}`)
    orgName.value = org.name || ''
  } catch {
    orgName.value = ''
  }
}, { immediate: true })

const cases = ref<any[]>([])
const loading = ref(false)
const search = ref('')

const showModal = ref(false)
const showDeleteModal = ref(false)
const editingItem = ref<any>(null)
const deletingItem = ref<any>(null)
const saving = ref(false)

const addressInput = ref<HTMLInputElement | null>(null)
let autocomplete: any = null

const formData = reactive({
  name: '',
  address: '',
  lat: null as number | null,
  lng: null as number | null,
  contactPerson: '',
  contactPhone: '',
  specialNeeds: 'general',
  notes: '',
})

const specialNeedsOptions = [
  { label: '一般', value: 'general' },
  { label: '輪椅', value: 'wheelchair' },
  { label: '臥床', value: 'bedridden' },
]

const specialNeedsLabel: Record<string, string> = {
  general: '一般',
  wheelchair: '輪椅',
  bedridden: '臥床',
}

const specialNeedsColor: Record<string, string> = {
  general: 'neutral',
  wheelchair: 'warning',
  bedridden: 'error',
}

const filteredCases = computed(() => {
  if (!search.value) return cases.value
  const q = search.value.toLowerCase()
  return cases.value.filter((c: any) =>
    c.name?.toLowerCase().includes(q) ||
    c.address?.toLowerCase().includes(q)
  )
})

async function loadCases() {
  loading.value = true
  try {
    cases.value = await api<any[]>('/api/dispatch/care-recipients')
  } catch (err: any) {
    toast.add({ title: err?.data?.statusMessage || '載入個案失敗', color: 'error' })
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadCases()
})

// ── 個案據點管理 ─────────────────────────────────────────
const showLocationsModal = ref(false)
const locationsCase = ref<any>(null)
const caseLocations = ref<any[]>([])
const locationsSaving = ref(false)
const showLocationForm = ref(false)
const showDeleteLocationModal = ref(false)
const deletingLocation = ref<any>(null)

const categoryOptions = [
  { label: '醫院', value: 'hospital' },
  { label: '復健', value: 'rehab' },
  { label: '其他', value: 'other' },
]
const categoryLabelMap: Record<string, string> = { hospital: '醫院', rehab: '復健', other: '其他' }

const locationForm = reactive({ name: '', address: '', category: 'other', lat: '' as string | number, lng: '' as string | number })
const editingLocation = ref<any>(null)

async function openLocations(c: any) {
  locationsCase.value = c
  showLocationsModal.value = true
  await loadCaseLocations(c.id)
}

async function loadCaseLocations(careRecipientId: string) {
  try {
    caseLocations.value = await api<any[]>(`/api/dispatch/service-points?scope=careRecipient&careRecipientId=${careRecipientId}`)
  } catch {
    caseLocations.value = []
  }
}

function openAddLocation() {
  editingLocation.value = null
  locationForm.name = ''; locationForm.address = ''; locationForm.category = 'other'; locationForm.lat = ''; locationForm.lng = ''
  showLocationForm.value = true
}

function openEditLocation(l: any) {
  editingLocation.value = l
  locationForm.name = l.name; locationForm.address = l.address; locationForm.category = l.category || 'other'
  locationForm.lat = l.lat ?? ''; locationForm.lng = l.lng ?? ''
  showLocationForm.value = true
}

async function handleSaveLocation() {
  if (!locationForm.name || !locationForm.address) {
    toast.add({ title: '名稱與地址為必填', color: 'error' }); return
  }
  locationsSaving.value = true
  try {
    const body = {
      name: locationForm.name, address: locationForm.address, category: locationForm.category,
      lat: locationForm.lat !== '' ? Number(locationForm.lat) : null,
      lng: locationForm.lng !== '' ? Number(locationForm.lng) : null,
      careRecipientId: locationsCase.value.id,
    }
    if (editingLocation.value) {
      await api(`/api/dispatch/service-points/${editingLocation.value.id}`, { method: 'PUT', body })
    } else {
      await api('/api/dispatch/service-points', { method: 'POST', body })
    }
    toast.add({ title: editingLocation.value ? '據點已更新' : '據點已新增', color: 'success' })
    showLocationForm.value = false
    await loadCaseLocations(locationsCase.value.id)
  } catch (err: any) {
    toast.add({ title: err?.data?.statusMessage || '儲存失敗', color: 'error' })
  } finally {
    locationsSaving.value = false
  }
}

function confirmDeleteLocation(l: any) {
  deletingLocation.value = l; showDeleteLocationModal.value = true
}

async function handleDeleteLocation() {
  if (!deletingLocation.value) return
  try {
    await api(`/api/dispatch/service-points/${deletingLocation.value.id}`, { method: 'DELETE' })
    toast.add({ title: '據點已刪除', color: 'success' })
    showDeleteLocationModal.value = false
    await loadCaseLocations(locationsCase.value.id)
  } catch (err: any) {
    toast.add({ title: err?.data?.statusMessage || '操作失敗', color: 'error' })
  }
}

// ── 週期性排程管理 ─────────────────────────────────────────
const showSchedulesModal = ref(false)
const schedulesCase = ref<any>(null)
const schedules = ref<any[]>([])
const showScheduleForm = ref(false)
const editingSchedule = ref<any>(null)
const scheduleSaving = ref(false)
const showDeleteScheduleModal = ref(false)
const deletingSchedule = ref<any>(null)

const dayOptions = [
  { label: '日', value: 0 },
  { label: '一', value: 1 },
  { label: '二', value: 2 },
  { label: '三', value: 3 },
  { label: '四', value: 4 },
  { label: '五', value: 5 },
  { label: '六', value: 6 },
]
const dayLabel = ['日', '一', '二', '三', '四', '五', '六']

const scheduleForm = reactive({
  daysOfWeek: [] as number[],
  departureTime: '',
  originAddress: '',
  destinationAddress: '',
  needsWheelchair: false,
  effectiveStartDate: '',
  effectiveEndDate: '',
  notes: '',
  isActive: true,
})

async function openSchedules(c: any) {
  schedulesCase.value = c
  showSchedulesModal.value = true
  showScheduleForm.value = false
  await loadSchedules(c.id)
}

async function loadSchedules(careRecipientId: string) {
  try {
    schedules.value = await api<any[]>(`/api/dispatch/recurring-schedules?careRecipientId=${careRecipientId}`)
  } catch {
    schedules.value = []
  }
}

function openAddSchedule() {
  editingSchedule.value = null
  scheduleForm.daysOfWeek = []
  scheduleForm.departureTime = ''
  scheduleForm.originAddress = schedulesCase.value?.address || ''
  scheduleForm.destinationAddress = ''
  scheduleForm.needsWheelchair = false
  scheduleForm.effectiveStartDate = ''
  scheduleForm.effectiveEndDate = ''
  scheduleForm.notes = ''
  scheduleForm.isActive = true
  showScheduleForm.value = true
}

function openEditSchedule(s: any) {
  editingSchedule.value = s
  const days = typeof s.daysOfWeek === 'string' ? JSON.parse(s.daysOfWeek) : (s.daysOfWeek || [])
  scheduleForm.daysOfWeek = days
  scheduleForm.departureTime = s.departureTime || ''
  scheduleForm.originAddress = s.originAddress || ''
  scheduleForm.destinationAddress = s.destinationAddress || ''
  scheduleForm.needsWheelchair = s.needsWheelchair || false
  scheduleForm.effectiveStartDate = s.effectiveStartDate || ''
  scheduleForm.effectiveEndDate = s.effectiveEndDate || ''
  scheduleForm.notes = s.notes || ''
  scheduleForm.isActive = s.isActive !== false
  showScheduleForm.value = true
}

async function handleSaveSchedule() {
  if (scheduleForm.daysOfWeek.length === 0) {
    toast.add({ title: '請選擇至少一天', color: 'error' }); return
  }
  if (!scheduleForm.departureTime) {
    toast.add({ title: '請填寫出發時間', color: 'error' }); return
  }
  if (!scheduleForm.originAddress || !scheduleForm.destinationAddress) {
    toast.add({ title: '起點與終點為必填', color: 'error' }); return
  }
  scheduleSaving.value = true
  try {
    const body = { ...scheduleForm, careRecipientId: schedulesCase.value.id }
    if (editingSchedule.value) {
      await api(`/api/dispatch/recurring-schedules/${editingSchedule.value.id}`, { method: 'PUT', body })
    } else {
      await api('/api/dispatch/recurring-schedules', { method: 'POST', body })
    }
    toast.add({ title: editingSchedule.value ? '排程已更新' : '排程已新增', color: 'success' })
    showScheduleForm.value = false
    await loadSchedules(schedulesCase.value.id)
  } catch (err: any) {
    toast.add({ title: err?.data?.statusMessage || '儲存失敗', color: 'error' })
  } finally {
    scheduleSaving.value = false
  }
}

function confirmDeleteSchedule(s: any) {
  deletingSchedule.value = s
  showDeleteScheduleModal.value = true
}

async function handleDeleteSchedule() {
  if (!deletingSchedule.value) return
  try {
    await api(`/api/dispatch/recurring-schedules/${deletingSchedule.value.id}`, { method: 'DELETE' })
    toast.add({ title: '排程已刪除', color: 'success' })
    showDeleteScheduleModal.value = false
    await loadSchedules(schedulesCase.value.id)
  } catch (err: any) {
    toast.add({ title: err?.data?.statusMessage || '操作失敗', color: 'error' })
  }
}

function parseDays(daysOfWeek: any): number[] {
  if (Array.isArray(daysOfWeek)) return daysOfWeek
  try { return JSON.parse(daysOfWeek) } catch { return [] }
}

function resetForm() {
  formData.name = ''
  formData.address = ''
  formData.lat = null
  formData.lng = null
  formData.contactPerson = ''
  formData.contactPhone = ''
  formData.specialNeeds = 'general'
  formData.notes = ''
}

function initAutocomplete() {
  if (!addressInput.value) return
  autocomplete = new (window as any).google.maps.places.Autocomplete(addressInput.value, {
    componentRestrictions: { country: 'TW' },
    fields: ['formatted_address', 'geometry'],
  })
  autocomplete.addListener('place_changed', () => {
    const place = autocomplete.getPlace()
    if (place.formatted_address) formData.address = place.formatted_address
    if (place.geometry?.location) {
      formData.lat = place.geometry.location.lat()
      formData.lng = place.geometry.location.lng()
    }
  })
}

function openAdd() {
  editingItem.value = null
  resetForm()
  showModal.value = true
  nextTick(() => {
    if (typeof window !== 'undefined' && (window as any).google?.maps?.places) {
      initAutocomplete()
    }
  })
}

function openEdit(c: any) {
  editingItem.value = c
  formData.name = c.name
  formData.address = c.address || ''
  formData.lat = c.lat != null ? Number(c.lat) : null
  formData.lng = c.lng != null ? Number(c.lng) : null
  formData.contactPerson = c.contactPerson || ''
  formData.contactPhone = c.contactPhone || ''
  formData.specialNeeds = c.specialNeeds || 'general'
  formData.notes = c.notes || ''
  showModal.value = true
  nextTick(() => {
    if (typeof window !== 'undefined' && (window as any).google?.maps?.places) {
      initAutocomplete()
    }
  })
}

async function handleSave() {
  if (!formData.name || !formData.address) {
    toast.add({ title: '姓名與地址為必填', color: 'error' })
    return
  }
  saving.value = true
  try {
    if (editingItem.value) {
      await api(`/api/dispatch/care-recipients/${editingItem.value.id}`, {
        method: 'PUT',
        body: { ...formData },
      })
      toast.add({ title: '個案資料已更新', color: 'success' })
    } else {
      await api('/api/dispatch/care-recipients', {
        method: 'POST',
        body: { ...formData },
      })
      toast.add({ title: '個案已新增', color: 'success' })
    }
    showModal.value = false
    await loadCases()
  } catch (err: any) {
    toast.add({ title: err?.data?.statusMessage || '儲存失敗', color: 'error' })
  } finally {
    saving.value = false
  }
}

function openDelete(c: any) {
  deletingItem.value = c
  showDeleteModal.value = true
}

async function handleDelete() {
  if (!deletingItem.value) return
  try {
    await api(`/api/dispatch/care-recipients/${deletingItem.value.id}`, { method: 'DELETE' })
    toast.add({ title: '個案已刪除', color: 'success' })
    showDeleteModal.value = false
    await loadCases()
  } catch (err: any) {
    toast.add({ title: err?.data?.statusMessage || '操作失敗', color: 'error' })
  }
}
</script>

<template>
  <div class="space-y-4">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <h2 class="text-lg font-semibold text-highlighted">個案管理</h2>
      <UButton icon="i-lucide-plus" @click="openAdd">新增個案</UButton>
    </div>

    <!-- Search -->
    <UInput v-model="search" placeholder="搜尋姓名、地址..." icon="i-lucide-search" class="max-w-sm" />

    <!-- Loading -->
    <div v-if="loading" class="flex justify-center py-12">
      <UIcon name="i-lucide-loader-2" class="text-2xl animate-spin text-muted" />
    </div>

    <!-- Empty -->
    <div v-else-if="filteredCases.length === 0" class="text-center py-12 text-muted">
      暫無個案資料
    </div>

    <!-- Table -->
    <div v-else class="overflow-x-auto rounded-lg border border-muted">
      <table class="w-full text-sm">
        <thead class="bg-muted/40">
          <tr>
            <th class="text-left px-4 py-3 font-medium text-muted">姓名</th>
            <th class="text-left px-4 py-3 font-medium text-muted">機構</th>
            <th class="text-center px-4 py-3 font-medium text-muted">特殊需求</th>
            <th class="text-left px-4 py-3 font-medium text-muted">地址</th>
            <th class="text-left px-4 py-3 font-medium text-muted">聯絡人</th>
            <th class="text-center px-4 py-3 font-medium text-muted">狀態</th>
            <th class="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-muted">
          <tr v-for="c in filteredCases" :key="c.id" class="hover:bg-muted/20 transition-colors">
            <td class="px-4 py-3 font-medium text-highlighted">{{ c.name }}</td>
            <td class="px-4 py-3 text-muted">{{ orgName || '-' }}</td>
            <td class="px-4 py-3 text-center">
              <UBadge :color="specialNeedsColor[c.specialNeeds] || 'neutral'" variant="subtle">
                {{ specialNeedsLabel[c.specialNeeds] || c.specialNeeds }}
              </UBadge>
            </td>
            <td class="px-4 py-3 max-w-xs truncate text-muted">{{ c.address || '-' }}</td>
            <td class="px-4 py-3 text-muted">{{ c.contactPerson || '-' }}</td>
            <td class="px-4 py-3 text-center">
              <UBadge v-if="c.isActive !== false" color="success" variant="subtle">啟用</UBadge>
              <UBadge v-else color="neutral" variant="subtle">停用</UBadge>
            </td>
            <td class="px-4 py-3">
              <div class="flex items-center justify-end gap-2">
                <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-calendar-clock" @click="openSchedules(c)">排程</UButton>
                <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-map-pin" @click="openLocations(c)">據點</UButton>
                <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-edit" @click="openEdit(c)">編輯</UButton>
                <UButton size="xs" color="error" variant="ghost" icon="i-lucide-trash-2" @click="openDelete(c)">刪除</UButton>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Add/Edit Modal -->
    <UModal v-model:open="showModal" :title="editingItem ? '編輯個案' : '新增個案'" description=" ">
      <template #content>
        <div class="p-6 space-y-4">
          <UFormField label="姓名 *">
            <UInput v-model="formData.name" placeholder="請輸入姓名" class="w-full" />
          </UFormField>

          <UFormField label="機構">
            <UInput :model-value="orgName" disabled class="w-full" />
          </UFormField>

          <div>
            <label class="text-sm font-medium">地址 *</label>
            <input
              ref="addressInput"
              v-model="formData.address"
              type="text"
              placeholder="輸入地址..."
              class="w-full mt-1 px-3 py-2 border border-default rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <p v-if="formData.lat && formData.lng" class="text-xs text-muted mt-1">
              座標：{{ formData.lat?.toFixed(6) }}, {{ formData.lng?.toFixed(6) }}
            </p>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <UFormField label="聯絡人">
              <UInput v-model="formData.contactPerson" placeholder="選填" class="w-full" />
            </UFormField>
            <UFormField label="聯絡電話">
              <UInput v-model="formData.contactPhone" placeholder="選填" class="w-full" />
            </UFormField>
          </div>

          <UFormField label="特殊需求">
            <USelect
              v-model="formData.specialNeeds"
              :items="specialNeedsOptions"
              class="w-full"
            />
          </UFormField>

          <UFormField label="備註">
            <UTextarea v-model="formData.notes" placeholder="選填" class="w-full" />
          </UFormField>

          <div class="flex justify-end gap-2 pt-2">
            <UButton color="neutral" variant="outline" @click="showModal = false">取消</UButton>
            <UButton color="primary" :loading="saving" @click="handleSave">儲存</UButton>
          </div>
        </div>
      </template>
    </UModal>

    <!-- Delete Confirm Modal -->
    <UModal v-model:open="showDeleteModal" title="確認刪除" description=" ">
      <template #content>
        <div class="p-6 space-y-4">
          <p class="text-sm text-muted">
            確定要刪除個案 <span class="font-semibold text-highlighted">{{ deletingItem?.name }}</span> 嗎？此操作無法復原。
          </p>
          <div class="flex justify-end gap-2">
            <UButton color="neutral" variant="outline" @click="showDeleteModal = false">取消</UButton>
            <UButton color="error" @click="handleDelete">確認刪除</UButton>
          </div>
        </div>
      </template>
    </UModal>

    <!-- 個案據點管理 Modal -->
    <UModal v-model:open="showLocationsModal" :title="`${locationsCase?.name} 的專屬據點`" description=" ">
      <template #content>
        <div class="p-6 space-y-4">
          <!-- 據點列表 -->
          <div v-if="!showLocationForm">
            <div class="flex items-center justify-between mb-3">
              <p class="text-sm text-muted">管理此個案常用的接送地點</p>
              <UButton size="xs" icon="i-lucide-plus" @click="openAddLocation">新增據點</UButton>
            </div>
            <div v-if="caseLocations.length === 0" class="text-center py-6 text-muted text-sm">
              尚無據點，點擊新增
            </div>
            <div v-else class="space-y-2">
              <div v-for="l in caseLocations" :key="l.id" class="flex items-center gap-3 border border-default rounded-lg px-3 py-2.5">
                <UIcon name="i-lucide-map-pin" class="text-primary shrink-0" />
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium">{{ l.name }}</p>
                  <p class="text-xs text-muted truncate">{{ l.address }}</p>
                </div>
                <UBadge :color="l.category === 'hospital' ? 'primary' : l.category === 'rehab' ? 'info' : 'neutral'" variant="subtle" size="xs">
                  {{ categoryLabelMap[l.category] || '-' }}
                </UBadge>
                <div class="flex gap-1 shrink-0">
                  <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-edit" @click="openEditLocation(l)" />
                  <UButton size="xs" color="error" variant="ghost" icon="i-lucide-trash-2" @click="confirmDeleteLocation(l)" />
                </div>
              </div>
            </div>
            <div class="flex justify-end pt-2">
              <UButton color="neutral" variant="outline" @click="showLocationsModal = false">關閉</UButton>
            </div>
          </div>

          <!-- 新增/編輯據點表單 -->
          <div v-else class="space-y-4">
            <p class="text-sm font-semibold">{{ editingLocation ? '編輯據點' : '新增據點' }}</p>
            <UFormField label="名稱 *">
              <UInput v-model="locationForm.name" placeholder="據點名稱" class="w-full" />
            </UFormField>
            <UFormField label="地址 *">
              <UInput v-model="locationForm.address" placeholder="完整地址" class="w-full" />
            </UFormField>
            <UFormField label="類別">
              <USelect v-model="locationForm.category" :items="categoryOptions" value-key="value" class="w-full" />
            </UFormField>
            <div class="grid grid-cols-2 gap-3">
              <UFormField label="緯度">
                <UInput v-model="locationForm.lat" type="number" step="any" placeholder="選填" class="w-full" />
              </UFormField>
              <UFormField label="經度">
                <UInput v-model="locationForm.lng" type="number" step="any" placeholder="選填" class="w-full" />
              </UFormField>
            </div>
            <div class="flex justify-end gap-2 pt-2">
              <UButton color="neutral" variant="outline" @click="showLocationForm = false">取消</UButton>
              <UButton color="primary" :loading="locationsSaving" @click="handleSaveLocation">儲存</UButton>
            </div>
          </div>
        </div>
      </template>
    </UModal>

    <!-- 週期性排程管理 Modal -->
    <UModal v-model:open="showSchedulesModal" :title="`${schedulesCase?.name} 的週期性排程`" description=" " size="lg">
      <template #content>
        <div class="p-6 space-y-4">
          <!-- 排程列表 -->
          <div v-if="!showScheduleForm">
            <div class="flex items-center justify-between mb-3">
              <p class="text-sm text-muted">設定固定的接送時間與路線</p>
              <UButton size="xs" icon="i-lucide-plus" @click="openAddSchedule">新增排程</UButton>
            </div>
            <div v-if="schedules.length === 0" class="text-center py-6 text-muted text-sm">尚無排程</div>
            <div v-else class="space-y-2">
              <div v-for="s in schedules" :key="s.id" class="border border-default rounded-lg px-4 py-3 space-y-1">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <div class="flex gap-1">
                      <span v-for="d in parseDays(s.daysOfWeek)" :key="d"
                        class="text-xs font-medium px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                        {{ dayLabel[d] }}
                      </span>
                    </div>
                    <span class="text-sm font-semibold">{{ s.departureTime }}</span>
                    <UBadge v-if="!s.isActive" label="停用" color="neutral" size="xs" />
                  </div>
                  <div class="flex gap-1">
                    <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-edit" @click="openEditSchedule(s)" />
                    <UButton size="xs" color="error" variant="ghost" icon="i-lucide-trash-2" @click="confirmDeleteSchedule(s)" />
                  </div>
                </div>
                <p class="text-xs text-muted">{{ s.originAddress }} → {{ s.destinationAddress }}</p>
                <p v-if="s.notes" class="text-xs text-muted">備註：{{ s.notes }}</p>
              </div>
            </div>
            <div class="flex justify-end pt-2">
              <UButton color="neutral" variant="outline" @click="showSchedulesModal = false">關閉</UButton>
            </div>
          </div>

          <!-- 新增/編輯排程表單 -->
          <div v-else class="space-y-4">
            <p class="text-sm font-semibold">{{ editingSchedule ? '編輯排程' : '新增排程' }}</p>

            <UFormField label="每週出發日 *">
              <div class="flex gap-2 flex-wrap">
                <label v-for="d in dayOptions" :key="d.value" class="flex items-center gap-1.5 cursor-pointer select-none">
                  <input type="checkbox" :value="d.value" v-model="scheduleForm.daysOfWeek" class="rounded" />
                  <span class="text-sm">週{{ d.label }}</span>
                </label>
              </div>
            </UFormField>

            <UFormField label="出發時間 *">
              <input v-model="scheduleForm.departureTime" type="time"
                class="px-3 py-2 border border-default rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </UFormField>

            <UFormField label="起點地址 *">
              <UInput v-model="scheduleForm.originAddress" placeholder="接送起點" class="w-full" />
            </UFormField>

            <UFormField label="終點地址 *">
              <UInput v-model="scheduleForm.destinationAddress" placeholder="接送終點" class="w-full" />
            </UFormField>

            <UFormField label="輪椅需求">
              <UCheckbox v-model="scheduleForm.needsWheelchair" label="需要輪椅" />
            </UFormField>

            <div class="grid grid-cols-2 gap-3">
              <UFormField label="生效日期（選填）">
                <input v-model="scheduleForm.effectiveStartDate" type="date"
                  class="w-full px-3 py-2 border border-default rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </UFormField>
              <UFormField label="結束日期（選填）">
                <input v-model="scheduleForm.effectiveEndDate" type="date"
                  class="w-full px-3 py-2 border border-default rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </UFormField>
            </div>

            <UFormField label="備註">
              <UTextarea v-model="scheduleForm.notes" placeholder="選填" class="w-full" />
            </UFormField>

            <UFormField v-if="editingSchedule" label="狀態">
              <UCheckbox v-model="scheduleForm.isActive" label="啟用此排程" />
            </UFormField>

            <div class="flex justify-end gap-2 pt-2">
              <UButton color="neutral" variant="outline" @click="showScheduleForm = false">取消</UButton>
              <UButton color="primary" :loading="scheduleSaving" @click="handleSaveSchedule">儲存</UButton>
            </div>
          </div>
        </div>
      </template>
    </UModal>

    <!-- 刪除排程確認 -->
    <UModal v-model:open="showDeleteScheduleModal" title="確認刪除排程" description=" ">
      <template #content>
        <div class="p-6 space-y-4">
          <p class="text-sm text-muted">確定要刪除此排程嗎？</p>
          <div class="flex justify-end gap-2">
            <UButton color="neutral" variant="outline" @click="showDeleteScheduleModal = false">取消</UButton>
            <UButton color="error" @click="handleDeleteSchedule">確認刪除</UButton>
          </div>
        </div>
      </template>
    </UModal>

    <!-- 刪除據點確認 -->
    <UModal v-model:open="showDeleteLocationModal" title="確認刪除據點" description=" ">
      <template #content>
        <div class="p-6 space-y-4">
          <p class="text-sm text-muted">確定要刪除據點 <span class="font-semibold text-highlighted">{{ deletingLocation?.name }}</span> 嗎？</p>
          <div class="flex justify-end gap-2">
            <UButton color="neutral" variant="outline" @click="showDeleteLocationModal = false">取消</UButton>
            <UButton color="error" @click="handleDeleteLocation">確認刪除</UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
