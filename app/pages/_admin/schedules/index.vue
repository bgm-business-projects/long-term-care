<script setup lang="ts">
const { api } = useApi()
const toast = useToast()

const schedules = ref<any[]>([])
const careRecipients = ref<any[]>([])
const loading = ref(false)
const showModal = ref(false)
const editingId = ref<number | null>(null)

const weekdayLabels: Record<number, string> = {
  1: '週一', 2: '週二', 3: '週三', 4: '週四', 5: '週五', 6: '週六', 7: '週日'
}

function formatWeekdays(json: string): string {
  try {
    return JSON.parse(json).map((d: number) => weekdayLabels[d]).join('、')
  } catch {
    return json
  }
}

const form = reactive({
  careRecipientId: '' as any,
  daysOfWeek: [] as number[],
  departureTime: '',
  originAddress: '',
  destinationAddress: '',
  estimatedDuration: null as number | null,
  effectiveStartDate: '',
  effectiveEndDate: '',
  notes: '',
  isActive: true,
})

const careRecipientOptions = computed(() =>
  careRecipients.value.map(c => ({ label: c.name, value: c.id }))
)

async function load() {
  loading.value = true
  try {
    const [s, c] = await Promise.all([
      api<any[]>('/api/dispatch/recurring-schedules'),
      api<any[]>('/api/dispatch/care-recipients'),
    ])
    schedules.value = s
    careRecipients.value = c
  } finally {
    loading.value = false
  }
}

onMounted(load)

function openCreate() {
  editingId.value = null
  Object.assign(form, {
    careRecipientId: '',
    daysOfWeek: [],
    departureTime: '',
    originAddress: '',
    destinationAddress: '',
    estimatedDuration: null,
    effectiveStartDate: '',
    effectiveEndDate: '',
    notes: '',
    isActive: true,
  })
  showModal.value = true
}

function openEdit(s: any) {
  editingId.value = s.id
  Object.assign(form, {
    careRecipientId: s.careRecipientId,
    daysOfWeek: typeof s.daysOfWeek === 'string' ? JSON.parse(s.daysOfWeek) : s.daysOfWeek,
    departureTime: s.departureTime,
    originAddress: s.originAddress || '',
    destinationAddress: s.destinationAddress || '',
    estimatedDuration: s.estimatedDuration ?? null,
    effectiveStartDate: s.effectiveStartDate || '',
    effectiveEndDate: s.effectiveEndDate || '',
    notes: s.notes || '',
    isActive: s.isActive ?? true,
  })
  showModal.value = true
}

// 當選擇案主時，預填起點地址
watch(() => form.careRecipientId, (id) => {
  if (!editingId.value) {
    const cr = careRecipients.value.find(c => c.id === id)
    if (cr?.address) form.originAddress = cr.address
  }
})

async function save() {
  const body = {
    ...form,
    daysOfWeek: JSON.stringify(form.daysOfWeek),
    effectiveEndDate: form.effectiveEndDate || null,
  }
  try {
    if (editingId.value) {
      await api(`/api/dispatch/recurring-schedules/${editingId.value}`, { method: 'PUT', body })
      toast.add({ title: '排程已更新', color: 'success' })
    } else {
      await api('/api/dispatch/recurring-schedules', { method: 'POST', body })
      toast.add({ title: '排程已建立', color: 'success' })
    }
    showModal.value = false
    await load()
  } catch (e: any) {
    toast.add({ title: e?.data?.statusMessage || '儲存失敗', color: 'error' })
  }
}

async function remove(id: number) {
  if (!confirm('確定要刪除此排程？')) return
  try {
    await api(`/api/dispatch/recurring-schedules/${id}`, { method: 'DELETE' })
    toast.add({ title: '排程已刪除', color: 'success' })
    await load()
  } catch {
    toast.add({ title: '刪除失敗', color: 'error' })
  }
}

