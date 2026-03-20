<script setup lang="ts">
const props = defineProps<{ cellMinutes: number; totalCells: number }>()

const GANTT_START = 6 * 60

const cells = computed(() => {
  const items = []
  for (let i = 0; i < props.totalCells; i++) {
    const minutes = GANTT_START + i * props.cellMinutes
    const isHour = minutes % 60 === 0
    const label = isHour ? `${Math.floor(minutes / 60).toString().padStart(2, '0')}:00` : ''
    items.push({ i, label, isHour })
  }
  return items
})
</script>

<template>
  <div
    class="grid border-b border-default bg-default/50 sticky top-0 z-10"
    :style="`grid-template-columns: 120px repeat(${totalCells}, minmax(28px, 1fr))`"
  >
    <div class="px-2 py-1.5 text-xs font-medium text-muted sticky left-0 bg-white dark:bg-gray-900 border-r border-default">車輛</div>
    <div
      v-for="cell in cells"
      :key="cell.i"
      class="text-xs text-muted py-1.5 pl-1"
      :class="[
        'border-r border-default/30',
        cell.isHour ? 'border-l-2 border-l-black dark:border-l-white' : '',
      ]"
      :style="`grid-column: ${cell.i + 2}`"
    >{{ cell.label }}</div>
  </div>
</template>
