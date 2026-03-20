<script setup lang="ts">
const { api } = useApi()

const today = new Date().toLocaleDateString('sv-SE')
const selectedDate = ref(today)
const calendarOpen = ref(false)

// Calendar view state
const calendarViewDate = ref(new Date())

// Pending dates: { date, noVehicle, noDriver }
const pendingDates = ref<{ date: string; noVehicle: number; noDriver: number }[]>([])

async function loadPendingDates() {
  try {
    pendingDates.value = await api<{ date: string; noVehicle: number; noDriver: number }[]>(
      '/api/dispatch/schedule/pending-dates'
    )
  } catch {
    pendingDates.value = []
  }
}

onMounted(loadPendingDates)

// ── Calendar helpers ──────────────────────────────────────

const weekdays = ['日', '一', '二', '三', '四', '五', '六']

const calendarTitle = computed(() => {
  return calendarViewDate.value.toLocaleDateString('zh-TW', { year: 'numeric', month: 'long' })
})

const firstDayOffset = computed(() => {
  const d = new Date(calendarViewDate.value.getFullYear(), calendarViewDate.value.getMonth(), 1)
  return d.getDay()
})

const daysInMonth = computed(() => {
  return new Date(
    calendarViewDate.value.getFullYear(),
    calendarViewDate.value.getMonth() + 1,
    0
  ).getDate()
})

function prevMonth() {
  const d = new Date(calendarViewDate.value)
  d.setMonth(d.getMonth() - 1)
  calendarViewDate.value = d
}

function nextMonth() {
  const d = new Date(calendarViewDate.value)
  d.setMonth(d.getMonth() + 1)
  calendarViewDate.value = d
}

function dayToDateStr(day: number): string {
  const y = calendarViewDate.value.getFullYear()
  const m = String(calendarViewDate.value.getMonth() + 1).padStart(2, '0')
  const d = String(day).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function pendingForDay(day: number) {
  return pendingDates.value.find(p => p.date === dayToDateStr(day)) ?? null
}

function selectDay(day: number) {
  selectedDate.value = dayToDateStr(day)
  calendarOpen.value = false
}

function isSelectedDay(day: number): boolean {
  return dayToDateStr(day) === selectedDate.value
}

function isToday(day: number): boolean {
  return dayToDateStr(day) === today
}

function dayClass(day: number) {
  if (isSelectedDay(day)) return 'bg-primary text-white font-semibold'
  if (isToday(day)) return 'border border-primary text-primary font-medium hover:bg-primary/10'
  return 'hover:bg-muted text-default'
}

// ── Date display ──────────────────────────────────────────

function formatSelectedDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' })
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit', weekday: 'short' })
}

