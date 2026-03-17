<script setup lang="ts">
const { t } = useI18n()
const toast = useToast()
const { api } = useApi()
const { canChangeRole } = usePermissions()

// Filters
const search = ref('')
const filterRole = ref('')
const filterTier = ref('all')
const filterGuestConvert = ref('all')
const page = ref(1)
const pageSize = 20

// Data
const users = ref<any[]>([])
const total = ref(0)
const loading = ref(false)

// Modals
const showDetailModal = ref(false)
const showSubscriptionModal = ref(false)
const showDeleteModal = ref(false)
const showRoleModal = ref(false)
const selectedUser = ref<any>(null)
const userDetail = ref<any>(null)
const detailLoading = ref(false)

// Role edit form
const roleForm = reactive({
  role: 'user' as string,
})

// Subscription edit form
const subscriptionForm = reactive({
  tier: 'free' as string,
  expiresAt: '' as string,
  isPermanent: true,
})

// Delete confirmation
const deleteConfirmText = ref('')

const roleTabs = computed(() => [
  { label: t('adminUsers.filter.all'), value: '' },
  { label: t('adminUsers.filter.developer'), value: 'developer' },
  { label: t('adminUsers.filter.admin'), value: 'admin' },
  { label: t('adminUsers.filter.user'), value: 'user' },
])

const roleEditOptions = [
  { label: 'Developer', value: 'developer' },
  { label: 'Admin', value: 'admin' },
  { label: 'User', value: 'user' },
]

function onRoleFilterChange(value: string | number) {
  filterRole.value = String(value)
  page.value = 1
}

const tierFilterOptions = [
  { label: t('adminUsers.filter.allTiers'), value: 'all' },
  { label: 'Free', value: 'free' },
  { label: 'Pro', value: 'pro' },
  { label: 'Premium', value: 'premium' },
]

const guestConvertFilterOptions = computed(() => [
  { label: t('adminUsers.filter.allUsers'), value: 'all' },
  { label: t('adminUsers.filter.guestConvert'), value: 'true' },
  { label: t('adminUsers.filter.directRegister'), value: 'false' },
])

const tierEditOptions = [
  { label: 'Free', value: 'free' },
  { label: 'Pro', value: 'pro' },
  { label: 'Premium', value: 'premium' },
  { label: 'Partner', value: 'partner' },
]

let searchTimeout: ReturnType<typeof setTimeout>
const debouncedSearch = computed({
  get: () => search.value,
  set: (val: string) => {
    clearTimeout(searchTimeout)
    searchTimeout = setTimeout(() => {
      search.value = val
      page.value = 1
    }, 300)
  }
})

async function loadUsers() {
  loading.value = true
  try {
    const params: Record<string, string> = {
      page: String(page.value),
      pageSize: String(pageSize),
    }
    if (search.value) params.search = search.value
    if (filterRole.value) params.role = filterRole.value
    if (filterTier.value && filterTier.value !== 'all') params.tier = filterTier.value
    if (filterGuestConvert.value && filterGuestConvert.value !== 'all') params.convertedFromGuest = filterGuestConvert.value

    const data = await api<any>('/api/admin/users', { params })
    users.value = data.items
    total.value = data.total
  } finally {
    loading.value = false
  }
}

onMounted(loadUsers)
watch([search, filterRole, filterTier, filterGuestConvert, page], loadUsers)

async function openDetail(u: any) {
  selectedUser.value = u
  showDetailModal.value = true
  detailLoading.value = true
  try {
    userDetail.value = await api<any>(`/api/admin/users/${u.id}`)
  } finally {
    detailLoading.value = false
  }
}

function openSubscriptionEdit(u: any) {
  selectedUser.value = u
  subscriptionForm.tier = u.subscriptionTier
  subscriptionForm.expiresAt = ''
  subscriptionForm.isPermanent = true
  showSubscriptionModal.value = true
}

function openDeleteConfirm(u: any) {
  selectedUser.value = u
  deleteConfirmText.value = ''
  showDeleteModal.value = true
}

function openRoleEdit(u: any) {
  selectedUser.value = u
  roleForm.role = u.role
  showRoleModal.value = true
}

