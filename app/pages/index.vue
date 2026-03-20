<script setup lang="ts">
const { user } = useAuth()

const role = computed(() => (user.value as any)?.role ?? '')

// Auto-redirect if already logged in
onMounted(() => {
  if (!user.value) return
  const r = role.value
  if (r === 'admin' || r === 'developer') navigateTo('/admin')
  else if (r === 'agency_staff') navigateTo('/agency')
  else if (r === 'driver') navigateTo('/driver')
})

const portals = [
  {
    label: '管理後台',
    desc: '調度員 / 系統管理員',
    icon: 'i-lucide-shield',
    to: '/admin/login',
    color: 'text-primary',
    bg: 'bg-primary/10',
  },
  {
    label: '機構人員後台',
    desc: '長照機構承辦人員',
    icon: 'i-lucide-building-2',
    to: '/agency/login',
    color: 'text-violet-500',
    bg: 'bg-violet-500/10',
  },
  {
    label: '司機後台',
    desc: '外送司機 / 接送人員',
    icon: 'i-lucide-car',
    to: '/driver/login',
    color: 'text-emerald-500',
    bg: 'bg-emerald-500/10',
  },
]
</script>

<template>
  <div class="min-h-screen flex items-start justify-center bg-default px-4 pt-[8vh]">
    <div class="w-full max-w-sm space-y-8">
      <!-- Logo -->
      <div class="text-center space-y-2">
        <img src="/logo.png" alt="BGMx長照派車" class="w-16 h-16 mx-auto rounded-xl" />
        <h1 class="text-2xl font-bold text-highlighted" style="font-family: 'Montserrat', sans-serif;">
          BGM x 長照派車
        </h1>
        <p class="text-sm text-muted">請選擇您的登入站點</p>
      </div>

      <!-- Portal cards -->
      <div class="space-y-3">
        <NuxtLink
          v-for="portal in portals"
          :key="portal.to"
          :to="portal.to"
          class="block"
        >
          <UCard
            variant="outline"
            class="hover:border-primary/40 active:scale-[0.98] transition-all cursor-pointer"
          >
            <div class="flex items-center gap-4">
              <div
                class="flex items-center justify-center w-12 h-12 rounded-lg shrink-0"
                :class="portal.bg"
              >
                <UIcon :name="portal.icon" class="text-2xl" :class="portal.color" />
              </div>
              <div class="flex-1 min-w-0">
                <p class="font-semibold text-highlighted">{{ portal.label }}</p>
                <p class="text-xs text-muted mt-0.5">{{ portal.desc }}</p>
              </div>
              <UIcon name="i-lucide-chevron-right" class="text-muted shrink-0" />
            </div>
          </UCard>
        </NuxtLink>
      </div>

      <p class="text-center text-xs text-muted/50">
        &copy; {{ new Date().getFullYear() }} BGM x 長照派車. All rights reserved.
      </p>
    </div>
  </div>
</template>
