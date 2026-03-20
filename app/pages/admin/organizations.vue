<script setup lang="ts">
const toast = useToast()
const { api } = useApi()

const organizations = ref<any[]>([])
const loading = ref(false)
const search = ref('')

// Org CRUD modal
const showModal = ref(false)
const showDeleteModal = ref(false)
const editingItem = ref<any>(null)
const deletingItem = ref<any>(null)
const saving = ref(false)

const form = reactive({
  name: '',
  contactPerson: '',
  phone: '',
  address: '',
})

// Staff management modal
const showStaffModal = ref(false)
const staffOrg = ref<any>(null)
const staffList = ref<any[]>([])
const staffLoading = ref(false)
const showAddStaffForm = ref(false)
const staffForm = reactive({ name: '', email: '' })
const addingStaff = ref(false)
const removingId = ref<string | null>(null)

const filteredOrganizations = computed(() => {
  if (!search.value) return organizations.value
  const q = search.value.toLowerCase()
  return organizations.value.filter(o =>
    o.name?.toLowerCase().includes(q) ||
    o.contactPerson?.toLowerCase().includes(q) ||
    o.phone?.toLowerCase().includes(q)
  )
})

async function loadOrganizations() {
  loading.value = true
  try {
    organizations.value = await api<any[]>('/api/dispatch/organizations')
  } catch (err: any) {
    toast.add({ title: err?.data?.statusMessage || '載入失敗', color: 'error' })
  } finally {
    loading.value = false
  }
}

onMounted(loadOrganizations)

function openAdd() {
  editingItem.value = null
  form.name = ''
  form.contactPerson = ''
  form.phone = ''
  form.address = ''
  showModal.value = true
}

function openEdit(o: any) {
  editingItem.value = o
  form.name = o.name
  form.contactPerson = o.contactPerson || ''
  form.phone = o.phone || ''
  form.address = o.address || ''
  showModal.value = true
}

async function handleSave() {
  if (!form.name) {
    toast.add({ title: '機構名稱為必填', color: 'error' })
    return
  }
  saving.value = true
  try {
    if (editingItem.value) {
      await api(`/api/dispatch/organizations/${editingItem.value.id}`, { method: 'PUT', body: { ...form } })
      toast.add({ title: '機構資料已更新', color: 'success' })
    } else {
      await api('/api/dispatch/organizations', { method: 'POST', body: { ...form } })
      toast.add({ title: '機構已新增', color: 'success' })
    }
    showModal.value = false
    await loadOrganizations()
  } catch (err: any) {
    toast.add({ title: err?.data?.statusMessage || '儲存失敗', color: 'error' })
  } finally {
    saving.value = false
  }
}

function openDelete(o: any) {
  deletingItem.value = o
  showDeleteModal.value = true
}

async function handleDelete() {
  if (!deletingItem.value) return
  try {
    await api(`/api/dispatch/organizations/${deletingItem.value.id}`, { method: 'DELETE' })
    toast.add({ title: '機構已刪除', color: 'success' })
    showDeleteModal.value = false
    await loadOrganizations()
  } catch (err: any) {
    toast.add({ title: err?.data?.statusMessage || '操作失敗', color: 'error' })
  }
}

// ── Staff management ──

async function openStaff(o: any) {
  staffOrg.value = o
  showStaffModal.value = true
  showAddStaffForm.value = false
  staffForm.name = ''
  staffForm.email = ''
  await loadStaff(o.id)
}

async function loadStaff(orgId: string) {
  staffLoading.value = true
  try {
    staffList.value = await api<any[]>(`/api/dispatch/organizations/${orgId}/staff`)
  } catch {
    toast.add({ title: '載入人員失敗', color: 'error' })
  } finally {
    staffLoading.value = false
  }
}

async function handleAddStaff() {
  if (!staffForm.name || !staffForm.email) {
    toast.add({ title: '姓名和電子信箱為必填', color: 'error' })
    return
  }
  addingStaff.value = true
  try {
    await api(`/api/dispatch/organizations/${staffOrg.value.id}/staff`, {
      method: 'POST',
      body: { name: staffForm.name, email: staffForm.email },
    })
    toast.add({ title: '機構人員已新增，請通知對方使用忘記密碼設定密碼', color: 'success' })
    staffForm.name = ''
    staffForm.email = ''
    showAddStaffForm.value = false
    await loadStaff(staffOrg.value.id)
  } catch (err: any) {
    toast.add({ title: err?.data?.statusMessage || '新增失敗', color: 'error' })
  } finally {
    addingStaff.value = false
  }
}

// ── 個案管理 ──

const showCasesModal = ref(false)
const casesOrg = ref<any>(null)
const casesList = ref<any[]>([])
const casesLoading = ref(false)
const showCaseForm = ref(false)
const editingCase = ref<any>(null)
const caseSaving = ref(false)
const showDeleteCaseModal = ref(false)
const deletingCase = ref<any>(null)

