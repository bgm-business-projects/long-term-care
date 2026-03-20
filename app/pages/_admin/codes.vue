<script setup lang="ts">
const { t } = useI18n()
const toast = useToast()
const { api } = useApi()

// Filters
const filterStatus = ref('all')
const filterTier = ref('')
const page = ref(1)
const pageSize = 20

// Data
const codes = ref<any[]>([])
const total = ref(0)
const loading = ref(false)

// Create modal
const showCreateModal = ref(false)
const createForm = reactive({
  tier: 'pro' as string,
  durationDays: null as number | null,
  isPermanent: false,
})

// Batch modal
const showBatchModal = ref(false)
const batchForm = reactive({
  tier: 'pro' as string,
  durationDays: null as number | null,
  isPermanent: false,
  count: 10,
})

const filterTabs = computed(() => [
  { label: t('admin.filter.all'), value: 'all' },
  { label: t('admin.filter.unused'), value: 'unused' },
  { label: t('admin.filter.used'), value: 'used' },
  { label: t('admin.filter.disabled'), value: 'disabled' },
])

function onFilterChange(value: string | number) {
  filterStatus.value = String(value) || 'all'
  page.value = 1
}

async function loadCodes() {
  loading.value = true
  try {
    const params: Record<string, string> = {
      page: String(page.value),
      pageSize: String(pageSize),
      status: filterStatus.value,
    }
    if (filterTier.value) params.tier = filterTier.value
    const data = await api<any>('/api/admin/codes', { params })
    codes.value = data.items
    total.value = data.total
  } finally {
    loading.value = false
  }
}

onMounted(loadCodes)
watch([filterStatus, filterTier, page], loadCodes)

function getCodeStatus(code: any) {
  if (code.disabled) return { label: t('admin.status.disabled'), color: 'error' as const }
  if (code.usedById) return { label: t('admin.status.used'), color: 'neutral' as const }
  return { label: t('admin.status.active'), color: 'success' as const }
}

function formatDuration(code: any) {
  if (code.durationDays === null) return t('admin.permanent')
  return t('admin.days', { n: code.durationDays })
}

async function handleCreate() {
  try {
    await api('/api/admin/codes', {
      method: 'POST',
      body: {
        tier: createForm.tier,
        durationDays: createForm.isPermanent ? null : createForm.durationDays,
      },
    })
    toast.add({ title: t('admin.toast.created'), color: 'success', icon: 'i-lucide-plus' })
    showCreateModal.value = false
    await loadCodes()
  } catch {
    toast.add({ title: t('auth.error.generic'), color: 'error' })
  }
}

async function handleBatchCreate() {
  try {
    await api('/api/admin/codes/batch', {
      method: 'POST',
      body: {
        tier: batchForm.tier,
        durationDays: batchForm.isPermanent ? null : batchForm.durationDays,
        count: batchForm.count,
      },
    })
    toast.add({ title: t('admin.toast.batchCreated', { n: batchForm.count }), color: 'success', icon: 'i-lucide-layers' })
    showBatchModal.value = false
    await loadCodes()
  } catch {
    toast.add({ title: t('auth.error.generic'), color: 'error' })
  }
}

async function toggleDisabled(code: any) {
  const newDisabled = !code.disabled
  try {
    await api(`/api/admin/codes/${code.id}`, {
      method: 'PATCH',
      body: { disabled: newDisabled },
    })
    toast.add({
      title: newDisabled ? t('admin.toast.disabled') : t('admin.toast.enabled'),
      color: 'success',
      icon: newDisabled ? 'i-lucide-ban' : 'i-lucide-check',
    })
    await loadCodes()
  } catch {
    toast.add({ title: t('auth.error.generic'), color: 'error' })
  }
}

