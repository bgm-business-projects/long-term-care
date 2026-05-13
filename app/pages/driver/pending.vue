<script setup lang="ts">
definePageMeta({ layout: false })

const { signOut } = useAuth()
const { api } = useApi()

interface ApplicationStatus {
  hasApplication: boolean
  approvalStatus: 'pending' | 'approved' | 'rejected' | null
  rejectionReason?: string | null
  submittedAt?: string | Date | null
}

const status = ref<ApplicationStatus | null>(null)
const loading = ref(true)

async function load() {
  loading.value = true
  try {
    status.value = await api<ApplicationStatus>('/api/driver/me/application')
    if (status.value?.approvalStatus === 'approved') {
      navigateTo('/driver')
      return
    }
    if (status.value?.approvalStatus === 'rejected') {
      navigateTo('/driver/rejected')
      return
    }
    if (!status.value?.hasApplication) {
      navigateTo('/driver/onboarding')
    }
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="min-h-screen bg-default flex items-center justify-center px-4">
    <UCard class="max-w-md w-full text-center">
      <div v-if="loading" class="py-8 text-muted">載入中…</div>
      <div v-else class="space-y-4 py-4">
        <div class="text-5xl">⏳</div>
        <h1 class="text-xl font-bold text-highlighted">您的申請審核中</h1>
        <p class="text-sm text-muted">
          平台收到您的申請，將盡快審核您的證件與車輛資料。<br>
          審核完成後將會通知您。
        </p>
        <div v-if="status?.submittedAt" class="text-xs text-muted">
          送出時間：{{ new Date(status.submittedAt).toLocaleString('zh-TW') }}
        </div>
        <UButton color="neutral" variant="ghost" label="登出" @click="signOut" />
      </div>
    </UCard>
  </div>
</template>