const specialNeedsOptions = [
  { label: '一般', value: 'general' },
  { label: '輪椅', value: 'wheelchair' },
  { label: '臥床', value: 'bedridden' },
]
const specialNeedsLabel: Record<string, string> = { general: '一般', wheelchair: '輪椅', bedridden: '臥床' }
const specialNeedsColor: Record<string, string> = { general: 'neutral', wheelchair: 'warning', bedridden: 'error' }

const caseForm = reactive({
  name: '',
  address: '',
  contactPerson: '',
  contactPhone: '',
  specialNeeds: 'general',
  notes: '',
})

async function openCases(o: any) {
  casesOrg.value = o
  showCasesModal.value = true
  showCaseForm.value = false
  await loadCases(o.id)
}

async function loadCases(orgId: string) {
  casesLoading.value = true
  try {
    casesList.value = await api<any[]>(`/api/dispatch/care-recipients?organizationId=${orgId}`)
  } catch {
    casesList.value = []
  } finally {
    casesLoading.value = false
  }
}

function openAddCase() {
  editingCase.value = null
  caseForm.name = ''
  caseForm.address = ''
  caseForm.contactPerson = ''
  caseForm.contactPhone = ''
  caseForm.specialNeeds = 'general'
  caseForm.notes = ''
  showCaseForm.value = true
}

function openEditCase(c: any) {
  editingCase.value = c
  caseForm.name = c.name
  caseForm.address = c.address || ''
  caseForm.contactPerson = c.contactPerson || ''
  caseForm.contactPhone = c.contactPhone || ''
  caseForm.specialNeeds = c.specialNeeds || 'general'
  caseForm.notes = c.notes || ''
  showCaseForm.value = true
}

async function handleSaveCase() {
  if (!caseForm.name || !caseForm.address) {
    toast.add({ title: '姓名與地址為必填', color: 'error' }); return
  }
  caseSaving.value = true
  try {
    const body = { ...caseForm, organizationId: casesOrg.value.id }
    if (editingCase.value) {
      await api(`/api/dispatch/care-recipients/${editingCase.value.id}`, { method: 'PUT', body })
    } else {
      await api('/api/dispatch/care-recipients', { method: 'POST', body })
    }
    toast.add({ title: editingCase.value ? '個案已更新' : '個案已新增', color: 'success' })
    showCaseForm.value = false
    await loadCases(casesOrg.value.id)
  } catch (err: any) {
    toast.add({ title: err?.data?.statusMessage || '儲存失敗', color: 'error' })
  } finally {
    caseSaving.value = false
  }
}

function confirmDeleteCase(c: any) {
  deletingCase.value = c
  showDeleteCaseModal.value = true
}

async function handleDeleteCase() {
  if (!deletingCase.value) return
  try {
    await api(`/api/dispatch/care-recipients/${deletingCase.value.id}`, { method: 'DELETE' })
    toast.add({ title: '個案已刪除', color: 'success' })
    showDeleteCaseModal.value = false
    await loadCases(casesOrg.value.id)
  } catch (err: any) {
    toast.add({ title: err?.data?.statusMessage || '操作失敗', color: 'error' })
  }
}

async function handleRemoveStaff(userId: string) {
  if (!window.confirm('確定要移除此機構人員？該帳號將變更為一般用戶。')) return
  removingId.value = userId
  try {
    await api(`/api/dispatch/organizations/${staffOrg.value.id}/staff/${userId}`, { method: 'DELETE' })
    toast.add({ title: '已移除機構人員', color: 'success' })
    await loadStaff(staffOrg.value.id)
  } catch (err: any) {
    toast.add({ title: err?.data?.statusMessage || '操作失敗', color: 'error' })
  } finally {
    removingId.value = null
  }
}
</script>

