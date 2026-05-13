<script setup lang="ts">
const toast = useToast()
const { api } = useApi()
const route = useRoute()
const router = useRouter()

const drivers = ref<any[]>([])
const fleets = ref<{ id: string; name: string }[]>([])
const loading = ref(false)
const search = ref('')
const ALL_FLEETS = '__all__'
const approvalFilter = ref<'all' | 'pending' | 'approved' | 'rejected'>(
  (route.query.approval as 'pending' | 'approved' | 'rejected') || 'all',
)
const fleetFilter = ref<string>(
  (route.query.fleetId as string) || (route.query.fleet === 'none' ? '__none__' : ALL_FLEETS),
)

const showAddModal = ref(false)
const showEditModal = ref(false)
const showDeleteModal = ref(false)
const editingItem = ref<any>(null)
const deletingItem = ref<any>(null)
const saving = ref(false)

const NO_FLEET = '__none__'

const addForm = reactive({
  name: '',
  email: '',
  phone: '',
  fleetId: NO_FLEET,
  licenseExpiry: '',
  emergencyContact: '',
  emergencyPhone: '',
})

const editForm = reactive({
  phone: '',
  fleetId: NO_FLEET,
  licenseExpiry: '',
  emergencyContact: '',
  emergencyPhone: '',
})

const fleetItems = computed(() => [
  { label: '獨立司機 (無車行)', value: NO_FLEET },
  ...fleets.value.map(f => ({ label: f.name, value: f.id })),
])

const fleetFilterItems = computed(() => [
  { label: '全部車行', value: ALL_FLEETS },
  { label: '獨立司機 (無車行)', value: NO_FLEET },
  ...fleets.value.map(f => ({ label: f.name, value: f.id })),
])

const approvalFilterItems = [
  { label: '全部', value: 'all' },
  { label: '待審核', value: 'pending' },
  { label: '已核准', value: 'approved' },
  { label: '已拒絕', value: 'rejected' },
]

function approvalBadge(status: string) {
  if (status === 'approved') return { color: 'success' as const, text: '已核准' }
  if (status === 'rejected') return { color: 'error' as const, text: '已拒絕' }
  return { color: 'warning' as const, text: '待審核' }
}

function getLicenseStatus(expiry: string | null) {
  if (!expiry) return 'none'
  const days = Math.ceil((new Date(expiry).getTime() - Date.now()) / 86400000)
  if (days < 0) return 'expired'
  if (days <= 30) return 'expiring'
  return 'ok'
}

const filteredDrivers = computed(() => {
  let list = drivers.value
  if (approvalFilter.value !== 'all') {
    list = list.filter(d => d.approvalStatus === approvalFilter.value)
  }
  if (fleetFilter.value !== ALL_FLEETS) {
    if (fleetFilter.value === NO_FLEET) {
      list = list.filter(d => !d.fleetId)
    } else {
      list = list.filter(d => d.fleetId === fleetFilter.value)
    }
  }
  if (search.value) {
    const q = search.value.toLowerCase()
    list = list.filter(d =>
      d.user?.name?.toLowerCase().includes(q) ||
      d.phone?.toLowerCase().includes(q),
    )
  }
  return [...list].sort((a, b) =>
    (a.user?.name || '').localeCompare(b.user?.name || '', 'zh-Hant'),
  )
})

// 同步 filter 狀態到 URL query
watch([approvalFilter, fleetFilter], ([approval, fleet]) => {
  const query: Record<string, string> = {}
  if (approval !== 'all') query.approval = approval
  if (fleet === NO_FLEET) query.fleet = 'none'
  else if (fleet !== ALL_FLEETS) query.fleetId = fleet
  router.replace({ query })
})

// 響應 URL query 變動（其他頁導入時帶 query）
watch(() => route.query, (q) => {
  approvalFilter.value = (q.approval as 'pending' | 'approved' | 'rejected') || 'all'
  if (q.fleetId) fleetFilter.value = q.fleetId as string
  else if (q.fleet === 'none') fleetFilter.value = NO_FLEET
  else fleetFilter.value = ALL_FLEETS
})

async function loadDrivers() {
  loading.value = true
  try {
    const [driverRes, fleetRes] = await Promise.all([
      api<any[]>('/api/dispatch/drivers?approvalStatus=all'),
      api<{ id: string; name: string }[]>('/api/fleets'),
    ])
    drivers.value = driverRes
    fleets.value = fleetRes
  } catch (err: any) {
    toast.add({ title: err?.data?.statusMessage || '載入失敗', color: 'error' })
  } finally {
    loading.value = false
  }
}

onMounted(loadDrivers)

function openAdd() {
  addForm.name = ''
  addForm.email = ''
  addForm.phone = ''
  addForm.fleetId = NO_FLEET
  addForm.licenseExpiry = ''
  addForm.emergencyContact = ''
  addForm.emergencyPhone = ''
  showAddModal.value = true
}

