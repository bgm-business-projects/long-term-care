<script setup lang="ts">
definePageMeta({ layout: false })

const { t } = useI18n()
const { forgetPassword } = useAuth()

const email = ref('')
const loading = ref(false)
const error = ref('')
const sent = ref(false)

async function handleSubmit() {
  error.value = ''
  loading.value = true

  try {
    await forgetPassword(email.value)
    sent.value = true
  } catch (err: any) {
    error.value = t('auth.error.generic')
  } finally {
    loading.value = false
  }
}
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
            {{ t('auth.forgotPassword.title') }}
          </h2>

          <template v-if="!sent">
            <p class="text-sm text-muted text-center">
              {{ t('auth.forgotPassword.description') }}
            </p>

            <form class="space-y-3" @submit.prevent="handleSubmit">
              <UFormField :label="t('auth.email')">
                <UInput
                  v-model="email"
                  type="email"
                  :placeholder="t('auth.emailPlaceholder')"
                  required
                  class="w-full"
                />
              </UFormField>

              <p v-if="error" class="text-sm text-red-500">{{ error }}</p>

              <UButton
                type="submit"
                block
                :loading="loading"
                :label="t('auth.forgotPassword.submit')"
              />
            </form>
          </template>

          <template v-else>
            <div class="text-center space-y-3">
              <UIcon name="i-lucide-mail-check" class="text-4xl text-primary" />
              <p class="text-sm text-muted">
                {{ t('auth.forgotPassword.sent') }}
              </p>
            </div>
          </template>

          <p class="text-sm text-center text-muted">
            <NuxtLink to="/login" class="text-primary font-medium hover:underline">
              {{ t('auth.forgotPassword.backToLogin') }}
            </NuxtLink>
          </p>
        </div>
      </UCard>

      <div class="text-center">
        <LanguageToggle />
      </div>
    </div>
  </div>
</template>
