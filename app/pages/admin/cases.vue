<script setup lang="ts">
const toast = useToast()
const { api } = useApi()

interface Device { id: string; name: string }
interface SpecialNeed { id: string; name: string; description: string | null }

const cases = ref<any[]>([])
const organizations = ref<any[]>([])
const devices = ref<Device[]>([])
const specialNeeds = ref<SpecialNeed[]>([])
const loading = ref(false)
const search = ref('')

const ALL_ORGS = '__all__'
const NO_ORG = '__none__'
const orgFilter = ref<string>(ALL_ORGS)
const orgFilterItems = computed(() => [
  { label: '全部機構', value: ALL_ORGS },
  { label: '未指定機構', value: NO_ORG },
  ...organizations.value.map((o: any) => ({ label: o.name, value: o.id })),
])

const showModal = ref(false)
const showDeleteModal = ref(false)
const editingItem = ref<any>(null)
const deletingItem = ref<any>(null)
const saving = ref(false)

const addressInput = ref<HTMLInputElement | null>(null)
let autocomplete: any = null

const formData = reactive({
  name: '',
  organizationId: null as string | null,
  address: '',
  lat: null as number | null,
  lng: null as number | null,
  contactPerson: '',
  contactPhone: '',
  specialNeedIds: [] as string[],
  deviceIds: [] as string[],
  notes: '',
})

const deviceOptions = computed(() => devices.value.map(d => ({ label: d.name, value: d.id })))
const specialNeedOptions = computed(() => specialNeeds.value.map(s => ({ label: s.name, value: s.id })))

const organizationOptions = computed(() =>
  organizations.value.map((o: any) => ({ label: o.name, value: o.id }))
)

const filteredCases = computed(() => {
  let list = cases.value
  if (orgFilter.value === NO_ORG) {
    list = list.filter((c: any) => !c.organizationId)
  } else if (orgFilter.value !== ALL_ORGS) {
    list = list.filter((c: any) => c.organizationId === orgFilter.value)
  }
  if (search.value) {
    const q = search.value.toLowerCase()
    list = list.filter((c: any) =>
      c.name?.toLowerCase().includes(q) ||
      c.address?.toLowerCase().includes(q),
    )
  }
  return list
})

function orgName(id: string) {
  return organizations.value.find((o: any) => o.id === id)?.name || '-'
}

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

async function loadOrganizations() {
  try {
    organizations.value = await api<any[]>('/api/dispatch/organizations')
  } catch {
    // silently fail
  }
}

async function loadDevices() {
  try {
    devices.value = await api<Device[]>('/api/dispatch/devices')
  } catch {
    devices.value = []
  }
}

async function loadSpecialNeeds() {
  try {
    specialNeeds.value = await api<SpecialNeed[]>('/api/dispatch/special-needs')
  } catch {
    specialNeeds.value = []
  }
}

onMounted(() => {
  loadCases()
  loadOrganizations()
  loadDevices()
  loadSpecialNeeds()
})

