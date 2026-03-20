<script setup lang="ts">
const toast = useToast()
const { api } = useApi()

const organizations = ref<any[]>([])
const loading = ref(false)
const search = ref('')

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
    const res = await api<any[]>('/api/dispatch/organizations')
    organizations.value = res
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
      await api(`/api/dispatch/organizations/${editingItem.value.id}`, {
        method: 'PUT',
        body: { ...form },
      })
      toast.add({ title: '機構資料已更新', color: 'success' })
    } else {
      await api('/api/dispatch/organizations', {
        method: 'POST',
        body: { ...form },
      })
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

    <!-- Loading -->
    <div v-if="loading" class="flex justify-center py-12">
      <UIcon name="i-lucide-loader-2" class="text-2xl animate-spin text-muted" />
    </div>

    <!-- Empty -->
    <div v-else-if="filteredOrganizations.length === 0" class="text-center py-12 text-muted">
      暫無機構資料
    </div>

    <!-- Table -->
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
                <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-edit" @click="openEdit(o)">編輯</UButton>
                <UButton size="xs" color="error" variant="ghost" icon="i-lucide-trash-2" @click="openDelete(o)">刪除</UButton>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Add/Edit Modal -->
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

    <!-- Delete Confirm Modal -->
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