async function handleAdd() {
  if (!addForm.name || !addForm.email || !addForm.phone) {
    toast.add({ title: '姓名、Email、電話為必填', color: 'error' })
    return
  }
  saving.value = true
  try {
    await api('/api/dispatch/drivers', {
      method: 'POST',
      body: { ...addForm, fleetId: addForm.fleetId === NO_FLEET ? null : addForm.fleetId },
    })
    showAddModal.value = false
    toast.add({
      title: '司機帳號已建立，請請司機使用忘記密碼功能設定登入密碼',
      color: 'success',
    })
    await loadDrivers()
  } catch (err: any) {
    toast.add({ title: err?.data?.statusMessage || '新增失敗', color: 'error' })
  } finally {
    saving.value = false
  }
}

function openEdit(d: any) {
  editingItem.value = d
  editForm.phone = d.phone || ''
  editForm.fleetId = d.fleetId || NO_FLEET
  editForm.licenseExpiry = d.licenseExpiry ? d.licenseExpiry.substring(0, 10) : ''
  editForm.emergencyContact = d.emergencyContact || ''
  editForm.emergencyPhone = d.emergencyPhone || ''
  showEditModal.value = true
}

async function handleEdit() {
  if (!editingItem.value) return
  saving.value = true
  try {
    await api(`/api/dispatch/drivers/${editingItem.value.id}`, {
      method: 'PUT',
      body: { ...editForm, fleetId: editForm.fleetId === NO_FLEET ? null : editForm.fleetId },
    })
    toast.add({ title: '司機資料已更新', color: 'success' })
    showEditModal.value = false
    await loadDrivers()
  } catch (err: any) {
    toast.add({ title: err?.data?.statusMessage || '儲存失敗', color: 'error' })
  } finally {
    saving.value = false
  }
}

function openDelete(d: any) {
  deletingItem.value = d
  showDeleteModal.value = true
}

async function handleDelete() {
  if (!deletingItem.value) return
  try {
    await api(`/api/dispatch/drivers/${deletingItem.value.id}`, { method: 'DELETE' })
    toast.add({ title: '司機已停用', color: 'success' })
    showDeleteModal.value = false
    await loadDrivers()
  } catch (err: any) {
    toast.add({ title: err?.data?.statusMessage || '操作失敗', color: 'error' })
  }
}

function formatDate(iso: string | null) {
  if (!iso) return '-'
  return new Date(iso).toLocaleDateString('zh-TW')
}
</script>