async function deleteCode(code: any) {
  if (!window.confirm(t('admin.confirmDelete'))) return
  try {
    await api(`/api/admin/codes/${code.id}`, { method: 'DELETE' })
    toast.add({ title: t('admin.toast.deleted'), color: 'success', icon: 'i-lucide-trash-2' })
    await loadCodes()
  } catch (err: any) {
    const status = err?.response?.status || err?.statusCode
    if (status === 404) {
      toast.add({ title: t('admin.error.codeNotFound'), color: 'error' })
    } else if (status === 409) {
      toast.add({ title: t('admin.error.codeAlreadyUsed'), color: 'error' })
    } else {
      toast.add({ title: t('auth.error.generic'), color: 'error' })
    }
  }
}

async function copyCode(code: string) {
  await navigator.clipboard.writeText(code)
  toast.add({ title: t('admin.toast.copied'), color: 'success', icon: 'i-lucide-clipboard-check' })
}

const totalPages = computed(() => Math.ceil(total.value / pageSize))
const showingFrom = computed(() => (page.value - 1) * pageSize + 1)
const showingTo = computed(() => Math.min(page.value * pageSize, total.value))

const tierOptions = [
  { label: 'Pro', value: 'pro' },
  { label: 'Premium', value: 'premium' },
  { label: 'Partner', value: 'partner' },
]
</script>

