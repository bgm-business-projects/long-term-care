<script setup lang="ts">
definePageMeta({ layout: false })

const { t } = useI18n()
const route = useRoute()
const { verifyEmail } = useAuth()

const token = computed(() => (route.query.token as string) || '')
const status = ref<'loading' | 'success' | 'error'>('loading')
const error = ref('')

onMounted(async () => {
  if (!token.value) {
    status.value = 'error'
    error.value = t('auth.verifyEmail.invalidToken')
    return
  }

  try {
    await verifyEmail(token.value)
    status.value = 'success'
  } catch (err: any) {
    status.value = 'error'
    if (err?.code === 'INVALID_TOKEN' || err?.code === 'TOKEN_EXPIRED') {
      error.value = t('auth.verifyEmail.invalidToken')
    } else {
      error.value = t('auth.error.generic')
    }
  }
})
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-default px-4">
    <div class="w-full max-w-sm space-y-6">
      <div class="text-center space-y-2">
        <img src="/logo.png" alt="MyApp" class="w-16 h-16 mx-auto rounded-xl" />
        <h1 class="text-2xl font-bold text-highlighted" style="font-family: 'Montserrat', sans-serif;">
          MyApp
        </h1>
      </div>

      <UCard>
        <div class="space-y-4">
          <h2 class="text-lg font-semibold text-center text-highlighted">
            {{ t('auth.verifyEmail.title') }}
          </h2>

          <div v-if="status === 'loading'" class="text-center space-y-3">
            <UIcon name="i-lucide-loader-2" class="text-4xl text-primary animate-spin" />
            <p class="text-sm text-muted">
              {{ t('auth.verifyEmail.verifying') }}
            </p>
          </div>

          <div v-else-if="status === 'success'" class="text-center space-y-3">
            <UIcon name="i-lucide-check-circle" class="text-4xl text-green-600" />
            <p class="text-sm text-muted">
              {{ t('auth.verifyEmail.success') }}
            </p>
            <UButton
              block
              :label="t('auth.login')"
              @click="navigateTo('/login')"
            />
          </div>

          <div v-else class="text-center space-y-3">
            <UIcon name="i-lucide-x-circle" class="text-4xl text-red-500" />
            <p class="text-sm text-red-500">
              {{ error }}
            </p>
            <UButton
              block
              variant="outline"
              :label="t('auth.verifyEmail.backToLogin')"
              @click="navigateTo('/login')"
            />
          </div>
        </div>
      </UCard>

      <div class="text-center">
        <LanguageToggle />
      </div>
    </div>
  </div>
</template>
