<script setup lang="ts">
definePageMeta({ layout: false })

const { t } = useI18n()
const { api } = useApi()
const { user, fetchSession } = useAuth()
const toast = useToast()

const agreed = ref(false)
const loading = ref(false)
const shakeCheckbox = ref(false)

// If user already accepted consent, redirect away
watch(() => user.value?.consentAcceptedAt, (val) => {
  if (val) navigateTo('/')
}, { immediate: true })

async function handleAccept() {
  if (!agreed.value) {
    toast.add({ title: t('consent.pleaseAgree'), color: 'warning', icon: 'i-lucide-alert-triangle' })
    shakeCheckbox.value = true
    setTimeout(() => { shakeCheckbox.value = false }, 600)
    return
  }
  loading.value = true
  try {
    await api('/api/consent/accept', { method: 'POST' })
    await fetchSession()
    navigateTo('/')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="h-dvh flex flex-col bg-default">
    <!-- Scrollable content -->
    <div class="flex-1 min-h-0 overflow-y-auto p-4 sm:p-8" style="-webkit-overflow-scrolling: touch;">
      <div class="w-full max-w-lg mx-auto space-y-6 pb-4">
        <div class="text-center space-y-2">
          <img src="/logo.png" alt="MyApp" class="w-16 h-16 mx-auto rounded-xl" />
          <h2 class="text-2xl font-bold text-highlighted">{{ t('consent.title') }}</h2>
          <p class="text-muted text-sm">{{ t('consent.subtitle') }}</p>
        </div>

        <UCard>
          <div class="space-y-4 text-sm text-muted">
            <p class="font-medium text-highlighted">{{ t('auth.consent.agree') }}</p>
            <ul class="list-disc ml-5 space-y-1">
              <li>{{ t('auth.consent.terms') }}</li>
              <li>{{ t('auth.consent.privacy') }}</li>
              <li>{{ t('auth.consent.data') }}</li>
              <li>{{ t('auth.consent.age') }}</li>
              <li>{{ t('auth.consent.email') }}</li>
            </ul>

            <p class="font-medium text-highlighted pt-2">{{ t('auth.consent.disclaimerTitle') }}</p>
            <ul class="list-disc ml-5 space-y-1">
              <li>{{ t('auth.consent.noGuarantee') }}</li>
              <li>{{ t('auth.consent.dataLoss') }}</li>
              <li>{{ t('auth.consent.thirdParty') }}</li>
              <li>{{ t('auth.consent.changeTerms') }}</li>
              <li>{{ t('auth.consent.noLiability') }}</li>
              <li>{{ t('auth.consent.accountTermination') }}</li>
            </ul>
          </div>
        </UCard>
      </div>
    </div>

    <!-- Fixed bottom bar -->
    <div class="shrink-0 border-t border-muted bg-default p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-8">
      <div class="w-full max-w-lg mx-auto space-y-3">
        <div
          class="flex items-center gap-3 p-4 -mx-1 rounded-lg cursor-pointer select-none touch-manipulation active:bg-muted/50 transition-colors"
          :class="shakeCheckbox && 'animate-shake ring-2 ring-warning'"
          @click="agreed = !agreed"
        >
          <UCheckbox :model-value="agreed" class="shrink-0 pointer-events-none" />
          <span class="text-sm font-medium leading-snug">{{ t('consent.checkbox') }}</span>
        </div>

        <button
          type="button"
          class="w-full rounded-lg bg-primary text-white font-medium py-3 text-base touch-manipulation active:opacity-80 transition-opacity"
          @click="handleAccept"
        >
          <span v-if="loading" class="i-lucide-loader-2 animate-spin inline-block size-5 align-middle" />
          <span v-else>{{ t('consent.accept') }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20%, 60% { transform: translateX(-6px); }
  40%, 80% { transform: translateX(6px); }
}
.animate-shake {
  animation: shake 0.4s ease-in-out;
}
</style>
