<script setup lang="ts">
const route = useRoute()
const { t } = useI18n()
const colorMode = useColorMode()
const { user, signOut } = useAuth()
const { api } = useApi()

const displayName = computed(() => (user.value as any)?.name || (user.value as any)?.email || '機構人員')
const orgId = computed(() => (user.value as any)?.organizationId)
const orgName = ref('')

watch(orgId, async (id) => {
  if (!id) { orgName.value = ''; return }
  try {
    const org = await api<any>(`/api/dispatch/organizations/${id}`)
    orgName.value = org.name || ''
  } catch {
    orgName.value = ''
  }
}, { immediate: true })

function toggleColorMode() {
  colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'
}

async function handleSignOut() {
  await signOut()
  navigateTo('/agency/login')
}

const navGroups = [
  {
    label: '訂單管理',
    items: [
      { label: '訂單列表', icon: 'i-lucide-list', to: '/agency/orders' },
      { label: '個案管理', icon: 'i-lucide-heart-handshake', to: '/agency/cases' },
      { label: '據點管理', icon: 'i-lucide-map-pin', to: '/agency/locations' },
    ],
  },
  {
    label: '監控報表',
    items: [
      { label: 'Dashboard', icon: 'i-lucide-bar-chart-2', to: '/agency/dashboard' },
    ],
  },
]

function isActive(itemTo: string) {
  if (itemTo === '/agency/orders' && route.path === '/agency/orders') return true
  if (itemTo === '/agency/orders') return false
  return route.path.startsWith(itemTo)
}
</script>

<template>
  <UDashboardGroup>
    <UDashboardSidebar
      collapsible
      resizable
      :min-size="12"
      :max-size="22"
      :default-size="16"
      :collapsed-size="4"
      :ui="{ root: 'bg-default hidden md:flex' }"
    >
      <template #header="{ collapsed }">
        <div class="flex items-center gap-2 px-2 w-full">
          <img src="/logo.png" alt="BGMx長照派車" class="w-7 h-7 rounded-md shrink-0" />
          <div v-if="!collapsed" class="flex-1 min-w-0">
            <p class="font-bold text-highlighted truncate text-sm" style="font-family: 'Montserrat', sans-serif;">BGM x 長照派車</p>
            <p v-if="orgName" class="text-xs text-muted truncate">{{ orgName }}</p>
          </div>
          <UButton
            v-if="!collapsed"
            :icon="colorMode.value === 'dark' ? 'i-lucide-sun' : 'i-lucide-moon'"
            variant="ghost"
            size="xs"
            class="shrink-0"
            @click="toggleColorMode"
          />
        </div>
      </template>

      <template #default="{ collapsed }">
        <nav class="space-y-4">
          <div v-for="group in navGroups" :key="group.label">
            <p v-if="!collapsed" class="text-xs font-semibold text-muted uppercase tracking-wider px-3 mb-1">
              {{ group.label }}
            </p>
            <div class="space-y-0.5">
              <NuxtLink
                v-for="item in group.items"
                :key="item.to"
                :to="item.to"
                class="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors"
                :class="isActive(item.to)
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted hover:bg-muted hover:text-highlighted'"
              >
                <UIcon :name="item.icon" class="text-base shrink-0" />
                <span v-if="!collapsed" class="text-sm font-medium truncate">{{ item.label }}</span>
              </NuxtLink>
            </div>
          </div>
        </nav>
      </template>

      <template #footer="{ collapsed }">
        <div v-if="!collapsed" class="w-full flex items-center gap-1">
          <UDropdownMenu
            :items="[
              [{ label: orgName || '機構人員後台', disabled: true, icon: 'i-lucide-building-2' }],
              [{ label: displayName, disabled: true, icon: 'i-lucide-user-circle' }],
              [{ label: '登出', icon: 'i-lucide-log-out', color: 'error' as const, onSelect: handleSignOut }],
            ]"
            :ui="{ content: 'w-48' }"
            class="flex-1 min-w-0"
          >
            <UButton
              color="neutral"
              variant="ghost"
              class="w-full justify-start gap-2 px-2"
              icon="i-lucide-user-circle"
              :label="displayName"
            />
          </UDropdownMenu>
          <UDashboardSidebarCollapse class="shrink-0" />
        </div>
        <div v-else class="w-full flex flex-col items-center gap-2">
          <UDropdownMenu
            :items="[
              [{ label: orgName || '機構人員後台', disabled: true, icon: 'i-lucide-building-2' }],
              [{ label: displayName, disabled: true, icon: 'i-lucide-user-circle' }],
              [{ label: '登出', icon: 'i-lucide-log-out', color: 'error' as const, onSelect: handleSignOut }],
            ]"
            :ui="{ content: 'w-48' }"
          >
            <UButton color="neutral" variant="ghost" icon="i-lucide-user-circle" class="w-full" />
          </UDropdownMenu>
          <UDashboardSidebarCollapse class="w-full" />
        </div>
      </template>
    </UDashboardSidebar>

    <UDashboardPanel>
      <template #body>
        <div class="p-6">
          <slot />
        </div>
      </template>
    </UDashboardPanel>
  </UDashboardGroup>
</template>
