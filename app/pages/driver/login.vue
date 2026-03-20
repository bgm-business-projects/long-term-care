<script setup lang="ts">
definePageMeta({ layout: false })

const { signInWithEmail, signOut, user } = useAuth()

const form = reactive({ email: '', password: '' })
const error = ref('')
const loading = ref(false)

async function handleSubmit() {
  error.value = ''
  loading.value = true
  try {
    await signInWithEmail(form.email, form.password)
    const role = (user.value as any)?.role ?? ''
    if (role !== 'driver') {
      await signOut()
      error.value = '您沒有此後台的存取權限，請聯絡管理員'
      return
    }
    navigateTo('/driver')
  } catch (err: any) {
    const code = err?.code || ''
    if (code === 'INVALID_CREDENTIALS') {
      error.value = '帳號或密碼錯誤'
    } else {
      error.value = '登入失敗，請稍後再試'
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-start justify-center bg-default px-4 pt-[10vh]">
    <div class="w-full max-w-sm space-y-6">
      <div class="text-center space-y-2">
        <img src="/logo.png" alt="BGMx長照派車" class="w-16 h-16 mx-auto rounded-xl" />
        <h1 class="text-2xl font-bold text-highlighted" style="font-family: 'Montserrat', sans-serif;">
          BGM x 長照派車
        </h1>
        <p class="text-sm text-muted">司機後台登入</p>
      </div>

      <UCard>
        <div class="space-y:4">
          <h2 class="text-lg font-semibold text-center text-highlighted">司機登入</h2>

          <form class="space-y-3" @submit.prevent="handleSubmit">
            <UFormField label="電子信箱">
              <UInput
                v-model="form.email"
                type="email"
                placeholder="name@example.com"
                required
                autocomplete="username"
                class="w-full"
              />
            </UFormField>

            <UFormField label="密碼">
              <UInput
                v-model="form.password"
                type="password"
                placeholder="請輸入密碼"
                required
                autocomplete="current-password"
                class="w-full"
              />
            </UFormField>

            <div class="flex justify-end">
              <NuxtLink to="/forgot-password" class="text-sm text-primary hover:underline">
                忘記密碼？
              </NuxtLink>
            </div>

            <p v-if="error" class="text-sm text-red-500 text-center">{{ error }}</p>

            <UButton type="submit" block :loading="loading" label="登入" />
          </form>
        </div>
      </UCard>

      <div class="flex justify-center gap-4 text-xs text-muted">
        <NuxtLink to="/admin/login" class="text-primary hover:underline">管理員登入</NuxtLink>
        <span>·</span>
        <NuxtLink to="/agency/login" class="text-primary hover:underline">機構人員登入</NuxtLink>
      </div>
    </div>
  </div>
</template>
