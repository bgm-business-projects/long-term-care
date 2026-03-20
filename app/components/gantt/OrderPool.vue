<script setup lang="ts">
const props = defineProps<{ trips: any[] }>()
const emit = defineEmits(['drag-start', 'trip-click'])

function getStatusLabel(status: string) {
  const map: Record<string, string> = { pending: '待派', assigned: '已派', in_progress: '進行中' }
  return map[status] || status
}

function formatTime(dt: string) {
  return new Date(dt).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <div class="h-full flex flex-col">
    <h3 class="font-semibold text-sm mb-2 flex items-center gap-1">
      <UIcon name="i-lucide-inbox" />
      待派訂單池
      <UBadge v-if="trips.length" :label="String(trips.length)" size="xs" color="warning" />
    </h3>
    <div class="flex-1 overflow-y-auto space-y-2">
      <div
        v-for="trip in trips"
        :key="trip.id"
        class="border border-dashed border-warning rounded-md p-2 cursor-grab bg-warning/5 hover:bg-warning/10 transition-colors select-none"
        draggable="true"
        @dragstart="emit('drag-start', trip)"
        @click="emit('trip-click', trip)"
      >
        <div class="flex items-center justify-between gap-1">
          <p class="text-xs font-semibold truncate">{{ trip.careRecipientName }}</p>
          <span v-if="trip.organizationName" class="text-xs text-muted shrink-0">{{ trip.organizationName }}</span>
        </div>
        <p class="text-xs text-muted">{{ formatTime(trip.scheduledAt) }}</p>
        <p class="text-xs text-muted truncate">→ {{ trip.destinationAddress }}</p>
        <UBadge v-if="trip.needsWheelchair" label="輪椅" size="xs" color="info" class="mt-1" />
      </div>
      <div v-if="trips.length === 0" class="text-center text-muted text-xs py-8">
        無待派訂單
      </div>
    </div>
  </div>
</template>