<template>
  <div class="space-y-4">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <h2 class="text-lg font-semibold text-highlighted">司機管理</h2>
      <UButton icon="i-lucide-plus" @click="openAdd">新增司機</UButton>
    </div>

    <!-- Search + Filter -->
    <div class="flex flex-wrap items-center gap-2">
      <UInput v-model="search" placeholder="搜尋姓名、電話..." icon="i-lucide-search" class="max-w-sm" />
      <USelectMenu v-model="approvalFilter" :items="approvalFilterItems" value-key="value" placeholder="審核狀態" class="w-40" />
      <USelectMenu v-model="fleetFilter" :items="fleetFilterItems" value-key="value" placeholder="車行" class="w-48" />
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex justify-center py-12">
      <UIcon name="i-lucide-loader-2" class="text-2xl animate-spin text-muted" />
    </div>

    <!-- Empty -->
    <div v-else-if="filteredDrivers.length === 0" class="text-center py-12 text-muted">
      暫無司機資料
    </div>

    <!-- Table -->
    <div v-else class="overflow-x-auto rounded-lg border border-muted">
      <table class="w-full text-sm">
        <thead class="bg-muted/40">
          <tr>
            <th class="text-left px-4 py-3 font-medium text-muted">姓名</th>
            <th class="text-left px-4 py-3 font-medium text-muted">車行</th>
            <th class="text-left px-4 py-3 font-medium text-muted">電話</th>
            <th class="text-center px-4 py-3 font-medium text-muted">審核</th>
            <th class="text-center px-4 py-3 font-medium text-muted">護照效期</th>
            <th class="text-center px-4 py-3 font-medium text-muted">帳號狀態</th>
            <th class="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-muted">
          <tr v-for="d in filteredDrivers" :key="d.id" class="hover:bg-muted/20 transition-colors">
            <td class="px-4 py-3 font-medium text-highlighted">
              <NuxtLink :to="`/admin/drivers/${d.id}`" class="hover:underline">{{ d.user?.name || '-' }}</NuxtLink>
            </td>
            <td class="px-4 py-3">{{ d.fleet?.name || '獨立' }}</td>
            <td class="px-4 py-3">{{ d.phone || '-' }}</td>
            <td class="px-4 py-3 text-center">
              <UBadge :color="approvalBadge(d.approvalStatus).color" variant="subtle">{{ approvalBadge(d.approvalStatus).text }}</UBadge>
            </td>
            <td class="px-4 py-3 text-center">
              <UBadge
                v-if="getLicenseStatus(d.licenseExpiry) === 'expired'"
                color="error"
                variant="subtle"
              >已過期</UBadge>
              <UBadge
                v-else-if="getLicenseStatus(d.licenseExpiry) === 'expiring'"
                color="warning"
                variant="subtle"
              >30天內到期</UBadge>
              <UBadge
                v-else-if="getLicenseStatus(d.licenseExpiry) === 'ok'"
                color="success"
                variant="subtle"
              >正常</UBadge>
              <span v-else class="text-muted text-xs">未設定</span>
            </td>
            <td class="px-4 py-3 text-center">
              <UBadge v-if="d.user?.banned" color="error" variant="subtle">停用</UBadge>
              <UBadge v-else-if="d.isActive" color="success" variant="subtle">啟用</UBadge>
              <UBadge v-else color="neutral" variant="subtle">已停用</UBadge>
            </td>
            <td class="px-4 py-3">
              <div class="flex items-center justify-end gap-2">
                <UButton size="xs" color="primary" variant="ghost" icon="i-lucide-eye" :to="`/admin/drivers/${d.id}`">詳情</UButton>
                <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-edit" @click="openEdit(d)">編輯</UButton>
                <UButton size="xs" color="error" variant="ghost" icon="i-lucide-ban" @click="openDelete(d)">停用</UButton>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Add Modal -->
    <UModal v-model:open="showAddModal" title="新增司機帳號" description=" ">
      <template #content>
        <div class="p-6 space-y-4">
          <UFormField label="姓名 *">
            <UInput v-model="addForm.name" placeholder="真實姓名" class="w-full" />
          </UFormField>
          <UFormField label="Email *">
            <UInput v-model="addForm.email" type="email" placeholder="登入用 Email" class="w-full" />
          </UFormField>
          <UFormField label="電話 *">
            <UInput v-model="addForm.phone" placeholder="聯絡電話" class="w-full" />
          </UFormField>
          <UFormField label="駕照效期">
            <UInput v-model="addForm.licenseExpiry" type="date" class="w-full" />
          </UFormField>
          <UFormField label="緊急聯絡人">
            <UInput v-model="addForm.emergencyContact" placeholder="選填" class="w-full" />
          </UFormField>
          <UFormField label="緊急聯絡電話">
            <UInput v-model="addForm.emergencyPhone" placeholder="選填" class="w-full" />
          </UFormField>
          <UFormField label="所屬車行">
            <USelectMenu v-model="addForm.fleetId" :items="fleetItems" value-key="value" placeholder="獨立司機 (無車行)" class="w-full" />
          </UFormField>
          <div class="flex justify-end gap-2 pt-2">
            <UButton color="neutral" variant="outline" @click="showAddModal = false">取消</UButton>
            <UButton color="primary" :loading="saving" @click="handleAdd">建立帳號</UButton>
          </div>
        </div>
      </template>
    </UModal>

    <!-- Edit Modal -->
    <UModal v-model:open="showEditModal" title="編輯司機資料" description=" ">
      <template #content>
        <div class="p-6 space-y-4">
          <p class="text-sm text-muted">{{ editingItem?.user?.name }}</p>
          <UFormField label="電話">
            <UInput v-model="editForm.phone" placeholder="聯絡電話" class="w-full" />
          </UFormField>
          <UFormField label="駕照效期">
            <UInput v-model="editForm.licenseExpiry" type="date" class="w-full" />
          </UFormField>
          <UFormField label="緊急聯絡人">
            <UInput v-model="editForm.emergencyContact" placeholder="選填" class="w-full" />
          </UFormField>
          <UFormField label="緊急聯絡電話">
            <UInput v-model="editForm.emergencyPhone" placeholder="選填" class="w-full" />
          </UFormField>
          <UFormField label="所屬車行">
            <USelectMenu v-model="editForm.fleetId" :items="fleetItems" value-key="value" placeholder="獨立司機 (無車行)" class="w-full" />
          </UFormField>
          <div class="flex justify-end gap-2 pt-2">
            <UButton color="neutral" variant="outline" @click="showEditModal = false">取消</UButton>
            <UButton color="primary" :loading="saving" @click="handleEdit">儲存</UButton>
          </div>
        </div>
      </template>
    </UModal>

    <!-- Delete Confirm Modal -->
    <UModal v-model:open="showDeleteModal" title="確認停用" description=" ">
      <template #content>
        <div class="p-6 space-y-4">
          <p class="text-sm text-muted">
            確定要停用司機 <span class="font-semibold text-highlighted">{{ deletingItem?.user?.name }}</span> 嗎？
          </p>
          <div class="flex justify-end gap-2">
            <UButton color="neutral" variant="outline" @click="showDeleteModal = false">取消</UButton>
            <UButton color="error" @click="handleDelete">確認停用</UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
