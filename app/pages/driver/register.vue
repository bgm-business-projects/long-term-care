<script setup lang="ts">
definePageMeta({ layout: false })

const { signUpWithEmail } = useAuth()

const form = reactive({ name: '', email: '', password: '', confirmPassword: '' })
const error = ref('')
const loading = ref(false)

async function handleSubmit() {
  error.value = ''

  if (!form.name.trim()) {
    error.value = '請輸入姓名'
    return
  }
  if (form.password.length < 8) {
    error.value = '密碼至少需 8 字元'
    return
  }
  if (form.password !== form.confirmPassword) {
    error.value = '兩次密碼不一致'
    return
  }

  loading.value = true
  try {
    await signUpWithEmail(form.name, form.email, form.password)
    navigateTo('/driver/onboarding')
  } catch (err: any) {
    const code = err?.code || ''
    if (code === 'EMAIL_EXISTS') {
      error.value = '此 Email 已註冊，請改至司機登入頁'
    } else if (code === 'PASSWORD_TOO_SHORT') {
      error.value = '密碼太短'
    } else if (code === 'INVALID_EMAIL') {
      error.value = 'Email 格式不正確'
    } else {
      error.value = '註冊失敗，請稍後再試'
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-start justify-center bg-default px-4 pt-[8vh]">
    <div class="w-full max-w-sm space-y-6">
      <div class="text-center space-y-2">
        <img src="/logo.png" alt="BGMx長照派車" class="w-16 h-16 mx-auto rounded-xl" />
        <h1 class="text-2xl font-bold text-highlighted">司機註冊</h1>
        <p class="text-sm text-muted">建立帳號後請填寫司機與車輛資料以送審</p>
      </div>

      <UCard>
        <form class="space-y-3" @submit.prevent="handleSubmit">
          <UFormField label="姓名">
            <UInput v-model="form.name" placeholder="王小明" required class="w-full" />
          </UFormField>
          <UFormField label="電子信箱">
            <UInput v-model="form.email" type="email" placeholder="name@example.com" required autocomplete="email" class="w-full" />
          </UFormField>
          <UFormField label="密碼">
            <UInput v-model="form.password" type="password" placeholder="至少 8 字元" required autocomplete="new-password" class="w-full" />
          </UFormField>
          <UFormField label="確認密碼">
            <UInput v-model="form.confirmPassword" type="password" required autocomplete="new-password" class="w-full" />
          </UFormField>

          <p v-if="error" class="text-sm text-red-500 text-center">{{ error }}</p>

          <UButton type="submit" block :loading="loading" label="建立帳號" />
        </form>
      </UCard>

      <div class="flex justify-center gap-4 text-xs text-muted">
        <NuxtLink to="/driver/login" class="text-primary hover:underline">已有帳號？登入</NuxtLink>
      </div>
    </div>
  </div>
</template>
