<script setup lang="ts">
const { api } = useApi()
const notices = ref<any[]>([])
onMounted(async () => {
  notices.value = await api<any[]>('/api/driver/announcements')
})
</script>

<template>
  <div class="p-4 space-y-3">
    <h1 class="text-xl font-bold">公告通知</h1>
    <div v-for="n in notices" :key="n.id" class="border border-default rounded-xl p-4">
      <div class="flex items-start justify-between">
        <h3 class="font-semibold">{{ n.title }}</h3>
        <span class="text-xs text-muted">{{ new Date(n.publishedAt).toLocaleDateString('zh-TW') }}</span>
      </div>
      <p class="text-sm text-muted mt-2 whitespace-pre-line">{{ n.body }}</p>
    </div>
    <div v-if="notices.length === 0" class="text-center text-muted py-8">目前沒有公告</div>
  </div>
</template>
