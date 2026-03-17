<script setup lang="ts">
const { t } = useI18n()

useSeoMeta({
  title: () => t('seo.home.title'),
  ogTitle: () => t('seo.home.title'),
  description: () => t('seo.home.description'),
  ogDescription: () => t('seo.home.description'),
})

// Page transition animation
const contentRef = ref<HTMLElement | null>(null)
usePageTransition(contentRef)
</script>

<template>
  <div ref="contentRef" class="flex items-start justify-center min-h-[calc(100dvh-49px)] p-6 pt-[8vh]">
    <div class="w-full max-w-md text-center space-y-6">
      <div class="space-y-2">
        <div class="flex justify-center mb-1">
          <img src="/logo.png" alt="MyApp" class="w-16 h-16 rounded-xl" />
        </div>
        <h1 class="text-2xl font-bold text-highlighted" style="font-family: 'Montserrat', sans-serif;">
          MyApp
        </h1>
        <p class="text-sm font-medium text-highlighted tracking-wide" style="font-family: 'Montserrat', sans-serif;">
          {{ t('app.slogan') }}
        </p>
        <p class="text-xs text-muted">
          {{ t('app.subtitle') }}
        </p>
      </div>

      <NuxtLink to="/profile" class="block">
        <UCard variant="outline" class="hover:border-primary/40 active:scale-[0.98] transition-all cursor-pointer">
          <div class="flex items-center gap-4 text-left">
            <div class="flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10 flex-shrink-0">
              <UIcon name="i-lucide-user-circle" class="text-primary text-2xl" />
            </div>
            <div class="flex-1 min-w-0">
              <h3 class="font-semibold text-default">{{ t('nav.profile') }}</h3>
            </div>
            <UIcon name="i-lucide-chevron-right" class="text-muted flex-shrink-0" />
          </div>
        </UCard>
      </NuxtLink>

      <NuxtLink to="/plans" class="block">
        <UCard variant="outline" class="hover:border-primary/40 active:scale-[0.98] transition-all cursor-pointer">
          <div class="flex items-center gap-4 text-left">
            <div class="flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10 flex-shrink-0">
              <UIcon name="i-lucide-gem" class="text-primary text-2xl" />
            </div>
            <div class="flex-1 min-w-0">
              <h3 class="font-semibold text-default">{{ t('nav.plans') }}</h3>
            </div>
            <UIcon name="i-lucide-chevron-right" class="text-muted flex-shrink-0" />
          </div>
        </UCard>
      </NuxtLink>

      <p class="text-xs text-muted/50 pt-2">
        &copy; {{ new Date().getFullYear() }} MyApp. All rights reserved.
      </p>
    </div>
  </div>
</template>
