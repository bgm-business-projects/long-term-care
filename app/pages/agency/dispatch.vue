<script setup lang="ts">
const today = new Date().toLocaleDateString('sv-SE') // 使用本地時區的日期 (YYYY-MM-DD)
const selectedDate = ref(today)

function offsetDate(date: string, days: number): string {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}
</script>

<template>
  <div class="h-[calc(100vh-120px)] flex flex-col">
    <!-- 日期選擇 -->
    <div class="flex items-center gap-3 mb-4 shrink-0">
      <UButton
        icon="i-lucide-chevron-left"
        variant="ghost"
        size="sm"
        @click="selectedDate = offsetDate(selectedDate, -1)"
      />
      <input
        type="date"
        v-model="selectedDate"
        class="border border-default rounded-md px-3 py-1.5 text-sm"
      />
      <UButton
        icon="i-lucide-chevron-right"
        variant="ghost"
        size="sm"
        @click="selectedDate = offsetDate(selectedDate, 1)"
      />
      <UButton
        size="sm"
        variant="ghost"
        @click="selectedDate = today"
      >今天</UButton>
    </div>

    <!-- 甘特圖 -->
    <ClientOnly>
      <GanttBoard :date="selectedDate" class="flex-1 overflow-hidden" />
      <template #fallback>
        <div class="flex-1 flex items-center justify-center text-muted">
          載入中...
        </div>
      </template>
    </ClientOnly>
  </div>
</template>
