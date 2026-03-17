<script setup lang="ts">
const { t } = useI18n()
const route = useRoute()

const tabs = computed(() => [
  { label: t('admin.nav.users'), icon: 'i-lucide-users', to: '/admin/users' },
  { label: t('admin.nav.codes'), icon: 'i-lucide-ticket', to: '/admin/codes' },
])

const activeTabIndex = computed(() => {
  const idx = tabs.value.findIndex(tab => route.path.startsWith(tab.to))
  return idx >= 0 ? idx : 0
})
</script>

<template>
  <div class="p-4 pb-24 max-w-4xl mx-auto space-y-6">
    <h1 class="text-2xl font-bold text-highlighted">{{ t('admin.title') }}</h1>

    <nav class="flex gap-1 border-b border-muted">
      <NuxtLink
        v-for="(tab, index) in tabs"
        :key="tab.to"
        :to="tab.to"
        class="flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors"
        :class="[
          activeTabIndex === index
            ? 'border-primary text-primary'
            : 'border-transparent text-muted hover:text-highlighted'
        ]"
      >
        <UIcon :name="tab.icon" class="text-base" />
        {{ tab.label }}
      </NuxtLink>
    </nav>

    <NuxtPage />
  </div>
</template>