function resetForm() {
  formData.name = ''
  formData.organizationId = null
  formData.address = ''
  formData.lat = null
  formData.lng = null
  formData.contactPerson = ''
  formData.contactPhone = ''
  formData.specialNeedIds = []
  formData.deviceIds = []
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

async function openEdit(c: any) {
  editingItem.value = c
  formData.name = c.name
  formData.organizationId = c.organizationId || null
  formData.address = c.address || ''
  formData.lat = c.lat != null ? Number(c.lat) : null
  formData.lng = c.lng != null ? Number(c.lng) : null
  formData.contactPerson = c.contactPerson || ''
  formData.contactPhone = c.contactPhone || ''
  formData.specialNeedIds = []
  formData.deviceIds = []
  formData.notes = c.notes || ''
  showModal.value = true
  nextTick(() => {
    if (typeof window !== 'undefined' && (window as any).google?.maps?.places) {
      initAutocomplete()
    }
  })
  // 載入個案常用輔具與特殊需求
  try {
    const detail = await api<{ devices?: Device[]; specialNeeds?: SpecialNeed[] }>(`/api/dispatch/care-recipients/${c.id}`)
    formData.deviceIds = (detail.devices || []).map(d => d.id)
    formData.specialNeedIds = (detail.specialNeeds || []).map(s => s.id)
  } catch {
    formData.deviceIds = []
    formData.specialNeedIds = []
  }
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
  roundTrip: false,
  returnDepartureTime: '',
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
  scheduleForm.roundTrip = false
  scheduleForm.returnDepartureTime = ''
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
  scheduleForm.roundTrip = s.roundTrip || false
  scheduleForm.returnDepartureTime = s.returnDepartureTime || ''
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
  if (scheduleForm.roundTrip && !scheduleForm.returnDepartureTime) {
    toast.add({ title: '勾選來回時請填寫回程出發時間', color: 'error' }); return
  }
  if (scheduleForm.roundTrip && scheduleForm.returnDepartureTime
    && scheduleForm.returnDepartureTime <= scheduleForm.departureTime) {
    toast.add({ title: '回程出發時間需晚於去程', color: 'error' }); return
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
</script>

<template>
  <div class="space-y-4">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <h2 class="text-lg font-semibold text-highlighted">個案管理</h2>
      <UButton icon="i-lucide-plus" @click="openAdd">新增個案</UButton>
    </div>

    <!-- Search + Filter -->
    <div class="flex flex-wrap items-end gap-3">
      <UInput v-model="search" placeholder="搜尋姓名、地址..." icon="i-lucide-search" class="max-w-sm" />
      <USelectMenu v-model="orgFilter" :items="orgFilterItems" value-key="value" placeholder="機構" class="w-48" />
    </div>

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
            <th class="text-left px-4 py-3 font-medium text-muted">地址</th>
            <th class="text-left px-4 py-3 font-medium text-muted">聯絡人</th>
            <th class="text-center px-4 py-3 font-medium text-muted">狀態</th>
            <th class="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-muted">
          <tr v-for="c in filteredCases" :key="c.id" class="hover:bg-muted/20 transition-colors">
            <td class="px-4 py-3 font-medium text-highlighted">{{ c.name }}</td>
            <td class="px-4 py-3 text-muted">{{ orgName(c.organizationId) }}</td>
            <td class="px-4 py-3 max-w-xs truncate text-muted">{{ c.address || '-' }}</td>
            <td class="px-4 py-3 text-muted">{{ c.contactPerson || '-' }}</td>
            <td class="px-4 py-3 text-center">
              <UBadge v-if="c.isActive !== false" color="success" variant="subtle">啟用</UBadge>
              <UBadge v-else color="neutral" variant="subtle">停用</UBadge>
            </td>
            <td class="px-4 py-3">
              <div class="flex items-center justify-end gap-2">
                <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-calendar-clock" @click="openSchedules(c)">排程</UButton>
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
            <USelect
              v-model="formData.organizationId"
              :items="organizationOptions"
              placeholder="選擇機構（選填）"
              class="w-full"
            />
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

          <UFormField label="特殊需求" hint="可多選；至「特殊需求管理」可新增自訂項目">
            <USelectMenu
              v-model="formData.specialNeedIds"
              :items="specialNeedOptions"
              value-key="value"
              multiple
              searchable
              placeholder="可多選"
              class="w-full"
            />
          </UFormField>

          <UFormField label="常用輔具" hint="新增訂單時會自動帶入，可在訂單頁修改">
            <USelectMenu
              v-model="formData.deviceIds"
              :items="deviceOptions"
              value-key="value"
              multiple
              searchable
              placeholder="可多選"
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

    <!-- 週期性排程 Modal -->
    <UModal v-model:open="showSchedulesModal" :title="`${schedulesCase?.name || ''} 的週期性排程`" description=" " size="lg">
      <template #content>
        <div class="p-6 space-y-4">
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

          <div v-else class="space-y-4">
            <p class="text-sm font-semibold">{{ editingSchedule ? '編輯排程' : '新增排程' }}</p>

            <UFormField label="每週出發日 *">
              <div class="flex gap-2 flex-wrap">
                <label v-for="d in dayOptions" :key="d.value" class="flex items-center gap-1.5 cursor-pointer select-none">
                  <input v-model="scheduleForm.daysOfWeek" type="checkbox" :value="d.value" class="rounded" />
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

            <!-- 來回 -->
            <div class="border border-default rounded p-3 space-y-2">
              <label class="flex items-center gap-2 cursor-pointer">
                <UCheckbox v-model="scheduleForm.roundTrip" />
                <span class="text-sm font-medium">需要回程（每次排程都生成回程）</span>
              </label>
              <UFormField v-if="scheduleForm.roundTrip" label="回程出發時間 *">
                <input v-model="scheduleForm.returnDepartureTime" type="time"
                  class="px-3 py-2 border border-default rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </UFormField>
              <p v-if="scheduleForm.roundTrip" class="text-xs text-muted">回程起點為去程終點、終點為去程起點，並會自動與去程互相 link。</p>
            </div>

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
  </div>
</template>