function offsetDate(date: string, days: number): string {
  const d = new Date(date + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d.toLocaleDateString('sv-SE')
}

// Sync calendar view month when selectedDate changes
watch(selectedDate, (val) => {
  const d = new Date(val + 'T00:00:00')
  calendarViewDate.value = new Date(d.getFullYear(), d.getMonth(), 1)
})

// Sync calendar view month when popover opens
watch(calendarOpen, (open) => {
  if (open) {
    const d = new Date(selectedDate.value + 'T00:00:00')
    calendarViewDate.value = new Date(d.getFullYear(), d.getMonth(), 1)
  }
})

// 快捷鍵清單：有任何待處理的日期
const allPendingDates = computed(() =>
  pendingDates.value.filter(p => p.noVehicle > 0 || p.noDriver > 0)
)
</script>

<template>
  <div class="h-[calc(100vh-120px)] flex flex-col">
    <!-- 日期選擇列 -->
    <div class="flex items-center gap-2 mb-3 shrink-0 flex-wrap">
      <!-- 前後切換 -->
      <UButton
        icon="i-lucide-chevron-left"
        variant="ghost"
        size="sm"
        @click="selectedDate = offsetDate(selectedDate, -1)"
      />

      <!-- 月曆 Popover -->
      <UPopover v-model:open="calendarOpen">
        <UButton
          variant="outline"
          size="sm"
          icon="i-lucide-calendar"
          trailing-icon="i-lucide-chevron-down"
        >{{ formatSelectedDate(selectedDate) }}</UButton>

        <template #content>
          <div class="p-3 w-72 select-none">
            <!-- 月份切換 -->
            <div class="flex items-center justify-between mb-3">
              <UButton icon="i-lucide-chevron-left" variant="ghost" size="xs" @click="prevMonth" />
              <span class="text-sm font-semibold">{{ calendarTitle }}</span>
              <UButton icon="i-lucide-chevron-right" variant="ghost" size="xs" @click="nextMonth" />
            </div>

            <!-- 星期表頭 -->
            <div class="grid grid-cols-7 text-center mb-1">
              <span v-for="wd in weekdays" :key="wd" class="text-xs text-muted py-1">{{ wd }}</span>
            </div>

            <!-- 日期格子 -->
            <div class="grid grid-cols-7 gap-y-0.5">
              <span v-for="n in firstDayOffset" :key="'e-' + n" />
              <button
                v-for="day in daysInMonth"
                :key="day"
                class="relative h-8 w-8 mx-auto rounded-full text-sm flex items-center justify-center transition-colors"
                :class="dayClass(day)"
                @click="selectDay(day)"
              >
                {{ day }}
                <!-- 待處理小點：左=待派車輛（橘），右=待排司機（紫） -->
                <span
                  v-if="pendingForDay(day)"
                  class="absolute bottom-0.5 left-1/2 -translate-x-1/2 flex gap-0.5"
                >
                  <span
                    v-if="pendingForDay(day)!.noVehicle > 0"
                    class="w-1.5 h-1.5 rounded-full"
                    :class="isSelectedDay(day) ? 'bg-white/80' : 'bg-warning'"
                  />
                  <span
                    v-if="pendingForDay(day)!.noDriver > 0"
                    class="w-1.5 h-1.5 rounded-full"
                    :class="isSelectedDay(day) ? 'bg-white/80' : 'bg-purple-400'"
                  />
                </span>
              </button>
            </div>

            <!-- 月曆底部圖例 -->
            <div class="mt-3 pt-2 border-t border-default flex items-center gap-3 text-xs text-muted flex-wrap">
              <span class="flex items-center gap-1">
                <span class="w-1.5 h-1.5 rounded-full bg-warning inline-block" />
                待派車輛
              </span>
              <span class="flex items-center gap-1">
                <span class="w-1.5 h-1.5 rounded-full bg-purple-400 inline-block" />
                待排司機
              </span>
              <UButton size="xs" variant="ghost" class="ml-auto" @click="selectedDate = today; calendarOpen = false">
                回到今天
              </UButton>
            </div>
          </div>
        </template>
      </UPopover>

      <UButton
        icon="i-lucide-chevron-right"
        variant="ghost"
        size="sm"
        @click="selectedDate = offsetDate(selectedDate, 1)"
      />

      <!-- 待處理日期快捷鍵 -->
      <template v-if="allPendingDates.length > 0">
        <div class="w-px h-5 bg-default mx-1 shrink-0" />
        <div class="flex items-center gap-1.5 overflow-x-auto">
          <span class="text-xs text-muted shrink-0">待處理：</span>
          <button
            v-for="pd in allPendingDates"
            :key="pd.date"
            class="shrink-0 px-2.5 py-1 rounded-full text-xs border transition-colors whitespace-nowrap flex items-center gap-1"
            :class="selectedDate === pd.date
              ? 'bg-default border-default text-highlighted font-medium'
              : 'border-default hover:bg-muted text-muted'"
            @click="selectedDate = pd.date"
          >
            {{ formatShortDate(pd.date) }}
            <span v-if="pd.noVehicle > 0" class="flex items-center gap-0.5 text-warning">
              <span class="w-1.5 h-1.5 rounded-full bg-warning inline-block" />{{ pd.noVehicle }}
            </span>
            <span v-if="pd.noDriver > 0" class="flex items-center gap-0.5 text-purple-400">
              <span class="w-1.5 h-1.5 rounded-full bg-purple-400 inline-block" />{{ pd.noDriver }}
            </span>
          </button>
        </div>
      </template>
    </div>

    <!-- 甘特圖 -->
    <ClientOnly>
      <GanttBoard :date="selectedDate" class="flex-1 overflow-hidden" @refresh="loadPendingDates" />
      <template #fallback>
        <div class="flex-1 flex items-center justify-center text-muted">
          載入中...
        </div>
      </template>
    </ClientOnly>
  </div>
</template>
