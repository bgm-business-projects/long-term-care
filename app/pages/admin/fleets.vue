<script setup lang="ts">
definePageMeta({ layout: 'admin-panel' })

const toast = useToast()
const { api } = useApi()

interface Fleet {
  id: string
  name: string
  contactPerson: string | null
  phone: string | null
  address: string | null
  taxId: string | null
  notes: string | null
  isActive: boolean
  createdAt: string | Date
}

const fleets = ref<Fleet[]>([])
const loading = ref(false)
const search = ref('')

const showModal = ref(false)
const showDeleteModal = ref(false)
const editing = ref<Fleet | null>(null)
const deleting = ref<Fleet | null>(null)
const saving = ref(false)

const form = reactive({
  name: '',
  contactPerson: '',
  phone: '',
  address: '',
  taxId: '',
  notes: '',
})

const filteredFleets = computed(() => {
  if (!search.value) return fleets.value
  const q = search.value.toLowerCase()
  return fleets.value.filter(f =>
    f.name.toLowerCase().includes(q)
    || (f.contactPerson || '').toLowerCase().includes(q)
    || (f.phone || '').toLowerCase().includes(q),
  )
})

async function load() {
  loading.value = true
  try {
    fleets.value = await api<Fleet[]>('/api/admin/fleets')
  } catch (err: any) {
    toast.add({ title: err?.data?.statusMessage || '載入失敗', color: 'error' })
  } finally {
    loading.value = false
  }
}

function resetForm() {
  form.name = ''
  form.contactPerson = ''
  form.phone = ''
  form.address = ''
  form.taxId = ''
  form.notes = ''
}

function openAdd() {
  editing.value = null
  resetForm()
  showModal.value = true
}

function openEdit(f: Fleet) {
  editing.value = f
  form.name = f.name
  form.contactPerson = f.contactPerson || ''
  form.phone = f.phone || ''
  form.address = f.address || ''
  form.taxId = f.taxId || ''
  form.notes = f.notes || ''
  showModal.value = true
}

async function handleSave() {
  if (!form.name.trim()) {
    toast.add({ title: '車行名稱為必填', color: 'error' })
    return
  }
  saving.value = true
  try {
    const body = {
      name: form.name.trim(),
      contactPerson: form.contactPerson.trim() || null,
      phone: form.phone.trim() || null,
      address: form.address.trim() || null,
      taxId: form.taxId.trim() || null,
      notes: form.notes.trim() || null,
    }
    if (editing.value) {
      await api(`/api/admin/fleets/${editing.value.id}`, { method: 'PUT', body })
      toast.add({ title: '已更新', color: 'success' })
    } else {
      await api('/api/admin/fleets', { method: 'POST', body })
      toast.add({ title: '已新增', color: 'success' })
    }
    showModal.value = false
    await load()
  } catch (err: any) {
    toast.add({ title: err?.data?.statusMessage || '儲存失敗', color: 'error' })
  } finally {
    saving.value = false
  }
}

function openDelete(f: Fleet) {
  deleting.value = f
  showDeleteModal.value = true
}

async function handleDelete() {
  if (!deleting.value) return
  try {
    await api(`/api/admin/fleets/${deleting.value.id}`, { method: 'DELETE' })
    toast.add({ title: '已停用', color: 'success' })
    showDeleteModal.value = false
    await load()
  } catch (err: any) {
    toast.add({ title: err?.data?.statusMessage || '操作失敗', color: 'error' })
  }
}

async function reactivate(f: Fleet) {
  try {
    await api(`/api/admin/fleets/${f.id}`, { method: 'PUT', body: { isActive: true } })
    toast.add({ title: '已啟用', color: 'success' })
    await load()
  } catch (err: any) {
    toast.add({ title: err?.data?.statusMessage || '操作失敗', color: 'error' })
  }
}