<template>
  <div class="space-y-4">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <h2 class="text-lg font-semibold text-highlighted">機構管理</h2>
      <UButton icon="i-lucide-plus" @click="openAdd">新增機構</UButton>
    </div>

    <!-- Search -->
    <UInput v-model="search" placeholder="搜尋機構名稱、聯絡人..." icon="i-lucide-search" class="max-w-sm" />

    <div v-if="loading" class="flex justify-center py-12">
      <UIcon name="i-lucide-loader-2" class="text-2xl animate-spin text-muted" />
    </div>

    <div v-else-if="filteredOrganizations.length === 0" class="text-center py-12 text-muted">
      暫無機構資料
    </div>

    <div v-else class="overflow-x-auto rounded-lg border border-muted">
      <table class="w-full text-sm">
        <thead class="bg-muted/40">
          <tr>
            <th class="text-left px-4 py-3 font-medium text-muted">機構名稱</th>
            <th class="text-left px-4 py-3 font-medium text-muted">聯絡人</th>
            <th class="text-left px-4 py-3 font-medium text-muted">電話</th>
            <th class="text-left px-4 py-3 font-medium text-muted">地址</th>
            <th class="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-muted">
          <tr v-for="o in filteredOrganizations" :key="o.id" class="hover:bg-muted/20 transition-colors">
            <td class="px-4 py-3 font-medium text-highlighted">{{ o.name }}</td>
            <td class="px-4 py-3">{{ o.contactPerson || '-' }}</td>
            <td class="px-4 py-3">{{ o.phone || '-' }}</td>
            <td class="px-4 py-3 max-w-xs truncate">{{ o.address || '-' }}</td>
            <td class="px-4 py-3">
              <div class="flex items-center justify-end gap-2">
                <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-heart-handshake" @click="openCases(o)">個案</UButton>
                <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-users" @click="openStaff(o)">人員</UButton>
                <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-edit" @click="openEdit(o)">編輯</UButton>
                <UButton size="xs" color="error" variant="ghost" icon="i-lucide-trash-2" @click="openDelete(o)">刪除</UButton>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Org Add/Edit Modal -->
    <UModal v-model:open="showModal" :title="editingItem ? '編輯機構' : '新增機構'" description=" ">
      <template #content>
        <div class="p-6 space-y-4">
          <UFormField label="機構名稱 *">
            <UInput v-model="form.name" placeholder="機構全名" class="w-full" />
          </UFormField>
          <UFormField label="聯絡人">
            <UInput v-model="form.contactPerson" placeholder="選填" class="w-full" />
          </UFormField>
          <UFormField label="電話">
            <UInput v-model="form.phone" placeholder="選填" class="w-full" />
          </UFormField>
          <UFormField label="地址">
            <UInput v-model="form.address" placeholder="選填" class="w-full" />
          </UFormField>
          <div class="flex justify-end gap-2 pt-2">
            <UButton color="neutral" variant="outline" @click="showModal = false">取消</UButton>
            <UButton color="primary" :loading="saving" @click="handleSave">儲存</UButton>
          </div>
        </div>
      </template>
    </UModal>

    <!-- Staff Management Modal -->
    <UModal v-model:open="showStaffModal" :title="`${staffOrg?.name || ''} — 機構人員管理`" description=" ">
      <template #content>
        <div class="p-6 space-y-4">
          <!-- Staff list -->
          <div v-if="staffLoading" class="flex justify-center py-6">
            <UIcon name="i-lucide-loader-2" class="animate-spin text-muted text-xl" />
          </div>
          <div v-else-if="staffList.length === 0 && !showAddStaffForm" class="text-sm text-muted text-center py-4">
            尚未設定機構人員
          </div>
          <div v-else class="space-y-2">
            <div
              v-for="s in staffList"
              :key="s.id"
              class="flex items-center justify-between px-3 py-2 rounded-lg border border-muted bg-muted/20"
            >
              <div>
                <p class="text-sm font-medium text-highlighted">{{ s.name }}</p>
                <p class="text-xs text-muted">{{ s.email }}</p>
              </div>
              <UButton
                size="xs"
                color="error"
                variant="ghost"
                icon="i-lucide-user-minus"
                :loading="removingId === s.id"
                @click="handleRemoveStaff(s.id)"
              >
                移除
              </UButton>
            </div>
          </div>

          <!-- Add staff form -->
          <div v-if="showAddStaffForm" class="space-y-3 pt-2 border-t border-muted">
            <p class="text-sm font-medium text-highlighted">新增機構人員</p>
            <UFormField label="姓名 *">
              <UInput v-model="staffForm.name" placeholder="請輸入姓名" class="w-full" />
            </UFormField>
            <UFormField label="電子信箱 *">
              <UInput v-model="staffForm.email" type="email" placeholder="請輸入電子信箱" class="w-full" />
            </UFormField>
            <p class="text-xs text-muted">新增後請通知對方至登入頁點選「忘記密碼」設定密碼。</p>
            <div class="flex justify-end gap-2">
              <UButton color="neutral" variant="outline" size="sm" @click="showAddStaffForm = false">取消</UButton>
              <UButton color="primary" size="sm" :loading="addingStaff" @click="handleAddStaff">新增</UButton>
            </div>
          </div>

          <div class="flex items-center justify-between pt-2 border-t border-muted">
            <UButton
              v-if="!showAddStaffForm"
              icon="i-lucide-user-plus"
              size="sm"
              variant="outline"
              @click="showAddStaffForm = true"
            >
              新增機構人員
            </UButton>
            <div class="ml-auto">
              <UButton color="neutral" variant="ghost" size="sm" @click="showStaffModal = false">關閉</UButton>
            </div>
          </div>
        </div>
      </template>
    </UModal>

    <!-- 個案管理 Modal -->
    <UModal v-model:open="showCasesModal" :title="`${casesOrg?.name || ''} — 個案管理`" description=" " size="lg">
      <template #content>
        <div class="p-6 space-y-4">
          <div v-if="!showCaseForm">
            <div class="flex items-center justify-between mb-3">
              <p class="text-sm text-muted">管理此機構下的服務個案</p>
              <UButton size="xs" icon="i-lucide-plus" @click="openAddCase">新增個案</UButton>
            </div>
            <div v-if="casesLoading" class="flex justify-center py-8">
              <UIcon name="i-lucide-loader-2" class="text-xl animate-spin text-muted" />
            </div>
            <div v-else-if="casesList.length === 0" class="text-center py-6 text-muted text-sm">尚無個案資料</div>
            <div v-else class="overflow-x-auto rounded-lg border border-muted">
              <table class="w-full text-sm">
                <thead class="bg-muted/40">
                  <tr>
                    <th class="text-left px-3 py-2 font-medium text-muted">姓名</th>
                    <th class="text-center px-3 py-2 font-medium text-muted">特殊需求</th>
                    <th class="text-left px-3 py-2 font-medium text-muted">聯絡人</th>
                    <th class="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-muted">
                  <tr v-for="c in casesList" :key="c.id" class="hover:bg-muted/20">
                    <td class="px-3 py-2 font-medium text-highlighted">{{ c.name }}</td>
                    <td class="px-3 py-2 text-center">
                      <UBadge :color="specialNeedsColor[c.specialNeeds] || 'neutral'" variant="subtle" size="xs">
                        {{ specialNeedsLabel[c.specialNeeds] || c.specialNeeds }}
                      </UBadge>
                    </td>
                    <td class="px-3 py-2 text-muted">{{ c.contactPerson || '-' }}</td>
                    <td class="px-3 py-2">
                      <div class="flex items-center justify-end gap-1">
                        <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-edit" @click="openEditCase(c)" />
                        <UButton size="xs" color="error" variant="ghost" icon="i-lucide-trash-2" @click="confirmDeleteCase(c)" />
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="flex justify-end pt-3">
              <UButton color="neutral" variant="outline" @click="showCasesModal = false">關閉</UButton>
            </div>
          </div>

          <!-- 新增/編輯個案表單 -->
          <div v-else class="space-y-4">
            <p class="text-sm font-semibold">{{ editingCase ? '編輯個案' : '新增個案' }}</p>
            <UFormField label="姓名 *">
              <UInput v-model="caseForm.name" placeholder="個案姓名" class="w-full" />
            </UFormField>
            <UFormField label="地址 *">
              <UInput v-model="caseForm.address" placeholder="居住地址" class="w-full" />
            </UFormField>
            <div class="grid grid-cols-2 gap-3">
              <UFormField label="聯絡人">
                <UInput v-model="caseForm.contactPerson" placeholder="選填" class="w-full" />
              </UFormField>
              <UFormField label="聯絡電話">
                <UInput v-model="caseForm.contactPhone" placeholder="選填" class="w-full" />
              </UFormField>
            </div>
            <UFormField label="特殊需求">
              <USelect v-model="caseForm.specialNeeds" :items="specialNeedsOptions" class="w-full" />
            </UFormField>
            <UFormField label="備註">
              <UTextarea v-model="caseForm.notes" placeholder="選填" class="w-full" />
            </UFormField>
            <div class="flex justify-end gap-2 pt-2">
              <UButton color="neutral" variant="outline" @click="showCaseForm = false">取消</UButton>
              <UButton color="primary" :loading="caseSaving" @click="handleSaveCase">儲存</UButton>
            </div>
          </div>
        </div>
      </template>
    </UModal>

    <!-- 刪除個案確認 -->
    <UModal v-model:open="showDeleteCaseModal" title="確認刪除個案" description=" ">
      <template #content>
        <div class="p-6 space-y-4">
          <p class="text-sm text-muted">確定要刪除個案 <span class="font-semibold text-highlighted">{{ deletingCase?.name }}</span> 嗎？</p>
          <div class="flex justify-end gap-2">
            <UButton color="neutral" variant="outline" @click="showDeleteCaseModal = false">取消</UButton>
            <UButton color="error" @click="handleDeleteCase">確認刪除</UButton>
          </div>
        </div>
      </template>
    </UModal>

    <!-- Delete Org Modal -->
    <UModal v-model:open="showDeleteModal" title="確認刪除" description=" ">
      <template #content>
        <div class="p-6 space-y-4">
          <p class="text-sm text-muted">
            確定要刪除機構 <span class="font-semibold text-highlighted">{{ deletingItem?.name }}</span> 嗎？此操作無法復原。
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
