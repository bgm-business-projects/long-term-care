<script setup lang="ts">
definePageMeta({ layout: false })

const { t } = useI18n()

useSeoMeta({
  title: () => t('seo.login.title'),
  ogTitle: () => t('seo.login.title'),
  description: () => t('seo.login.description'),
  ogDescription: () => t('seo.login.description'),
})

const { signInWithEmail, signUpWithEmail, signInWithGoogle } = useAuth()
const { api } = useApi()
const route = useRoute()
const { getSafeRedirectUrl } = useRedirectService()
const redirectTo = computed(() => getSafeRedirectUrl(route.query.redirect))
const toast = useToast()

const REMEMBER_KEY = 'myapp-remember-email'
const mode = ref<'login' | 'register'>('login')
const registerStep = ref<1 | 2>(1)
const rememberMe = ref(false)
const form = reactive({ name: '', email: '', password: '', confirmPassword: '' })
const agreeTerms = ref(false)
const shakeCheckbox = ref(false)
const error = ref('')
const loading = ref(false)
const googleLoading = ref(false)

onMounted(() => {
  const saved = localStorage.getItem(REMEMBER_KEY)
  if (saved) {
    form.email = saved
    rememberMe.value = true
  }
})

const emailValid = computed(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))

const passwordChecks = computed(() => [
  { key: 'minLength', pass: form.password.length >= 8, label: t('auth.passwordRule.minLength') },
  { key: 'maxLength', pass: form.password.length <= 128, label: t('auth.passwordRule.maxLength') },
  { key: 'match', pass: form.confirmPassword.length > 0 && form.password === form.confirmPassword, label: t('auth.passwordRule.match') }
])

const passwordValid = computed(() => passwordChecks.value.every(c => c.pass))

async function handleSubmit() {
  error.value = ''
  loading.value = true

  try {
    if (mode.value === 'register') {
      if (!emailValid.value) {
        error.value = t('auth.error.invalidEmail')
        loading.value = false
        return
      }
      if (!passwordValid.value) {
        error.value = t('auth.error.passwordTooShort')
        loading.value = false
        return
      }
      await signUpWithEmail(form.name, form.email, form.password)
      await api('/api/consent/accept', { method: 'POST' }).catch(() => {})
    } else {
      await signInWithEmail(form.email, form.password)
    }
    if (rememberMe.value) {
      localStorage.setItem(REMEMBER_KEY, form.email)
    } else {
      localStorage.removeItem(REMEMBER_KEY)
    }
    navigateTo(redirectTo.value)
  } catch (err: any) {
    const code = err?.code || ''
    if (code === 'INVALID_CREDENTIALS') {
      error.value = t('auth.error.invalidCredentials')
    } else if (code === 'EMAIL_EXISTS') {
      error.value = t('auth.error.emailExists')
    } else if (code === 'PASSWORD_TOO_SHORT') {
      error.value = t('auth.error.passwordTooShort')
    } else if (code === 'INVALID_EMAIL') {
      error.value = t('auth.error.invalidEmail')
    } else {
      error.value = t('auth.error.generic')
    }
  } finally {
    loading.value = false
  }
}

async function handleGoogleSignUp() {
  error.value = ''
  googleLoading.value = true
  await signInWithGoogle(redirectTo.value)
}

function handleRegisterNext() {
  if (!agreeTerms.value) {
    toast.add({ title: t('consent.pleaseAgree'), color: 'warning', icon: 'i-lucide-alert-triangle' })
    shakeCheckbox.value = true
    setTimeout(() => { shakeCheckbox.value = false }, 600)
    return
  }
  registerStep.value = 2
}

function toggleMode() {
  mode.value = mode.value === 'login' ? 'register' : 'login'
  registerStep.value = 1
  error.value = ''
  form.confirmPassword = ''
  agreeTerms.value = false
}
</script>

