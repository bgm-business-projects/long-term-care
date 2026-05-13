<script setup lang="ts">
const props = defineProps<{
  driver: any
  cellMinutes: number
  totalCells: number
  cellMinWidth?: number
}>()
const cellWidthPx = computed(() => props.cellMinWidth ?? 32)

const { draggingTrip, datetimeToMinutes, onDrop, onTripClick, onCarpoolClick } = inject('ganttState') as any
const hoveredCell = ref<number | null>(null)
const tooltipX = ref(0)
const tooltipY = ref(0)
const rowRef = ref<HTMLElement | null>(null)
const GANTT_START = 6 * 60
const LABEL_WIDTH = 160
const LANE_HEIGHT = 36 // 每多一 lane 增加的高度
const BASE_HEIGHT = 56 // 單 lane 最小高度（容納司機標籤兩行字）

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
  if (!rowRef.value?.contains(e.relatedTarget as Node)) {
    hoveredCell.value = null
  }
}

function onRowDrop(e: DragEvent) {
  e.preventDefault()
  const idx = getCellIndexFromEvent(e)
  if (idx !== null) {
    const startMinutes = GANTT_START + idx * props.cellMinutes
    onDrop(props.driver.userId, startMinutes)
  }
  hoveredCell.value = null
}

// 過濾出非共乘 trips（個別渲染）
const soloTrips = computed(() => (props.driver.trips ?? []).filter((t: any) => !t.carpoolGroupId))
const carpools = computed(() => props.driver.carpools ?? [])

// ── 不重疊：把 solo trip + carpool 合併排版到不同 lane ────────────
type LaneItem = {
  kind: 'solo' | 'carpool'
  data: any
  startMs: number
  endMs: number
  lane: number
}

function getSoloRange(trip: any): { startMs: number; endMs: number } {
  const startMs = new Date(trip.scheduledAt).getTime()
  const duration = trip.estimatedDuration || 60
  return { startMs, endMs: startMs + duration * 60_000 }
}

function getCarpoolRange(c: any): { startMs: number; endMs: number } {
  const first = c.trips?.[0]
  const startMs = first?.carpoolPickupAt
    ? new Date(first.carpoolPickupAt).getTime()
    : new Date(c.scheduledAt).getTime()
  const endMs = c.scheduledEndAt
    ? new Date(c.scheduledEndAt).getTime()
    : startMs + 60 * 60_000
  return { startMs, endMs }
}

const laneItems = computed<LaneItem[]>(() => {
  const items: LaneItem[] = []
  for (const t of soloTrips.value) {
    const { startMs, endMs } = getSoloRange(t)
    items.push({ kind: 'solo', data: t, startMs, endMs, lane: 0 })
  }
  for (const c of carpools.value) {
    const { startMs, endMs } = getCarpoolRange(c)
    items.push({ kind: 'carpool', data: c, startMs, endMs, lane: 0 })
  }
  items.sort((a, b) => a.startMs - b.startMs)

  // greedy：找最早能塞下的 lane
  const laneEnds: number[] = []
  for (const it of items) {
    let placed = false
    for (let i = 0; i < laneEnds.length; i++) {
      if (laneEnds[i]! <= it.startMs) {
        it.lane = i
        laneEnds[i] = it.endMs
        placed = true
        break
      }
    }
    if (!placed) {
      it.lane = laneEnds.length
      laneEnds.push(it.endMs)
    }
  }
  return items
})

const laneCount = computed(() => Math.max(1, ...laneItems.value.map(i => i.lane + 1)))
const rowMinHeight = computed(() => Math.max(BASE_HEIGHT, laneCount.value * LANE_HEIGHT + 8))

function getItemStyle(item: LaneItem) {
  const startMin = datetimeToMinutes(new Date(item.startMs).toISOString())
  const durationMin = Math.max(15, Math.round((item.endMs - item.startMs) / 60_000))
  const startCol = Math.floor((startMin - GANTT_START) / props.cellMinutes) + 2
  const span = Math.max(1, Math.ceil(durationMin / props.cellMinutes))
  return {
    gridColumn: `${startCol} / span ${span}`,
    gridRow: `${item.lane + 1}`,
    zIndex: item.kind === 'carpool' ? 11 : 10,
    alignSelf: 'stretch',
    margin: '4px 1px',
  }
}
</script>

