<script setup lang="ts">
definePageMeta({ layout: 'agency-panel' })

const toast = useToast()
const { api } = useApi()

interface Device {
  id: string
  name: string
  description: string | null
  organizationId: string | null
  isActive: boolean
}

const devices = ref<Device[]>([])
const loading = ref(false)
const search = ref('')

const showModal = ref(false)
const showDeleteModal = ref(false)
const editing = ref<Device | null>(null)
const deleting = ref<Device | null>(null)
const saving = ref(false)

const form = reactive({ name: '', description: '' })

const filtered = computed(() => {
  if (!search.value) return devices.value
  const q = search.value.toLowerCase()
  return devices.value.filter(d =>
    d.name.toLowerCase().includes(q) || (d.description || '').toLowerCase().includes(q),
  )
})

async function load() {
  loading.value = true
  try {
    devices.value = await api<Device[]>('/api/dispatch/devices')
  } catch (err: any) {
    toast.add({ title: err?.data?.statusMessage || '載入失敗', color: 'error' })
  } finally {
    loading.value = false
  }
}

function openAdd() {
  editing.value = null
  form.name = ''
  form.description = ''
  showModal.value = true
}

function openEdit(d: Device) {
  editing.value = d
  form.name = d.name
  form.description = d.description || ''
  showModal.value = true
}

async function handleSave() {
  if (!form.name.trim()) {
    toast.add({ title: '名稱為必填', color: 'error' })
    return
  }
  saving.value = true
  try {
    const body = { name: form.name.trim(), description: form.description.trim() || null }
    if (editing.value) {
      await api(`/api/dispatch/devices/${editing.value.id}`, { method: 'PUT', body })
      toast.add({ title: '已更新', color: 'success' })
    } else {
      await api('/api/dispatch/devices', { method: 'POST', body })
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

function openDelete(d: Device) {
  deleting.value = d
  showDeleteModal.value = true
}

async function handleDelete() {
  if (!deleting.value) return
  try {
    await api(`/api/dispatch/devices/${deleting.value.id}`, { method: 'DELETE' })
    toast.add({ title: '已停用', color: 'success' })
    showDeleteModal.value = false
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
      <h2 class="text-lg font-semibold text-highlighted">輔具管理</h2>
      <UButton icon="i-lucide-plus" @click="openAdd">新增輔具</UButton>
    </div>

    <UInput v-model="search" placeholder="搜尋名稱或說明..." icon="i-lucide-search" class="max-w-sm" />

    <div v-if="loading" class="flex justify-center py-12">
      <UIcon name="i-lucide-loader-2" class="text-2xl animate-spin text-muted" />
    </div>

    <div v-else-if="filtered.length === 0" class="text-center py-12 text-muted">
      暫無輔具資料
    </div>

    <div v-else class="overflow-x-auto rounded-lg border border-muted">
      <table class="w-full text-sm">
        <thead class="bg-muted/40">
          <tr>
            <th class="text-left px-4 py-3 font-medium text-muted">名稱</th>
            <th class="text-left px-4 py-3 font-medium text-muted">說明</th>
            <th class="text-center px-4 py-3 font-medium text-muted">範圍</th>
            <th class="text-center px-4 py-3 font-medium text-muted">狀態</th>
            <th class="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-muted">
          <tr v-for="d in filtered" :key="d.id" class="hover:bg-muted/20 transition-colors">
            <td class="px-4 py-3 font-medium text-highlighted">{{ d.name }}</td>
            <td class="px-4 py-3 text-muted">{{ d.description || '-' }}</td>
            <td class="px-4 py-3 text-center">
              <UBadge v-if="d.organizationId" color="primary" variant="subtle">機構自訂</UBadge>
              <UBadge v-else color="info" variant="subtle">平台共用</UBadge>
            </td>
            <td class="px-4 py-3 text-center">
              <UBadge v-if="d.isActive" color="success" variant="subtle">啟用</UBadge>
              <UBadge v-else color="neutral" variant="subtle">停用</UBadge>
            </td>
            <td class="px-4 py-3">
              <div class="flex items-center justify-end gap-2">
                <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-edit" @click="openEdit(d)">編輯</UButton>
                <UButton v-if="d.isActive" size="xs" color="error" variant="ghost" icon="i-lucide-ban" @click="openDelete(d)">停用</UButton>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <UModal v-model:open="showModal" :title="editing ? '編輯輔具' : '新增輔具'" description=" ">
      <template #content>
        <div class="p-6 space-y-4">
          <UFormField label="名稱 *">
            <UInput v-model="form.name" placeholder="例：輪椅、擔架、氧氣瓶" class="w-full" />
          </UFormField>
          <UFormField label="說明">
            <UTextarea v-model="form.description" placeholder="選填" :rows="2" class="w-full" />
          </UFormField>
          <div class="flex justify-end gap-2 pt-2">
            <UButton color="neutral" variant="outline" @click="showModal = false">取消</UButton>
            <UButton color="primary" :loading="saving" @click="handleSave">{{ editing ? '儲存' : '新增' }}</UButton>
          </div>
        </div>
      </template>
    </UModal>

    <UModal v-model:open="showDeleteModal" title="停用輔具" description=" ">
      <template #content>
        <div class="p-6 space-y-4">
          <p class="text-sm">確定要停用 <b>{{ deleting?.name }}</b>？</p>
          <p class="text-xs text-muted">停用後將不再出現於選單，但既有訂單記錄保留。</p>
          <div class="flex justify-end gap-2">
            <UButton color="neutral" variant="outline" @click="showDeleteModal = false">取消</UButton>
            <UButton color="error" @click="handleDelete">確認停用</UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
