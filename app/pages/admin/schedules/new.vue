<script setup lang="ts">
const { api } = useApi()
const toast = useToast()
const router = useRouter()

const careRecipients = ref<any[]>([])

const weekdayLabels: Record<number, string> = {
  1: '週一', 2: '週二', 3: '週三', 4: '週四', 5: '週五', 6: '週六', 7: '週日'
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

onMounted(async () => {
  careRecipients.value = await api<any[]>('/api/dispatch/care-recipients')
})

watch(() => form.careRecipientId, (id) => {
  const cr = careRecipients.value.find(c => c.id === id)
  if (cr?.address) form.originAddress = cr.address
})

function toggleWeekday(day: number) {
  const idx = form.daysOfWeek.indexOf(day)
  if (idx >= 0) {
    form.daysOfWeek.splice(idx, 1)
  } else {
    form.daysOfWeek.push(day)
    form.daysOfWeek.sort((a, b) => a - b)
  }
}

async function save() {
  const body = {
    ...form,
    daysOfWeek: JSON.stringify(form.daysOfWeek),
    effectiveEndDate: form.effectiveEndDate || null,
  }
  try {
    await api('/api/dispatch/recurring-schedules', { method: 'POST', body })
    toast.add({ title: '排程已建立', color: 'success' })
    router.push('/admin/schedules')
  } catch (e: any) {
    toast.add({ title: e?.data?.statusMessage || '儲存失敗', color: 'error' })
  }
}
</script>

<template>
  <div class="max-w-2xl space-y-6">
    <div class="flex items-center gap-3">
      <NuxtLink to="/admin/schedules">
        <UButton icon="i-lucide-arrow-left" variant="ghost" size="sm" />
      </NuxtLink>
      <h1 class="text-xl font-bold">新增週期性排程</h1>
    </div>

    <div class="border border-default rounded-xl p-6 space-y-4">
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

      <!-- 星期幾 -->
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
      <UFormField label="生效結束日（留空＝永久）">
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
    </div>

    <div class="flex justify-end gap-2">
      <NuxtLink to="/admin/schedules">
        <UButton color="neutral" variant="outline">取消</UButton>
      </NuxtLink>
      <UButton color="primary" icon="i-lucide-save" @click="save">儲存排程</UButton>
    </div>
  </div>
</template>