<template>
  <div
    ref="rowRef"
    class="grid border-b border-default hover:bg-default/30 group relative"
    :style="`grid-template-columns: 160px repeat(${totalCells}, ${cellWidthPx}px); grid-template-rows: repeat(${laneCount}, 1fr); min-height: ${rowMinHeight}px`"
    @dragover="onRowDragOver"
    @dragleave="onRowDragLeave"
    @drop="onRowDrop"
  >
    <!-- 司機標籤（跨所有 lane） -->
    <div
      class="px-2 py-1.5 sticky left-0 bg-white dark:bg-gray-900 border-r border-default z-20 flex flex-col justify-center gap-0.5"
      :style="`grid-column: 1; grid-row: 1 / span ${laneCount}`"
    >
      <div class="flex items-center gap-1.5 min-w-0">
        <p class="text-xs font-semibold truncate">{{ driver.name }}</p>
        <UBadge v-if="driver.fleet" :label="driver.fleet.name" color="primary" variant="subtle" size="xs" class="shrink-0" />
        <UBadge v-else label="獨立" color="neutral" variant="subtle" size="xs" class="shrink-0" />
      </div>
      <p v-if="driver.vehicle" class="text-xs text-muted truncate">
        {{ driver.vehicle.plate }} · {{ driver.vehicle.vehicleType }}
      </p>
      <p v-else class="text-xs text-error truncate">未綁定車輛</p>
    </div>

    <!-- 時間格背景（跨所有 lane） -->
    <div
      v-for="i in totalCells"
      :key="i"
      class="transition-colors pointer-events-none"
      :class="[
        hoveredCell === i - 1 && draggingTrip ? 'bg-primary/15' : '',
        'border-r border-default/30',
        isHourCell(i - 1) ? 'border-l-2 border-l-black dark:border-l-white' : '',
      ]"
      :style="`grid-column: ${i + 1}; grid-row: 1 / span ${laneCount}; z-index: 1`"
    />

    <!-- 行程（每個 item 一個 lane，不會重疊） -->
    <template v-for="item in laneItems" :key="item.kind + ':' + (item.data.id)">
      <!-- 個別行程 -->
      <div
        v-if="item.kind === 'solo'"
        class="rounded flex items-center gap-1 px-1.5 text-xs font-medium cursor-grab select-none overflow-hidden pointer-events-auto relative"
        :class="{
          'bg-blue-100 text-blue-800 border border-blue-200': item.data.status === 'assigned',
          'bg-green-100 text-green-800 border border-green-200': item.data.status === 'in_progress',
          'bg-gray-100 text-gray-600 border border-gray-200': item.data.status === 'completed',
          'bg-red-100 text-red-800 border border-red-200': item.data.status === 'cancelled',
        }"
        :style="getItemStyle(item)"
        draggable="true"
        :title="`${item.data.careRecipientName}${item.data.tripDirection === 'outbound' ? '（去）' : item.data.tripDirection === 'return' ? '（回）' : ''} | ${item.data.originAddress} → ${item.data.destinationAddress}${item.data.tripDirection === 'outbound' && item.data.pairedScheduledAt ? ` | 回程 ${new Date(item.data.pairedScheduledAt).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}` : ''}`"
        @dragstart.stop="onTripDragStart(item.data)"
        @dragend="draggingTrip = null"
        @click.stop="onTripClick(item.data)"
      >
        <UIcon v-if="item.data.needsWheelchair" name="i-lucide-armchair" class="shrink-0 text-info" />
        <UIcon v-if="item.data.tripDirection === 'outbound'" name="i-lucide-arrow-right" class="shrink-0 text-purple-600" />
        <UIcon v-else-if="item.data.tripDirection === 'return'" name="i-lucide-arrow-left" class="shrink-0 text-purple-600" />
        <span class="truncate">{{ item.data.careRecipientName }}</span>
        <UIcon
          v-if="item.data.tripDirection === 'outbound' && item.data.pairedTripId"
          name="i-lucide-undo-2"
          class="shrink-0 text-amber-600"
        />
      </div>

      <!-- 共乘合併框 -->
      <div
        v-else
        class="rounded-md flex items-center gap-1.5 px-2 text-xs font-medium cursor-pointer select-none overflow-hidden pointer-events-auto relative border-2 border-purple-500 bg-purple-100 text-purple-900 hover:bg-purple-200 transition-colors"
        :style="getItemStyle(item)"
        :title="`共乘 ${item.data.trips.length} 人 → ${item.data.destinationAddress}${item.data.hasReturn ? '（含回程）' : ''}`"
        @click.stop="onCarpoolClick && onCarpoolClick(item.data)"
      >
        <UIcon name="i-lucide-users" class="shrink-0" />
        <span class="font-bold">{{ item.data.trips.length }}人</span>
        <span class="truncate text-purple-700">
          {{ item.data.trips.map((t: any) => t.careRecipientName).filter(Boolean).join('、') }}
        </span>
        <UIcon
          v-if="item.data.hasReturn"
          name="i-lucide-undo-2"
          class="shrink-0 text-amber-600"
        />
      </div>
    </template>
  </div>

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
