<script setup lang="ts">
const props = defineProps<{
  vehicle: any
  cellMinutes: number
  totalCells: number
}>()

const { draggingTrip, datetimeToMinutes, onDrop, onTripClick } = inject('ganttState') as any
const hoveredCell = ref<number | null>(null)
const tooltipX = ref(0)
const tooltipY = ref(0)
const rowRef = ref<HTMLElement | null>(null)
const GANTT_START = 6 * 60
const LABEL_WIDTH = 120

function isHourCell(cellIndex: number) {
  return (GANTT_START + cellIndex * props.cellMinutes) % 60 === 0
}

function cellToTime(cellIndex: number): string {
  const totalMin = GANTT_START + cellIndex * props.cellMinutes
  const h = Math.floor(totalMin / 60).toString().padStart(2, '0')
  const m = (totalMin % 60).toString().padStart(2, '0')
  return `${h}:${m}`
}

function getCellIndexFromEvent(e: DragEvent): number | null {
  if (!rowRef.value) return null
  const rect = rowRef.value.getBoundingClientRect()
  const x = e.clientX - rect.left - LABEL_WIDTH
  if (x < 0) return null
  const cellWidth = (rect.width - LABEL_WIDTH) / props.totalCells
  const idx = Math.floor(x / cellWidth)
  if (idx < 0 || idx >= props.totalCells) return null
  return idx
}

function getTripStyle(trip: any) {
  const startMin = datetimeToMinutes(trip.scheduledAt)
  const duration = trip.estimatedDuration || 60
  const startCol = Math.floor((startMin - GANTT_START) / props.cellMinutes) + 2
  const span = Math.max(1, Math.ceil(duration / props.cellMinutes))
  return {
    gridColumn: `${startCol} / span ${span}`,
    gridRow: '1',
    zIndex: 10,
    alignSelf: 'stretch',
    margin: '4px 1px',
  }
}

function onTripDragStart(trip: any) {
  draggingTrip.value = trip
}

function onRowDragOver(e: DragEvent) {
  e.preventDefault()
  const idx = getCellIndexFromEvent(e)
  hoveredCell.value = idx
  tooltipX.value = e.clientX
  tooltipY.value = e.clientY
}

function onRowDragLeave(e: DragEvent) {
  // 只有真正離開 row 時才清除（避免子元素觸發 dragleave）
  if (!rowRef.value?.contains(e.relatedTarget as Node)) {
    hoveredCell.value = null
  }
}

function onRowDrop(e: DragEvent) {
  e.preventDefault()
  const idx = getCellIndexFromEvent(e)
  if (idx !== null) {
    const startMinutes = GANTT_START + idx * props.cellMinutes
    onDrop(props.vehicle.id, null, startMinutes)
  }
  hoveredCell.value = null
}
</script>

<template>
  <div
    ref="rowRef"
    class="grid border-b border-default hover:bg-default/30 group relative"
    :style="`grid-template-columns: 120px repeat(${totalCells}, minmax(28px, 1fr)); min-height: 52px`"
    @dragover="onRowDragOver"
    @dragleave="onRowDragLeave"
    @drop="onRowDrop"
  >
    <!-- 車輛標籤（固定左側） -->
    <div
      class="px-2 py-1.5 sticky left-0 bg-white dark:bg-gray-900 border-r border-default z-20 flex flex-col justify-center"
      style="grid-column: 1; grid-row: 1"
    >
      <p class="text-xs font-semibold">{{ vehicle.plate }}</p>
      <p class="text-xs text-muted">{{ vehicle.vehicleType }}</p>
    </div>

    <!-- 時間格（視覺用，不再處理 drag 事件） -->
    <div
      v-for="i in totalCells"
      :key="i"
      class="transition-colors pointer-events-none"
      :class="[
        hoveredCell === i - 1 && draggingTrip ? 'bg-primary/15' : '',
        'border-r border-default/30',
        isHourCell(i - 1) ? 'border-l-2 border-l-black dark:border-l-white' : '',
      ]"
      :style="`grid-column: ${i + 1}; grid-row: 1; z-index: 1`"
    />

    <!-- 行程色塊 -->
    <div
      v-for="trip in vehicle.trips"
      :key="trip.id"
      class="rounded flex items-center gap-1 px-1.5 text-xs font-medium cursor-grab select-none overflow-hidden pointer-events-auto relative"
      :class="{
        'bg-blue-100 text-blue-800 border border-blue-200': trip.status === 'assigned' && trip.driverUserId,
        'bg-blue-100 text-blue-800 border-2 border-dashed border-warning': trip.status === 'assigned' && !trip.driverUserId,
        'bg-green-100 text-green-800 border border-green-200': trip.status === 'in_progress' && trip.driverUserId,
        'bg-green-100 text-green-800 border-2 border-dashed border-warning': trip.status === 'in_progress' && !trip.driverUserId,
        'bg-gray-100 text-gray-600 border border-gray-200': trip.status === 'completed',
        'bg-red-100 text-red-800 border border-red-200': trip.status === 'cancelled',
      }"
      :style="getTripStyle(trip)"
      draggable="true"
      @dragstart.stop="onTripDragStart(trip)"
      @dragend="draggingTrip = null"
      @click.stop="onTripClick(trip)"
      :title="!trip.driverUserId
        ? `⚠ 未排司機 | ${trip.careRecipientName} | ${trip.originAddress} → ${trip.destinationAddress}`
        : `${trip.careRecipientName} | ${trip.originAddress} → ${trip.destinationAddress}`"
    >
      <UIcon
        v-if="!trip.driverUserId && trip.status !== 'completed' && trip.status !== 'cancelled'"
        name="i-lucide-user-x"
        class="shrink-0 text-warning"
      />
      <span class="truncate">{{ trip.careRecipientName }}</span>
    </div>
  </div>

  <!-- Tooltip teleport 到 body -->
  <Teleport to="body">
    <div
      v-if="hoveredCell !== null && draggingTrip"
      class="fixed pointer-events-none z-9999 bg-gray-900 text-white text-xs font-medium px-2 py-1 rounded shadow-lg"
      :style="{ left: `${tooltipX + 12}px`, top: `${tooltipY - 28}px` }"
    >
      {{ cellToTime(hoveredCell) }}
    </div>
  </Teleport>
</template>
