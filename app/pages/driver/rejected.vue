<script setup lang="ts">
definePageMeta({ layout: false })

const { signOut } = useAuth()
const { api } = useApi()

interface ApplicationStatus {
  hasApplication: boolean
  approvalStatus: 'pending' | 'approved' | 'rejected' | null
  rejectionReason?: string | null
}

const status = ref<ApplicationStatus | null>(null)

async function load() {
  status.value = await api<ApplicationStatus>('/api/driver/me/application').catch(() => null)
}

onMounted(load)
</script>

<template>
  <div class="min-h-screen bg-default flex items-center justify-center px-4">
    <UCard class="max-w-md w-full text-center">
      <div class="space-y-4 py-4">
        <div class="text-5xl">⚠️</div>
        <h1 class="text-xl font-bold text-highlighted">申請未通過</h1>
        <p v-if="status?.rejectionReason" class="text-sm text-muted whitespace-pre-line">
          原因：{{ status.rejectionReason }}
        </p>
        <p v-else class="text-sm text-muted">
          您的司機申請未通過審核，您可以修正後重新提交。
        </p>
        <div class="flex flex-col gap-2 pt-2">
          <UButton block label="修改後重新申請" to="/driver/onboarding" />
          <UButton color="neutral" variant="ghost" label="登出" @click="signOut" />
        </div>
      </div>
    </UCard>
  </div>
</template>