<template>
  <div class="min-h-screen flex items-start justify-center bg-default px-4 pt-[8vh]">
    <div class="w-full max-w-sm space-y-6">
      <div class="text-center space-y-2">
        <img src="/logo.png" alt="MyApp" class="w-16 h-16 mx-auto rounded-xl" />
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

      <!-- ==================== LOGIN MODE ==================== -->
      <UCard v-if="mode === 'login'">
        <div class="space-y-4">
          <h2 class="text-lg font-semibold text-center text-highlighted">
            {{ t('auth.login') }}
          </h2>

          <UButton
            block
            variant="outline"
            icon="i-simple-icons-google"
            :label="t('auth.signInWithGoogle')"
            @click="signInWithGoogle(redirectTo)"
          />

          <p class="flex items-start gap-1.5 text-xs text-amber-500">
            <UIcon name="i-lucide-triangle-alert" class="size-3.5 shrink-0 mt-0.5" />
            <span>{{ t('auth.lineWarning') }}</span>
          </p>

          <USeparator label="or" />

          <form class="space-y-3" @submit.prevent="handleSubmit">
            <UFormField :label="t('auth.email')">
              <UInput
                v-model="form.email"
                type="email"
                :placeholder="t('auth.emailPlaceholder')"
                required
                class="w-full"
              />
            </UFormField>

            <UFormField :label="t('auth.password')">
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

            <div class="flex items-center justify-between -mt-1">
              <UCheckbox v-model="rememberMe" :label="t('auth.rememberMe')" class="text-sm" />
              <NuxtLink to="/forgot-password" class="text-sm text-primary hover:underline">
                {{ t('auth.forgotPasswordLink') }}
              </NuxtLink>
            </div>

            <p v-if="error" class="text-sm text-red-500">{{ error }}</p>

            <UButton
              type="submit"
              block
              :loading="loading"
              :label="t('auth.login')"
            />
          </form>

          <p class="text-sm text-center text-muted">
            {{ t('auth.noAccount') }}
            <button class="text-primary font-medium" @click="toggleMode">
              {{ t('auth.signUpLink') }}
            </button>
          </p>
        </div>
      </UCard>

      <!-- ==================== REGISTER MODE ==================== -->

      <!-- Step 1: Consent -->
      <UCard v-if="mode === 'register' && registerStep === 1">
        <div class="space-y-4">
          <h2 class="text-lg font-semibold text-center text-highlighted">
            {{ t('auth.register') }}
          </h2>
          <p class="text-sm text-center text-muted">{{ t('auth.registerStep1Hint') }}</p>

          <div class="space-y-2 text-xs text-muted">
            <p class="font-medium text-highlighted">{{ t('auth.consent.agree') }}</p>
            <ul class="ml-4 list-disc space-y-0.5">
              <li>{{ t('auth.consent.terms') }}</li>
              <li>{{ t('auth.consent.privacy') }}</li>
              <li>{{ t('auth.consent.data') }}</li>
              <li>{{ t('auth.consent.age') }}</li>
              <li>{{ t('auth.consent.email') }}</li>
            </ul>
            <p class="ml-4 mt-2 font-medium text-highlighted">{{ t('auth.consent.disclaimerTitle') }}</p>
            <ul class="ml-4 list-disc space-y-0.5">
              <li>{{ t('auth.consent.noGuarantee') }}</li>
              <li>{{ t('auth.consent.dataLoss') }}</li>
              <li>{{ t('auth.consent.thirdParty') }}</li>
              <li>{{ t('auth.consent.changeTerms') }}</li>
              <li>{{ t('auth.consent.noLiability') }}</li>
              <li>{{ t('auth.consent.accountTermination') }}</li>
            </ul>
          </div>

          <label
            class="flex items-center gap-3 p-3 -mx-1 rounded-lg cursor-pointer select-none active:bg-muted/50 transition-colors"
            :class="shakeCheckbox && 'animate-shake ring-2 ring-warning'"
          >
            <UCheckbox v-model="agreeTerms" />
            <span class="text-sm font-medium">{{ t('consent.checkbox') }}</span>
          </label>

          <UButton
            block
            :label="t('auth.registerNext')"
            icon="i-lucide-arrow-right"
            trailing
            @click="handleRegisterNext"
          />

          <p class="text-sm text-center text-muted">
            {{ t('auth.hasAccount') }}
            <button class="text-primary font-medium" @click="toggleMode">
              {{ t('auth.signInLink') }}
            </button>
          </p>
        </div>
      </UCard>

      <!-- Step 2: Choose method -->
      <UCard v-if="mode === 'register' && registerStep === 2">
        <div class="space-y-4">
          <h2 class="text-lg font-semibold text-center text-highlighted">
            {{ t('auth.register') }}
          </h2>

          <UButton
            block
            variant="outline"
            icon="i-simple-icons-google"
            :label="t('auth.signUpWithGoogle')"
            :loading="googleLoading"
            @click="handleGoogleSignUp"
          />

          <p class="flex items-start gap-1.5 text-xs text-amber-500">
            <UIcon name="i-lucide-triangle-alert" class="size-3.5 shrink-0 mt-0.5" />
            <span>{{ t('auth.lineWarning') }}</span>
          </p>

          <USeparator label="or" />

          <form class="space-y-3" @submit.prevent="handleSubmit">
            <UFormField :label="t('auth.name')">
              <UInput
                v-model="form.name"
                :placeholder="t('auth.namePlaceholder')"
                required
                class="w-full"
              />
            </UFormField>

            <UFormField :label="t('auth.email')">
              <UInput
                v-model="form.email"
                type="email"
                :placeholder="t('auth.emailPlaceholder')"
                required
                class="w-full"
              />
            </UFormField>

            <UFormField :label="t('auth.password')">
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

            <!-- Password rules hint -->
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
              :label="t('auth.register')"
            />
          </form>

          <div class="flex items-center justify-between text-sm text-muted">
            <button class="flex items-center gap-1 hover:text-highlighted transition-colors" @click="registerStep = 1">
              <UIcon name="i-lucide-arrow-left" class="text-sm" />
              {{ t('onboarding.back') }}
            </button>
            <p>
              {{ t('auth.hasAccount') }}
              <button class="text-primary font-medium" @click="toggleMode">
                {{ t('auth.signInLink') }}
              </button>
            </p>
          </div>
        </div>
      </UCard>

      <div class="text-center">
        <LanguageToggle />
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