function getMenuItems(u: any) {
  const roleGroup: any[] = []
  if (canChangeRole.value) {
    roleGroup.push({
      label: t('adminUsers.actions.changeRole'),
      icon: 'i-lucide-shield',
      onSelect: () => openRoleEdit(u)
    })
  }
  roleGroup.push({
    label: t('adminUsers.actions.changeSubscription'),
    icon: 'i-lucide-credit-card',
    onSelect: () => openSubscriptionEdit(u)
  })

  return [
    [{
      label: t('adminUsers.actions.viewDetail'),
      icon: 'i-lucide-eye',
      onSelect: () => openDetail(u)
    }],
    roleGroup,
    [{
      label: u.banned ? t('adminUsers.actions.unban') : t('adminUsers.actions.ban'),
      icon: u.banned ? 'i-lucide-check-circle' : 'i-lucide-ban',
      onSelect: () => toggleBan(u)
    },
    {
      label: t('adminUsers.actions.resetPassword'),
      icon: 'i-lucide-key',
      onSelect: () => resetPassword(u)
    }],
    [{
      label: t('adminUsers.actions.delete'),
      icon: 'i-lucide-trash-2',
      onSelect: () => openDeleteConfirm(u)
    }]
  ]
}

async function handleRoleSave() {
  if (!selectedUser.value) return
  try {
    await api(`/api/admin/users/${selectedUser.value.id}/role`, {
      method: 'PATCH',
      body: { role: roleForm.role },
    })
    toast.add({ title: t('adminUsers.toast.roleChanged'), color: 'success' })
    showRoleModal.value = false
    await loadUsers()
  } catch (err: any) {
    toast.add({ title: err?.data?.statusMessage || t('auth.error.generic'), color: 'error' })
  }
}

async function handleSubscriptionSave() {
  if (!selectedUser.value) return
  try {
    await api(`/api/admin/users/${selectedUser.value.id}/subscription`, {
      method: 'PATCH',
      body: {
        tier: subscriptionForm.tier,
        expiresAt: subscriptionForm.isPermanent ? null : (subscriptionForm.expiresAt || null),
      },
    })
    toast.add({ title: t('adminUsers.toast.subscriptionChanged'), color: 'success' })
    showSubscriptionModal.value = false
    await loadUsers()
  } catch (err: any) {
    toast.add({ title: err?.data?.statusMessage || t('auth.error.generic'), color: 'error' })
  }
}

async function toggleBan(u: any) {
  const newBanned = !u.banned
  try {
    await api(`/api/admin/users/${u.id}/ban`, {
      method: 'PATCH',
      body: { banned: newBanned },
    })
    toast.add({
      title: newBanned ? t('adminUsers.toast.banned') : t('adminUsers.toast.unbanned'),
      color: 'success',
    })
    await loadUsers()
  } catch (err: any) {
    toast.add({ title: err?.data?.statusMessage || t('auth.error.generic'), color: 'error' })
  }
}

async function resetPassword(u: any) {
  try {
    await api(`/api/admin/users/${u.id}/reset-password`, { method: 'POST' })
    toast.add({ title: t('adminUsers.toast.passwordReset'), color: 'success' })
  } catch (err: any) {
    toast.add({ title: err?.data?.statusMessage || t('auth.error.generic'), color: 'error' })
  }
}