function toggleWeekday(day: number) {
  const idx = form.daysOfWeek.indexOf(day)
  if (idx >= 0) {
    form.daysOfWeek.splice(idx, 1)
  } else {
    form.daysOfWeek.push(day)
    form.daysOfWeek.sort((a, b) => a - b)
  }
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-xl font-bold">週期性排程</h1>
      <UButton icon="i-lucide-plus" @click="openCreate">新增排程</UButton>
    </div>

    <div v-if="loading" class="text-center py-12 text-muted">
      <UIcon name="i-lucide-loader-2" class="text-2xl animate-spin" />
    </div>

    <div v-else class="overflow-x-auto border border-default rounded-xl">
      <table class="w-full text-sm">
        <thead class="bg-default/50 border-b border-default">
          <tr>
            <th class="px-3 py-2 text-left">案主姓名</th>
            <th class="px-3 py-2 text-left">星期幾</th>
            <th class="px-3 py-2 text-left">出發時間</th>
            <th class="px-3 py-2 text-left">生效起始日</th>
            <th class="px-3 py-2 text-center">啟用</th>
            <th class="px-3 py-2 text-center">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="s in schedules" :key="s.id" class="border-b border-default/50 hover:bg-default/30">
            <td class="px-3 py-2">{{ s.careRecipientName || '—' }}</td>
            <td class="px-3 py-2">{{ formatWeekdays(s.daysOfWeek) }}</td>
            <td class="px-3 py-2">{{ s.departureTime }}</td>
            <td class="px-3 py-2">{{ s.effectiveStartDate || '—' }}</td>
            <td class="px-3 py-2 text-center">
              <UBadge :label="s.isActive ? '啟用' : '停用'" :color="s.isActive ? 'success' : 'neutral'" />
            </td>
            <td class="px-3 py-2 text-center">
              <div class="flex items-center justify-center gap-2">
                <UButton size="xs" icon="i-lucide-pencil" variant="ghost" @click="openEdit(s)" />
                <UButton size="xs" icon="i-lucide-trash-2" variant="ghost" color="error" @click="remove(s.id)" />
              </div>
            </td>
          </tr>
          <tr v-if="schedules.length === 0">
            <td colspan="6" class="px-3 py-8 text-center text-muted">目前沒有排程資料</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 新增/編輯 Modal -->
    <UModal v-model:open="showModal" :title="editingId ? '編輯排程' : '新增排程'" description=" " size="lg">
      <template #body>
        <div class="p-4 space-y-4">
          <!-- 案主 -->
          <UFormField label="案主">
            <USelect
              v-model="form.careRecipientId"
              :items="careRecipientOptions"
              value-key="value"
              placeholder="選擇案主"
              class="w-full"
            />
          </UFormField>

          <!-- 星期幾（多選） -->
          <UFormField label="星期幾">
            <div class="flex flex-wrap gap-3">
              <label
                v-for="day in [1,2,3,4,5,6,7]"
                :key="day"
                class="flex items-center gap-1.5 cursor-pointer"
              >
                <input
                  type="checkbox"
                  :checked="form.daysOfWeek.includes(day)"
                  @change="toggleWeekday(day)"
                  class="rounded border-gray-300 text-primary"
                />
                <span class="text-sm">{{ weekdayLabels[day] }}</span>
              </label>
            </div>
          </UFormField>

          <!-- 出發時間 -->
          <UFormField label="出發時間">
            <input
              type="time"
              v-model="form.departureTime"
              class="border border-default rounded px-3 py-1.5 text-sm w-full"
            />
          </UFormField>

          <!-- 起點地址 -->
          <UFormField label="起點地址">
            <UInput v-model="form.originAddress" placeholder="起點地址" class="w-full" />
          </UFormField>

          <!-- 終點地址 -->
          <UFormField label="終點地址">
            <UInput v-model="form.destinationAddress" placeholder="終點地址或服務據點" class="w-full" />
          </UFormField>

          <!-- 預估行程時間 -->
          <UFormField label="預估行程時間（分鐘）">
            <UInput
              v-model.number="form.estimatedDuration"
              type="number"
              placeholder="例：30"
              class="w-full"
            />
          </UFormField>

          <!-- 生效起始日 -->
          <UFormField label="生效起始日">
            <input
              type="date"
              v-model="form.effectiveStartDate"
              class="border border-default rounded px-3 py-1.5 text-sm w-full"
            />
          </UFormField>

          <!-- 生效結束日 -->
          <UFormField label="生效結束日（留空=永久）">
            <input
              type="date"
              v-model="form.effectiveEndDate"
              class="border border-default rounded px-3 py-1.5 text-sm w-full"
            />
          </UFormField>

          <!-- 備註 -->
          <UFormField label="備註">
            <UTextarea v-model="form.notes" placeholder="備註說明" class="w-full" />
          </UFormField>

          <!-- 啟用狀態 -->
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" v-model="form.isActive" class="rounded border-gray-300 text-primary" />
            <span class="text-sm">啟用排程</span>
          </label>

          <div class="flex justify-end gap-2 pt-2">
            <UButton color="neutral" variant="outline" @click="showModal = false">取消</UButton>
            <UButton color="primary" @click="save">儲存</UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
