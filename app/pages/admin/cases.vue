<script setup lang="ts">
const toast = useToast()
const { api } = useApi()

const cases = ref<any[]>([])
const organizations = ref<any[]>([])
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
  organizationId: null as string | null,
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

const organizationOptions = computed(() =>
  organizations.value.map((o: any) => ({ label: o.name, value: o.id }))
)

const filteredCases = computed(() => {
  if (!search.value) return cases.value
  const q = search.value.toLowerCase()
  return cases.value.filter((c: any) =>
    c.name?.toLowerCase().includes(q) ||
    c.address?.toLowerCase().includes(q)
  )
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

onMounted(() => {
  loadCases()
  loadOrganizations()
})

function resetForm() {
  formData.name = ''
  formData.organizationId = null
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
  formData.organizationId = c.organizationId || null
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
            <td class="px-4 py-3 text-muted">{{ orgName(c.organizationId) }}</td>
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
  </div>
</template>