async function handleDelete() {
  if (!selectedUser.value || deleteConfirmText.value !== 'DELETE') return
  try {
    await api(`/api/admin/users/${selectedUser.value.id}`, { method: 'DELETE' })
    toast.add({ title: t('adminUsers.toast.deleted'), color: 'success' })
    showDeleteModal.value = false
    await loadUsers()
  } catch (err: any) {
    toast.add({ title: err?.data?.statusMessage || t('auth.error.generic'), color: 'error' })
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString()
}

function formatDateTime(iso: string | null) {
  if (!iso) return '-'
  return new Date(iso).toLocaleString()
}

const totalPages = computed(() => Math.ceil(total.value / pageSize))
const showingFrom = computed(() => (page.value - 1) * pageSize + 1)
const showingTo = computed(() => Math.min(page.value * pageSize, total.value))
</script>

<template>
  <div class="space-y-6">
    <!-- Search & Tier filter -->
    <div class="flex flex-col sm:flex-row gap-3">
      <UInput
        :model-value="debouncedSearch"
        @update:model-value="debouncedSearch = $event"
        :placeholder="t('adminUsers.search')"
        icon="i-lucide-search"
        class="flex-1"
      />
      <USelect
        v-model="filterTier"
        :items="tierFilterOptions"
        value-key="value"
        class="w-40"
      />
      <USelect
        v-model="filterGuestConvert"
        :items="guestConvertFilterOptions"
        value-key="value"
        class="w-48"
      />
    </div>

    <!-- Role filter tabs -->
    <UTabs
      :items="roleTabs"
      :model-value="filterRole"
      @update:model-value="onRoleFilterChange($event)"
      variant="link"
    />

    <!-- User list -->
    <div v-if="loading" class="text-center py-12 text-muted">
      <UIcon name="i-lucide-loader-2" class="text-2xl animate-spin" />
    </div>

    <div v-else-if="users.length === 0" class="text-center py-12 text-muted">
      {{ t('adminUsers.empty') }}
    </div>

    <div v-else class="space-y-2">
      <div
        v-for="u in users"
        :key="u.id"
        class="p-3 border border-muted rounded-lg flex items-center gap-3"
      >
        <!-- Avatar -->
        <div class="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
          <img v-if="u.image" :src="u.image" :alt="u.name" class="w-full h-full object-cover" />
          <UIcon v-else name="i-lucide-user" class="text-lg text-muted" />
        </div>

        <!-- Info -->
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="font-medium text-highlighted truncate">{{ u.name }}</span>
            <UBadge v-if="u.role === 'developer'" label="Developer" color="success" size="xs" />
            <UBadge v-else-if="u.role === 'admin'" label="Admin" color="primary" size="xs" />
            <UBadge :label="u.subscriptionTier" :color="u.subscriptionTier === 'premium' ? 'warning' : u.subscriptionTier === 'pro' ? 'primary' : 'neutral'" size="xs" variant="subtle" />
            <UBadge v-if="u.banned" :label="t('adminUsers.badge.banned')" color="error" size="xs" />
            <UBadge v-if="u.convertedFromGuest" :label="t('adminUsers.badge.guestConvert')" color="info" size="xs" variant="subtle" />
            <UIcon v-if="u.emailVerified" name="i-lucide-badge-check" class="text-sm text-success" :title="t('adminUsers.badge.verified')" />
          </div>
          <div class="text-xs text-muted mt-0.5 flex items-center gap-3 flex-wrap">
            <span>{{ u.email }}</span>
            <span>{{ t('adminUsers.info.registered', { date: formatDate(u.createdAt) }) }}</span>
            <span v-if="u.lastLoginAt">{{ t('adminUsers.info.lastLogin', { date: formatDateTime(u.lastLoginAt) }) }}</span>
          </div>
        </div>

        <!-- Actions -->
        <UDropdownMenu :items="getMenuItems(u)">
          <UButton icon="i-lucide-more-vertical" color="neutral" variant="ghost" size="xs" />
        </UDropdownMenu>
      </div>
    </div>

    <!-- Pagination -->
    <div v-if="total > pageSize" class="flex items-center justify-between text-sm text-muted">
      <span>{{ t('admin.pagination.showing', { from: showingFrom, to: showingTo, total }) }}</span>
      <div class="flex gap-1">
        <UButton icon="i-lucide-chevron-left" color="neutral" variant="ghost" size="xs" :disabled="page <= 1" @click="page--" />
        <UButton icon="i-lucide-chevron-right" color="neutral" variant="ghost" size="xs" :disabled="page >= totalPages" @click="page++" />
      </div>
    </div>

    <!-- User Detail Modal -->
    <UModal v-model:open="showDetailModal" :title="t('adminUsers.detail.title')">
      <template #body>
        <div v-if="detailLoading" class="flex justify-center py-8">
          <UIcon name="i-lucide-loader-2" class="text-2xl animate-spin" />
        </div>
        <div v-else-if="userDetail" class="p-4 space-y-4">
          <div class="flex items-center gap-3">
            <div class="w-12 h-12 rounded-full bg-muted flex items-center justify-center overflow-hidden">
              <img v-if="userDetail.image" :src="userDetail.image" :alt="userDetail.name" class="w-full h-full object-cover" />
              <UIcon v-else name="i-lucide-user" class="text-xl text-muted" />
            </div>
            <div>
              <div class="font-semibold text-highlighted">{{ userDetail.name }}</div>
              <div class="text-sm text-muted">{{ userDetail.email }}</div>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span class="text-muted">{{ t('adminUsers.detail.role') }}:</span>
              <span class="ml-1 font-medium">{{ userDetail.role }}</span>
            </div>
            <div>
              <span class="text-muted">{{ t('adminUsers.detail.tier') }}:</span>
              <span class="ml-1 font-medium">{{ userDetail.subscriptionTier }}</span>
            </div>
            <div>
              <span class="text-muted">{{ t('adminUsers.detail.verified') }}:</span>
              <UIcon :name="userDetail.emailVerified ? 'i-lucide-check' : 'i-lucide-x'" :class="userDetail.emailVerified ? 'text-success' : 'text-error'" class="ml-1" />
            </div>
            <div>
              <span class="text-muted">{{ t('adminUsers.detail.banned') }}:</span>
              <UIcon :name="userDetail.banned ? 'i-lucide-check' : 'i-lucide-x'" :class="userDetail.banned ? 'text-error' : 'text-success'" class="ml-1" />
            </div>
            <div>
              <span class="text-muted">{{ t('adminUsers.detail.registered') }}:</span>
              <span class="ml-1">{{ formatDate(userDetail.createdAt) }}</span>
            </div>
            <div>
              <span class="text-muted">{{ t('adminUsers.detail.subscriptionExpires') }}:</span>
              <span class="ml-1">{{ userDetail.subscriptionExpiresAt ? formatDate(userDetail.subscriptionExpiresAt) : t('admin.permanent') }}</span>
            </div>
            <div>
              <span class="text-muted">{{ t('adminUsers.detail.convertedFromGuest') }}:</span>
              <UIcon
                :name="userDetail.convertedFromGuest ? 'i-lucide-check' : 'i-lucide-x'"
                :class="userDetail.convertedFromGuest ? 'text-info' : 'text-muted'"
                class="ml-1"
              />
            </div>
          </div>

        </div>
      </template>
    </UModal>

    <!-- Change Subscription Modal -->
    <UModal v-model:open="showSubscriptionModal" :title="t('adminUsers.subscription.title')">
      <template #body>
        <div class="space-y-4 p-4">
          <div v-if="selectedUser" class="text-sm text-muted">
            {{ selectedUser.name }} ({{ selectedUser.email }})
          </div>
          <UFormField :label="t('adminUsers.subscription.tier')">
            <USelect v-model="subscriptionForm.tier" :items="tierEditOptions" value-key="value" class="w-full" />
          </UFormField>
          <div class="flex items-center gap-3">
            <label class="flex items-center gap-2 text-sm cursor-pointer">
              <input v-model="subscriptionForm.isPermanent" type="checkbox" class="rounded border-gray-300 text-primary" />
              {{ t('admin.permanent') }}
            </label>
          </div>
          <UFormField v-if="!subscriptionForm.isPermanent" :label="t('adminUsers.subscription.expiresAt')">
            <UInput v-model="subscriptionForm.expiresAt" type="date" class="w-full" />
          </UFormField>
          <div class="flex justify-end gap-2">
            <UButton :label="t('adminUsers.actions.cancel')" color="neutral" variant="outline" @click="showSubscriptionModal = false" />
            <UButton :label="t('adminUsers.actions.save')" color="primary" @click="handleSubscriptionSave" />
          </div>
        </div>
      </template>
    </UModal>

    <!-- Change Role Modal -->
    <UModal v-model:open="showRoleModal" :title="t('adminUsers.actions.changeRole')">
      <template #body>
        <div class="space-y-4 p-4">
          <div v-if="selectedUser" class="text-sm text-muted">
            {{ selectedUser.name }} ({{ selectedUser.email }})
          </div>
          <UFormField :label="t('adminUsers.detail.role')">
            <USelect v-model="roleForm.role" :items="roleEditOptions" value-key="value" class="w-full" />
          </UFormField>
          <div class="flex justify-end gap-2">
            <UButton :label="t('adminUsers.actions.cancel')" color="neutral" variant="outline" @click="showRoleModal = false" />
            <UButton :label="t('adminUsers.actions.save')" color="primary" @click="handleRoleSave" />
          </div>
        </div>
      </template>
    </UModal>

    <!-- Delete User Confirm Modal -->
    <UModal v-model:open="showDeleteModal" :title="t('adminUsers.delete.title')">
      <template #body>
        <div class="space-y-4 p-4">
          <p class="text-sm text-muted">
            {{ t('adminUsers.delete.warning', { name: selectedUser?.name }) }}
          </p>
          <UFormField :label="t('adminUsers.delete.confirmLabel')">
            <UInput v-model="deleteConfirmText" :placeholder="t('adminUsers.delete.confirmPlaceholder')" class="w-full" />
          </UFormField>
          <div class="flex justify-end gap-2">
            <UButton :label="t('adminUsers.actions.cancel')" color="neutral" variant="outline" @click="showDeleteModal = false" />
            <UButton
              :label="t('adminUsers.actions.delete')"
              color="error"
              :disabled="deleteConfirmText !== 'DELETE'"
              @click="handleDelete"
            />
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
