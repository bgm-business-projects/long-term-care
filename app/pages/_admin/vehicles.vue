<script setup lang="ts">
const toast = useToast()
const { api } = useApi()

const vehicles = ref<any[]>([])
const loading = ref(false)
const search = ref('')

const showModal = ref(false)
const showDeleteModal = ref(false)
const editingItem = ref<any>(null)
const deletingItem = ref<any>(null)
const saving = ref(false)

const form = reactive({
  plate: '',
  vehicleType: '',
  seatCount: 4,
  hasWheelchairLift: false,
  wheelchairCapacity: 0,
  notes: '',
})

const filteredVehicles = computed(() => {
  if (!search.value) return vehicles.value
  const q = search.value.toLowerCase()
  return vehicles.value.filter(v =>
    v.plate?.toLowerCase().includes(q) ||
    v.vehicleType?.toLowerCase().includes(q)
  )
})

async function loadVehicles() {
  loading.value = true
  try {
    const res = await api<any[]>('/api/dispatch/vehicles')
    vehicles.value = res
  } catch (err: any) {
    toast.add({ title: err?.data?.statusMessage || '載入失敗', color: 'error' })
  } finally {
    loading.value = false
  }
}

onMounted(loadVehicles)

function openAdd() {
  editingItem.value = null
  form.plate = ''
  form.vehicleType = ''
  form.seatCount = 4
  form.hasWheelchairLift = false
  form.wheelchairCapacity = 0
  form.notes = ''
  showModal.value = true
}

function openEdit(v: any) {
  editingItem.value = v
  form.plate = v.plate
  form.vehicleType = v.vehicleType
  form.seatCount = v.seatCount
  form.hasWheelchairLift = v.hasWheelchairLift
  form.wheelchairCapacity = v.wheelchairCapacity
  form.notes = v.notes || ''
  showModal.value = true
}

async function handleSave() {
  if (!form.plate || !form.vehicleType) {
    toast.add({ title: '車牌與車型為必填', color: 'error' })
    return
  }
  saving.value = true
  try {
    if (editingItem.value) {
      await api(`/api/dispatch/vehicles/${editingItem.value.id}`, {
        method: 'PUT',
        body: { ...form },
      })
      toast.add({ title: '車輛資料已更新', color: 'success' })
    } else {
      await api('/api/dispatch/vehicles', {
        method: 'POST',
        body: { ...form },
      })
      toast.add({ title: '車輛已新增', color: 'success' })
    }
    showModal.value = false
    await loadVehicles()
  } catch (err: any) {
    toast.add({ title: err?.data?.statusMessage || '儲存失敗', color: 'error' })
  } finally {
    saving.value = false
  }
}

function openDelete(v: any) {
  deletingItem.value = v
  showDeleteModal.value = true
}

async function handleDelete() {
  if (!deletingItem.value) return
  try {
    await api(`/api/dispatch/vehicles/${deletingItem.value.id}`, { method: 'DELETE' })
    toast.add({ title: '車輛已停用', color: 'success' })
    showDeleteModal.value = false
    await loadVehicles()
  } catch (err: any) {
    toast.add({ title: err?.data?.statusMessage || '操作失敗', color: 'error' })
  }
}
</script>

<template>
  <div class="space-y-4">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <h2 class="text-lg font-semibold text-highlighted">車輛管理</h2>
      <UButton icon="i-lucide-plus" @click="openAdd">新增車輛</UButton>
    </div>

    <!-- Search -->
    <UInput v-model="search" placeholder="搜尋車牌、車型..." icon="i-lucide-search" class="max-w-sm" />

    <!-- Loading -->
    <div v-if="loading" class="flex justify-center py-12">
      <UIcon name="i-lucide-loader-2" class="text-2xl animate-spin text-muted" />
    </div>

    <!-- Empty -->
    <div v-else-if="filteredVehicles.length === 0" class="text-center py-12 text-muted">
      暫無車輛資料
    </div>

    <!-- Table -->
    <div v-else class="overflow-x-auto rounded-lg border border-muted">
      <table class="w-full text-sm">
        <thead class="bg-muted/40">
          <tr>
            <th class="text-left px-4 py-3 font-medium text-muted">車牌</th>
            <th class="text-left px-4 py-3 font-medium text-muted">車型</th>
            <th class="text-center px-4 py-3 font-medium text-muted">座位數</th>
            <th class="text-center px-4 py-3 font-medium text-muted">輪椅升降</th>
            <th class="text-center px-4 py-3 font-medium text-muted">可載輪椅數</th>
            <th class="text-center px-4 py-3 font-medium text-muted">狀態</th>
            <th class="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-muted">
          <tr v-for="v in filteredVehicles" :key="v.id" class="hover:bg-muted/20 transition-colors">
            <td class="px-4 py-3 font-medium text-highlighted">{{ v.plate }}</td>
            <td class="px-4 py-3">{{ v.vehicleType }}</td>
            <td class="px-4 py-3 text-center">{{ v.seatCount }}</td>
            <td class="px-4 py-3 text-center">
              <span v-if="v.hasWheelchairLift" class="text-success">✓</span>
              <span v-else class="text-muted">✗</span>
            </td>
            <td class="px-4 py-3 text-center">{{ v.wheelchairCapacity }}</td>
            <td class="px-4 py-3 text-center">
              <UBadge v-if="v.isActive !== false" color="success" variant="subtle">啟用</UBadge>
              <UBadge v-else color="neutral" variant="subtle">停用</UBadge>
            </td>
            <td class="px-4 py-3">
              <div class="flex items-center justify-end gap-2">
                <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-edit" @click="openEdit(v)">編輯</UButton>
                <UButton size="xs" color="error" variant="ghost" icon="i-lucide-ban" @click="openDelete(v)">停用</UButton>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Add/Edit Modal -->
    <UModal v-model:open="showModal" :title="editingItem ? '編輯車輛' : '新增車輛'" description=" ">
      <template #content>
        <div class="p-6 space-y-4">
          <UFormField label="車牌 *">
            <UInput v-model="form.plate" placeholder="例：ABC-1234" class="w-full" />
          </UFormField>
          <UFormField label="車型 *">
            <UInput v-model="form.vehicleType" placeholder="例：Toyota Hiace" class="w-full" />
          </UFormField>
          <UFormField label="座位數">
            <UInput v-model.number="form.seatCount" type="number" min="1" class="w-full" />
          </UFormField>
          <div class="flex items-center gap-3">
            <UCheckbox v-model="form.hasWheelchairLift" />
            <label class="text-sm font-medium">具輪椅升降設備</label>
          </div>
          <UFormField label="可載輪椅數">
            <UInput v-model.number="form.wheelchairCapacity" type="number" min="0" class="w-full" />
          </UFormField>
          <UFormField label="備註">
            <UInput v-model="form.notes" placeholder="選填" class="w-full" />
          </UFormField>
          <div class="flex justify-end gap-2 pt-2">
            <UButton color="neutral" variant="outline" @click="showModal = false">取消</UButton>
            <UButton color="primary" :loading="saving" @click="handleSave">儲存</UButton>
          </div>
        </div>
      </template>
    </UModal>

    <!-- Delete Confirm Modal -->
    <UModal v-model:open="showDeleteModal" title="確認停用" description=" ">
      <template #content>
        <div class="p-6 space-y-4">
          <p class="text-sm text-muted">
            確定要停用車輛 <span class="font-semibold text-highlighted">{{ deletingItem?.plate }}</span> 嗎？
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
