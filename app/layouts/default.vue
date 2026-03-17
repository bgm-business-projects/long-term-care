<script setup lang="ts">
const route = useRoute()
const { t } = useI18n()
const { user, signOut, fetchSession } = useAuth()
const { tier } = useSubscription()
const { isFocusMode, layoutClasses, panelUiOptions } = useAppLayoutController()

const isAdmin = computed(() => user.value?.role === 'admin' || user.value?.role === 'developer')

const tierBadgeColor = computed(() => {
  switch (tier.value) {
    case 'partner': return 'success' as const
    case 'premium': return 'warning' as const
    case 'pro': return 'primary' as const
    default: return 'neutral' as const
  }
})

const tierBadgeLabel = computed(() => {
  switch (tier.value) {
    case 'partner': return 'Partner'
    case 'premium': return 'Premium'
    case 'pro': return 'Pro'
    default: return 'Free'
  }
})

const navItems = computed(() => {
  const items = [
    { label: t('nav.home'), icon: 'i-lucide-home', to: '/' },
  ]
  if (isAdmin.value) {
    items.push({ label: t('nav.admin'), icon: 'i-lucide-shield', to: '/admin' })
  }
  items.push(
    { label: t('nav.profile'), icon: 'i-lucide-user-circle', to: '/profile' },
    { label: t('nav.plans'), icon: 'i-lucide-gem', to: '/plans' },
  )
  return items
})

const userMenuItems = computed(() => {
  return [
    [{
      label: t('nav.profile'),
      icon: 'i-lucide-user-circle',
      onSelect: () => navigateTo('/profile')
    },
    {
      label: t('subscription.redeem'),
      icon: 'i-lucide-gift',
      onSelect: () => navigateTo('/profile?section=redeem')
    }],
    [{
      label: t('auth.logout'),
      icon: 'i-lucide-log-out',
      onSelect: () => signOut()
    }]
  ]
})
</script>

<template>
  <UDashboardGroup>
    <div v-show="!isFocusMode" class="contents">
    <UDashboardSidebar
      collapsible
      resizable
      :min-size="12"
      :max-size="20"
      :default-size="15"
      :collapsed-size="4"
      :ui="{
        root: 'bg-default hidden md:flex',
      }"
    >
      <template #header="{ collapsed }">
        <div class="flex items-center gap-2 px-2">
          <img src="/logo.png" alt="MyApp" class="w-7 h-7 rounded-md flex-shrink-0" />
          <span v-if="!collapsed" class="font-bold text-highlighted truncate" style="font-family: 'Montserrat', sans-serif;">MyApp</span>
        </div>
      </template>

      <template #default="{ collapsed }">
        <nav class="space-y-1">
          <NuxtLink
            v-for="item in navItems"
            :key="item.to"
            :to="item.to"
            class="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors"
            :class="[
              item.to === '/' ? route.path === '/' : route.path.startsWith(item.to)
                ? 'bg-primary/10 text-primary'
                : 'text-muted hover:bg-muted hover:text-highlighted'
            ]"
          >
            <UIcon :name="item.icon" class="text-lg flex-shrink-0" />
            <span v-if="!collapsed" class="text-sm font-medium truncate">{{ item.label }}</span>
          </NuxtLink>
        </nav>
      </template>

      <template #footer="{ collapsed }">
        <div class="w-full space-y-2">
          <UDashboardSidebarCollapse
            v-if="!collapsed"
            :label="t('nav.collapse')"
            class="w-full justify-start"
          />
          <UDashboardSidebarCollapse v-else class="w-full" />
        </div>
      </template>
    </UDashboardSidebar>
    </div>

    <UDashboardPanel :ui="panelUiOptions">
      <template #header>
        <!-- Focus mode: provide teleport mount point -->
        <header
          v-if="isFocusMode"
          class="sticky top-0 z-50 bg-default border-b border-muted px-3 py-2 flex items-center justify-between"
        >
          <div id="focus-header-target" class="flex items-center justify-between w-full" />
        </header>
        <!-- Standard mode: full navbar -->
        <UDashboardNavbar v-else title="MyApp">
          <template #right>
            <LanguageToggle />
            <UDropdownMenu v-if="user" :items="userMenuItems">
              <UButton variant="ghost" size="sm" icon="i-lucide-user" :label="user?.name" class="ml-2">
                <template #trailing>
                  <UBadge
                    :label="tierBadgeLabel"
                    :color="tierBadgeColor"
                    size="xs"
                  />
                </template>
              </UButton>
            </UDropdownMenu>
          </template>
        </UDashboardNavbar>
        <!-- Teleport target for page-level toolbars -->
        <div v-if="!isFocusMode" id="page-toolbar" />
      </template>

      <template #body>
        <div :class="layoutClasses">
          <slot />
        </div>
      </template>
    </UDashboardPanel>
  </UDashboardGroup>

  <UiMobileBottomNav v-if="!isFocusMode" :items="navItems" />
  <TierChangeModal />
  <PhotoCropModal />
</template>
