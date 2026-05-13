<script setup lang="ts">
const props = defineProps<{ trips: any[] }>()
const emit = defineEmits<{
  'drag-start': [trip: any]
  'trip-click': [trip: any]
  'auto-assign': [trip: any]
  'manual-carpool': [tripIds: string[]]
}>()

function formatTime(dt: string) {
  return new Date(dt).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })
}

function hasReturn(trip: any): boolean {
  return trip.tripDirection === 'outbound' && !!trip.pairedTripId
}

function handleAutoAssign() {
  if (props.trips.length === 0) return
  emit('auto-assign', props.trips[0])
}

// 多選模式
const selectMode = ref(false)
const selectedIds = ref<Set<string>>(new Set())

function toggleSelect(id: string) {
  if (selectedIds.value.has(id)) selectedIds.value.delete(id)
  else selectedIds.value.add(id)
  selectedIds.value = new Set(selectedIds.value) // trigger reactivity
}

function clearSelection() {
  selectedIds.value = new Set()
  selectMode.value = false
}

function handleManualCarpool() {
  if (selectedIds.value.size < 2) return
  emit('manual-carpool', Array.from(selectedIds.value))
  clearSelection()
}
</script>

<template>
  <div class="h-full flex flex-col">
    <h3 class="font-semibold text-sm mb-2 flex items-center gap-1">
      <UIcon name="i-lucide-inbox" />
      待派訂單池
      <UBadge v-if="trips.length" :label="String(trips.length)" size="xs" color="warning" />
    </h3>

    <template v-if="!selectMode">
      <UButton
        v-if="trips.length > 0"
        icon="i-lucide-wand-sparkles"
        color="primary"
        size="xs"
        block
        class="mb-1.5"
        @click="handleAutoAssign"
      >
        一鍵排班
      </UButton>
      <UButton
        v-if="trips.length > 1"
        icon="i-lucide-users"
        color="neutral"
        variant="outline"
        size="xs"
        block
        class="mb-2"
        @click="selectMode = true"
      >
        手動建立共乘
      </UButton>
    </template>

    <template v-else>
      <div class="mb-2 space-y-1.5">
        <p class="text-xs text-muted">已選 {{ selectedIds.size }} 筆（至少 2 筆）</p>
        <div class="flex gap-1.5">
          <UButton
            size="xs"
            color="primary"
            :disabled="selectedIds.size < 2"
            icon="i-lucide-check"
            class="flex-1"
            @click="handleManualCarpool"
          >建立共乘</UButton>
          <UButton size="xs" color="neutral" variant="outline" icon="i-lucide-x" @click="clearSelection" />
        </div>
      </div>
    </template>

    <div class="flex-1 overflow-y-auto space-y-2">
      <div
        v-for="(trip, i) in trips"
        :key="trip.id"
        class="border rounded-md p-2 transition-colors select-none"
        :class="[
          selectMode
            ? (selectedIds.has(trip.id) ? 'border-primary bg-primary/10' : 'border-default hover:bg-default/30 cursor-pointer')
            : (i === 0 ? 'border-primary bg-primary/5 hover:bg-primary/10 cursor-grab' : 'border-dashed border-warning bg-warning/5 hover:bg-warning/10 cursor-grab'),
        ]"
        :draggable="!selectMode"
        @dragstart="!selectMode && emit('drag-start', trip)"
        @click="selectMode ? toggleSelect(trip.id) : emit('trip-click', trip)"
      >
        <div class="flex items-start gap-1.5">
          <UCheckbox
            v-if="selectMode"
            :model-value="selectedIds.has(trip.id)"
            class="mt-0.5"
            @update:model-value="toggleSelect(trip.id)"
            @click.stop
          />
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between gap-1">
              <p class="text-xs font-semibold truncate flex items-center gap-1">
                <UIcon v-if="trip.tripDirection === 'outbound'" name="i-lucide-arrow-right" class="text-purple-600 shrink-0" />
                <UIcon v-else-if="trip.tripDirection === 'return'" name="i-lucide-arrow-left" class="text-purple-600 shrink-0" />
                {{ trip.careRecipientName }}
              </p>
              <span v-if="trip.organizationName" class="text-xs text-muted shrink-0">{{ trip.organizationName }}</span>
            </div>
            <p class="text-xs text-muted">{{ formatTime(trip.scheduledAt) }}</p>
            <p class="text-xs text-muted truncate">→ {{ trip.destinationAddress }}</p>
            <div class="flex items-center gap-1 mt-1 flex-wrap">
              <UBadge v-if="trip.needsWheelchair" label="輪椅" size="xs" color="info" />
              <UBadge v-if="trip.tripDirection === 'outbound'" label="去程" size="xs" color="primary" variant="subtle" />
              <UBadge v-else-if="trip.tripDirection === 'return'" label="回程" size="xs" color="warning" variant="subtle" />
              <UBadge
                v-if="hasReturn(trip) && trip.pairedScheduledAt"
                :label="`有回程 ${formatTime(trip.pairedScheduledAt)}`"
                size="xs"
                color="warning"
                variant="soft"
                icon="i-lucide-undo-2"
              />
            </div>
          </div>
        </div>
      </div>
      <div v-if="trips.length === 0" class="text-center text-muted text-xs py-8">
        無待派訂單
      </div>
    </div>
  </div>
</template>
