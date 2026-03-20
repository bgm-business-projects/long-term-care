<script setup lang="ts">
const toast = useToast()
const { api } = useApi()

const locations = ref<any[]>([])
const loading = ref(false)
const search = ref('')
const showModal = ref(false)
const showDeleteModal = ref(false)
const editingItem = ref<any>(null)
const deletingItem = ref<any>(null)
const saving = ref(false)

const categoryOptions = [
  { label: '醫院', value: 'hospital' },
  { label: '復健', value: 'rehab' },
  { label: '其他', value: 'other' },
]
const categoryLabelMap: Record<string, string> = { hospital: '醫院', rehab: '復健', other: '其他' }

const form = reactive({
  name: '',
  address: '',
  lat: '' as string | number,
  lng: '' as string | number,
  category: 'other',
})

const filteredLocations = computed(() => {
  if (!search.value) return locations.value
  const q = search.value.toLowerCase()
  return locations.value.filter(l => l.name?.toLowerCase().includes(q) || l.address?.toLowerCase().includes(q))
})

async function loadLocations() {
  loading.value = true
  try {
    locations.value = await api<any[]>('/api/dispatch/service-points?scope=org')
  } catch (err: any) {
    toast.add({ title: err?.data?.statusMessage || '載入失敗', color: 'error' })
  } finally {
    loading.value = false
  }
}
onMounted(loadLocations)

function openAdd() {
  editingItem.value = null
  form.name = ''; form.address = ''; form.lat = ''; form.lng = ''; form.category = 'other'
  showModal.value = true
}

function openEdit(l: any) {
  editingItem.value = l
  form.name = l.name; form.address = l.address
  form.lat = l.lat ?? ''; form.lng = l.lng ?? ''
  form.category = l.category || 'other'
  showModal.value = true
}

async function handleSave() {
  if (!form.name || !form.address) {
    toast.add({ title: '名稱與地址為必填', color: 'error' }); return
  }
  saving.value = true
  try {
    const body: any = {
      name: form.name, address: form.address, category: form.category,
      lat: form.lat !== '' ? Number(form.lat) : null,
      lng: form.lng !== '' ? Number(form.lng) : null,
    }
    if (editingItem.value) {
      await api(`/api/dispatch/service-points/${editingItem.value.id}`, { method: 'PUT', body })
      toast.add({ title: '據點已更新', color: 'success' })
    } else {
      // organizationId 由後端從 session 取得
      await api('/api/dispatch/service-points', { method: 'POST', body })
      toast.add({ title: '據點已新增', color: 'success' })
    }
    showModal.value = false
    await loadLocations()
  } catch (err: any) {
    toast.add({ title: err?.data?.statusMessage || '儲存失敗', color: 'error' })
  } finally {
    saving.value = false
  }
}

function openDelete(l: any) { deletingItem.value = l; showDeleteModal.value = true }

async function handleDelete() {
  if (!deletingItem.value) return
  try {
    await api(`/api/dispatch/service-points/${deletingItem.value.id}`, { method: 'DELETE' })
    toast.add({ title: '據點已刪除', color: 'success' })
    showDeleteModal.value = false
    await loadLocations()
  } catch (err: any) {
    toast.add({ title: err?.data?.statusMessage || '操作失敗', color: 'error' })
  }
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-lg font-semibold text-highlighted">機構據點管理</h2>
        <p class="text-xs text-muted mt-0.5">管理本機構常用的服務據點</p>
      </div>
      <UButton icon="i-lucide-plus" @click="openAdd">新增據點</UButton>
    </div>

    <UInput v-model="search" placeholder="搜尋名稱、地址..." icon="i-lucide-search" class="max-w-sm" />

    <div v-if="loading" class="flex justify-center py-12">
      <UIcon name="i-lucide-loader-2" class="text-2xl animate-spin text-muted" />
    </div>
    <div v-else-if="filteredLocations.length === 0" class="text-center py-12 text-muted">
      暫無據點資料
    </div>
    <div v-else class="overflow-x-auto rounded-lg border border-muted">
      <table class="w-full text-sm">
        <thead class="bg-muted/40">
          <tr>
            <th class="text-left px-4 py-3 font-medium text-muted">名稱</th>
            <th class="text-center px-4 py-3 font-medium text-muted">類別</th>
            <th class="text-left px-4 py-3 font-medium text-muted">地址</th>
            <th class="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-muted">
          <tr v-for="l in filteredLocations" :key="l.id" class="hover:bg-muted/20 transition-colors">
            <td class="px-4 py-3 font-medium text-highlighted">{{ l.name }}</td>
            <td class="px-4 py-3 text-center">
              <UBadge :color="l.category === 'hospital' ? 'primary' : l.category === 'rehab' ? 'info' : 'neutral'" variant="subtle">
                {{ categoryLabelMap[l.category] || '-' }}
              </UBadge>
            </td>
            <td class="px-4 py-3 max-w-xs truncate">{{ l.address || '-' }}</td>
            <td class="px-4 py-3">
              <div class="flex items-center justify-end gap-2">
                <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-edit" @click="openEdit(l)">編輯</UButton>
                <UButton size="xs" color="error" variant="ghost" icon="i-lucide-trash-2" @click="openDelete(l)">刪除</UButton>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <UModal v-model:open="showModal" :title="editingItem ? '編輯據點' : '新增據點'" description=" ">
      <template #content>
        <div class="p-6 space-y-4">
          <UFormField label="名稱 *">
            <UInput v-model="form.name" placeholder="據點名稱" class="w-full" />
          </UFormField>
          <UFormField label="地址 *">
            <UInput v-model="form.address" placeholder="完整地址" class="w-full" />
          </UFormField>
          <UFormField label="類別">
            <USelect v-model="form.category" :items="categoryOptions" value-key="value" class="w-full" />
          </UFormField>
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="緯度">
              <UInput v-model="form.lat" type="number" step="any" placeholder="選填" class="w-full" />
            </UFormField>
            <UFormField label="經度">
              <UInput v-model="form.lng" type="number" step="any" placeholder="選填" class="w-full" />
            </UFormField>
          </div>
          <div class="flex justify-end gap-2 pt-2">
            <UButton color="neutral" variant="outline" @click="showModal = false">取消</UButton>
            <UButton color="primary" :loading="saving" @click="handleSave">儲存</UButton>
          </div>
        </div>
      </template>
    </UModal>

    <UModal v-model:open="showDeleteModal" title="確認刪除" description=" ">
      <template #content>
        <div class="p-6 space-y-4">
          <p class="text-sm text-muted">確定要刪除據點 <span class="font-semibold text-highlighted">{{ deletingItem?.name }}</span> 嗎？</p>
          <div class="flex justify-end gap-2">
            <UButton color="neutral" variant="outline" @click="showDeleteModal = false">取消</UButton>
            <UButton color="error" @click="handleDelete">確認刪除</UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
