<template>
  <span :class="badgeClass" class="text-sm font-medium px-3 py-1 rounded-full">
    {{ label }}
  </span>
</template>

<script setup lang="ts">
const props = defineProps<{ status: string }>()

const CONFIG: Record<string, { label: string; class: string }> = {
  pending:     { label: '待派車', class: 'bg-gray-100 text-gray-600' },
  assigned:    { label: '已派車', class: 'bg-blue-100 text-blue-700' },
  in_progress: { label: '進行中', class: 'bg-yellow-100 text-yellow-700' },
  completed:   { label: '已完成', class: 'bg-green-100 text-green-700' },
  cancelled:   { label: '已取消', class: 'bg-red-100 text-red-600' },
}

const current = computed(() => CONFIG[props.status] ?? CONFIG.pending)
const label = computed(() => current.value.label)
const badgeClass = computed(() => current.value.class)
</script>
