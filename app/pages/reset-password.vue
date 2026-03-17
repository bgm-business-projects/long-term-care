<script setup lang="ts">
definePageMeta({ layout: false })

const { t } = useI18n()
const route = useRoute()
const { resetPassword } = useAuth()

const token = computed(() => (route.query.token as string) || '')
const form = reactive({ password: '', confirmPassword: '' })
const loading = ref(false)
const error = ref('')
const success = ref(false)

const passwordChecks = computed(() => [
  { key: 'minLength', pass: form.password.length >= 8, label: t('auth.passwordRule.minLength') },
  { key: 'maxLength', pass: form.password.length <= 128, label: t('auth.passwordRule.maxLength') },
  { key: 'match', pass: form.confirmPassword.length > 0 && form.password === form.confirmPassword, label: t('auth.passwordRule.match') }
])

const passwordValid = computed(() => passwordChecks.value.every(c => c.pass))

async function handleSubmit() {
  error.value = ''

  if (!token.value) {
    error.value = t('auth.resetPassword.invalidToken')
    return
  }

  if (!passwordValid.value) {
    error.value = t('auth.error.passwordTooShort')
    return
  }

  loading.value = true

  try {
    await resetPassword(token.value, form.password)
    success.value = true
  } catch (err: any) {
    if (err?.code === 'INVALID_TOKEN' || err?.code === 'TOKEN_EXPIRED') {
      error.value = t('auth.resetPassword.invalidToken')
    } else {
      error.value = t('auth.error.generic')
    }
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
            {{ t('auth.resetPassword.title') }}
          </h2>

          <template v-if="!success">
            <form class="space-y-3" @submit.prevent="handleSubmit">
              <UFormField :label="t('auth.resetPassword.newPassword')">
                <UInput
                  v-model="form.password"
                  type="password"
                  :placeholder="t('auth.passwordPlaceholder')"
                  required
                  minlength="8"
                  maxlength="128"
                  class="w-full"
                />
              </UFormField>

              <UFormField :label="t('auth.confirmPassword')">
                <UInput
                  v-model="form.confirmPassword"
                  type="password"
                  :placeholder="t('auth.confirmPasswordPlaceholder')"
                  required
                  class="w-full"
                />
              </UFormField>

              <ul v-if="form.password.length > 0" class="space-y-1 text-xs">
                <li
                  v-for="check in passwordChecks"
                  :key="check.key"
                  class="flex items-center gap-1.5"
                  :class="check.pass ? 'text-green-600' : 'text-muted'"
                >
                  <UIcon
                    :name="check.pass ? 'i-lucide-check-circle' : 'i-lucide-circle'"
                    class="text-sm flex-shrink-0"
                  />
                  {{ check.label }}
                </li>
              </ul>

              <p v-if="error" class="text-sm text-red-500">{{ error }}</p>

              <UButton
                type="submit"
                block
                :loading="loading"
                :label="t('auth.resetPassword.submit')"
              />
            </form>
          </template>

          <template v-else>
            <div class="text-center space-y-3">
              <UIcon name="i-lucide-check-circle" class="text-4xl text-green-600" />
              <p class="text-sm text-muted">
                {{ t('auth.resetPassword.success') }}
              </p>
              <UButton
                block
                :label="t('auth.login')"
                @click="navigateTo('/login')"
              />
            </div>
          </template>

          <p v-if="!success && error" class="text-sm text-center text-muted">
            <NuxtLink to="/forgot-password" class="text-primary font-medium hover:underline">
              {{ t('auth.resetPassword.requestAgain') }}
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