<template>
  <div class="space-y-6">
    <!-- Action bar -->
    <div class="flex items-center gap-2">
      <UButton
        :label="t('admin.createCode')"
        icon="i-lucide-plus"
        color="primary"
        size="sm"
        @click="showCreateModal = true"
      />
      <UButton
        :label="t('admin.batchCreate')"
        icon="i-lucide-layers"
        color="neutral"
        variant="outline"
        size="sm"
        @click="showBatchModal = true"
      />
    </div>

    <!-- Filters -->
    <UTabs
      :items="filterTabs"
      :model-value="filterStatus"
      @update:model-value="onFilterChange($event)"
      variant="link"
    />

    <!-- Code list -->
    <div v-if="loading" class="text-center py-12 text-muted">
      <UIcon name="i-lucide-loader-2" class="text-2xl animate-spin" />
    </div>

    <div v-else-if="codes.length === 0" class="text-center py-12 text-muted">
      {{ t('admin.empty') }}
    </div>

    <div v-else class="space-y-2">
      <div
        v-for="code in codes"
        :key="code.id"
        class="p-3 border border-muted rounded-lg space-y-2"
      >
        <!-- Row 1: Code + badges + actions -->
        <div class="flex items-center gap-2">
          <code class="text-sm font-mono font-semibold text-default">{{ code.code }}</code>
          <UBadge :label="code.tier.toUpperCase()" :color="code.tier === 'premium' ? 'warning' : 'primary'" size="xs" />
          <UBadge :label="getCodeStatus(code).label" :color="getCodeStatus(code).color" variant="subtle" size="xs" />
          <div class="flex items-center gap-1 ml-auto shrink-0">
            <UButton
              icon="i-lucide-clipboard-copy"
              color="neutral"
              variant="ghost"
              size="xs"
              :title="t('admin.actions.copy')"
              @click="copyCode(code.code)"
            />
            <UButton
              v-if="!code.usedById"
              :icon="code.disabled ? 'i-lucide-check-circle' : 'i-lucide-ban'"
              :color="code.disabled ? 'success' : 'error'"
              variant="ghost"
              size="xs"
              :title="code.disabled ? t('admin.actions.enable') : t('admin.actions.disable')"
              @click="toggleDisabled(code)"
            />
            <UButton
              v-if="!code.usedById"
              icon="i-lucide-trash-2"
              color="error"
              variant="ghost"
              size="xs"
              :title="t('admin.actions.delete')"
              @click="deleteCode(code)"
            />
          </div>
        </div>

        <!-- Row 2: Metadata -->
        <div class="flex items-center gap-x-4 gap-y-1 text-xs text-muted flex-wrap">
          <span class="inline-flex items-center gap-1" :title="t('admin.table.duration')">
            <UIcon name="i-lucide-clock" class="text-[11px]" />
            {{ formatDuration(code) }}
          </span>
          <span class="inline-flex items-center gap-1" :title="t('admin.table.createdAt')">
            <UIcon name="i-lucide-calendar" class="text-[11px]" />
            {{ new Date(code.createdAt).toLocaleDateString() }}
          </span>
          <template v-if="code.usedById">
            <span class="inline-flex items-center gap-1" :title="t('admin.table.usedBy')">
              <UIcon name="i-lucide-user-check" class="text-[11px]" />
              {{ code.usedByName || code.usedByEmail || code.usedById }}
            </span>
            <span v-if="code.usedAt" class="inline-flex items-center gap-1" :title="t('admin.table.usedAt')">
              <UIcon name="i-lucide-calendar-check" class="text-[11px]" />
              {{ new Date(code.usedAt).toLocaleDateString() }}
            </span>
          </template>
        </div>
      </div>
    </div>

    <!-- Pagination -->
    <div v-if="total > pageSize" class="flex items-center justify-between text-sm text-muted">
      <span>{{ t('admin.pagination.showing', { from: showingFrom, to: showingTo, total }) }}</span>
      <div class="flex gap-1">
        <UButton
          icon="i-lucide-chevron-left"
          color="neutral"
          variant="ghost"
          size="xs"
          :disabled="page <= 1"
          @click="page--"
        />
        <UButton
          icon="i-lucide-chevron-right"
          color="neutral"
          variant="ghost"
          size="xs"
          :disabled="page >= totalPages"
          @click="page++"
        />
      </div>
    </div>

    <!-- Create Code Modal -->
    <UModal v-model:open="showCreateModal" :title="t('admin.createCode')">
      <template #body>
        <div class="space-y-4 p-4">
          <UFormField :label="t('admin.form.tier')">
            <USelect v-model="createForm.tier" :items="tierOptions" value-key="value" class="w-full" />
          </UFormField>
          <div class="flex items-center gap-3">
            <label class="flex items-center gap-2 text-sm cursor-pointer">
              <input v-model="createForm.isPermanent" type="checkbox" class="rounded border-gray-300 text-primary" />
              {{ t('admin.form.durationPermanent') }}
            </label>
          </div>
          <UFormField v-if="!createForm.isPermanent" :label="t('admin.form.durationDays')">
            <UInput v-model.number="createForm.durationDays" type="number" :min="1" class="w-full" />
          </UFormField>
          <div class="flex justify-end gap-2">
            <UButton label="Cancel" color="neutral" variant="outline" @click="showCreateModal = false" />
            <UButton :label="t('admin.createCode')" color="primary" @click="handleCreate" />
          </div>
        </div>
      </template>
    </UModal>

    <!-- Batch Create Modal -->
    <UModal v-model:open="showBatchModal" :title="t('admin.batchCreate')">
      <template #body>
        <div class="space-y-4 p-4">
          <UFormField :label="t('admin.form.tier')">
            <USelect v-model="batchForm.tier" :items="tierOptions" value-key="value" class="w-full" />
          </UFormField>
          <div class="flex items-center gap-3">
            <label class="flex items-center gap-2 text-sm cursor-pointer">
              <input v-model="batchForm.isPermanent" type="checkbox" class="rounded border-gray-300 text-primary" />
              {{ t('admin.form.durationPermanent') }}
            </label>
          </div>
          <UFormField v-if="!batchForm.isPermanent" :label="t('admin.form.durationDays')">
            <UInput v-model.number="batchForm.durationDays" type="number" :min="1" class="w-full" />
          </UFormField>
          <UFormField :label="t('admin.form.count')">
            <UInput v-model.number="batchForm.count" type="number" :min="1" :max="100" class="w-full" />
          </UFormField>
          <div class="flex justify-end gap-2">
            <UButton label="Cancel" color="neutral" variant="outline" @click="showBatchModal = false" />
            <UButton :label="t('admin.batchCreate')" color="primary" @click="handleBatchCreate" />
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