onMounted(load)
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h2 class="text-lg font-semibold text-highlighted">車行管理</h2>
      <UButton icon="i-lucide-plus" @click="openAdd">新增車行</UButton>
    </div>

    <UInput v-model="search" placeholder="搜尋名稱、聯絡人、電話..." icon="i-lucide-search" class="max-w-sm" />

    <div v-if="loading" class="flex justify-center py-12">
      <UIcon name="i-lucide-loader-2" class="text-2xl animate-spin text-muted" />
    </div>

    <div v-else-if="filteredFleets.length === 0" class="text-center py-12 text-muted">
      暫無車行資料
    </div>

    <div v-else class="overflow-x-auto rounded-lg border border-muted">
      <table class="w-full text-sm">
        <thead class="bg-muted/40">
          <tr>
            <th class="text-left px-4 py-3 font-medium text-muted">車行名稱</th>
            <th class="text-left px-4 py-3 font-medium text-muted">聯絡人</th>
            <th class="text-left px-4 py-3 font-medium text-muted">電話</th>
            <th class="text-left px-4 py-3 font-medium text-muted">統編</th>
            <th class="text-center px-4 py-3 font-medium text-muted">狀態</th>
            <th class="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-muted">
          <tr v-for="f in filteredFleets" :key="f.id" class="hover:bg-muted/20 transition-colors">
            <td class="px-4 py-3 font-medium text-highlighted">{{ f.name }}</td>
            <td class="px-4 py-3">{{ f.contactPerson || '-' }}</td>
            <td class="px-4 py-3">{{ f.phone || '-' }}</td>
            <td class="px-4 py-3">{{ f.taxId || '-' }}</td>
            <td class="px-4 py-3 text-center">
              <UBadge v-if="f.isActive" color="success" variant="subtle">啟用</UBadge>
              <UBadge v-else color="neutral" variant="subtle">停用</UBadge>
            </td>
            <td class="px-4 py-3">
              <div class="flex items-center justify-end gap-2">
                <UButton size="xs" color="primary" variant="ghost" icon="i-lucide-users" :to="`/admin/drivers?fleetId=${f.id}`">司機管理</UButton>
                <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-edit" @click="openEdit(f)">編輯</UButton>
                <UButton v-if="f.isActive" size="xs" color="error" variant="ghost" icon="i-lucide-ban" @click="openDelete(f)">停用</UButton>
                <UButton v-else size="xs" color="success" variant="ghost" icon="i-lucide-check" @click="reactivate(f)">啟用</UButton>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <UModal v-model:open="showModal" :title="editing ? '編輯車行' : '新增車行'" description=" ">
      <template #content>
        <div class="p-6 space-y-4">
          <UFormField label="車行名稱 *">
            <UInput v-model="form.name" class="w-full" />
          </UFormField>
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="聯絡人">
              <UInput v-model="form.contactPerson" class="w-full" />
            </UFormField>
            <UFormField label="電話">
              <UInput v-model="form.phone" class="w-full" />
            </UFormField>
          </div>
          <UFormField label="地址">
            <UInput v-model="form.address" class="w-full" />
          </UFormField>
          <UFormField label="統一編號">
            <UInput v-model="form.taxId" class="w-full" />
          </UFormField>
          <UFormField label="備註">
            <UTextarea v-model="form.notes" :rows="2" class="w-full" />
          </UFormField>
          <div class="flex justify-end gap-2 pt-2">
            <UButton color="neutral" variant="outline" @click="showModal = false">取消</UButton>
            <UButton color="primary" :loading="saving" @click="handleSave">{{ editing ? '儲存' : '新增' }}</UButton>
          </div>
        </div>
      </template>
    </UModal>

    <UModal v-model:open="showDeleteModal" title="停用車行" description=" ">
      <template #content>
        <div class="p-6 space-y-4">
          <p class="text-sm">確定要停用車行 <b>{{ deleting?.name }}</b>？</p>
          <p class="text-xs text-muted">停用後司機將無法選擇此車行，但既有歸屬司機資料保留。</p>
          <div class="flex justify-end gap-2">
            <UButton color="neutral" variant="outline" @click="showDeleteModal = false">取消</UButton>
            <UButton color="error" @click="handleDelete">確認停用</UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
