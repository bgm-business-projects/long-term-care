<script setup lang="ts">
import { CalendarDate, today as todayFn, getLocalTimeZone } from '@internationalized/date'
import type { DateRange, DateValue } from 'reka-ui'

interface Props {
  modelValue: { from: string; to: string }
}

const props = defineProps<Props>()
const emit = defineEmits<{ 'update:modelValue': [value: { from: string; to: string }] }>()

const tz = getLocalTimeZone()

function toISO(d: DateValue): string {
  return `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`
}

function fromISO(s: string): DateValue | null {
  if (!s) return null
  const parts = s.split('-').map(Number)
  if (parts.length !== 3 || parts.some(n => Number.isNaN(n))) return null
  return new CalendarDate(parts[0]!, parts[1]!, parts[2]!) as unknown as DateValue
}

const range = computed<DateRange | null>({
  get() {
    const start = fromISO(props.modelValue.from)
    const end = fromISO(props.modelValue.to)
    return start && end ? { start, end } : null
  },
  set(v) {
    if (!v || !v.start || !v.end) return
    emit('update:modelValue', { from: toISO(v.start), to: toISO(v.end) })
  },
})

const label = computed(() => {
  const r = range.value
  if (!r || !r.start || !r.end) return '選擇日期區間'
  const from = toISO(r.start)
  const to = toISO(r.end)
  return from === to ? from : `${from} ~ ${to}`
})

type Preset = 'today' | 'week' | 'lastWeek' | 'nextWeek' | 'month' | 'lastMonth' | 'nextMonth'

function weekStart(date: CalendarDate): CalendarDate {
  // 週一為起始
  const dow = date.toDate(tz).getDay() || 7
  return date.subtract({ days: dow - 1 })
}

function presetRange(preset: Preset): { start: CalendarDate; end: CalendarDate } {
  const now = todayFn(tz)
  if (preset === 'today') return { start: now, end: now }
  if (preset === 'week') {
    const s = weekStart(now)
    return { start: s, end: s.add({ days: 6 }) }
  }
  if (preset === 'lastWeek') {
    const s = weekStart(now).subtract({ days: 7 })
    return { start: s, end: s.add({ days: 6 }) }
  }
  if (preset === 'nextWeek') {
    const s = weekStart(now).add({ days: 7 })
    return { start: s, end: s.add({ days: 6 }) }
  }
  if (preset === 'month') {
    const s = now.set({ day: 1 })
    return { start: s, end: s.add({ months: 1 }).subtract({ days: 1 }) }
  }
  if (preset === 'lastMonth') {
    const s = now.set({ day: 1 }).subtract({ months: 1 })
    return { start: s, end: s.add({ months: 1 }).subtract({ days: 1 }) }
  }
  const s = now.set({ day: 1 }).add({ months: 1 })
  return { start: s, end: s.add({ months: 1 }).subtract({ days: 1 }) }
}

function setPreset(preset: Preset) {
  const { start, end } = presetRange(preset)
  emit('update:modelValue', {
    from: toISO(start as unknown as DateValue),
    to: toISO(end as unknown as DateValue),
  })
}

// 比對當前 range 與 preset 是否一致以決定 active 樣式
const activePreset = computed<Preset | null>(() => {
  const presets: Preset[] = ['today', 'lastWeek', 'week', 'nextWeek', 'lastMonth', 'month', 'nextMonth']
  for (const p of presets) {
    const { start, end } = presetRange(p)
    if (toISO(start as unknown as DateValue) === props.modelValue.from
      && toISO(end as unknown as DateValue) === props.modelValue.to) {
      return p
    }
  }
  return null
})
</script>

<template>
  <UPopover>
    <UButton icon="i-lucide-calendar-days" color="neutral" variant="outline">
      {{ label }}
    </UButton>
    <template #content>
      <div class="flex gap-4 p-4">
        <div class="flex flex-col gap-1 border-r pr-3 min-w-22">
          <p class="text-xs text-muted px-2 mb-1">快捷</p>
          <UButton size="xs" :variant="activePreset === 'today' ? 'soft' : 'ghost'" :color="activePreset === 'today' ? 'primary' : 'neutral'" @click="setPreset('today')">今日</UButton>
          <UButton size="xs" :variant="activePreset === 'lastWeek' ? 'soft' : 'ghost'" :color="activePreset === 'lastWeek' ? 'primary' : 'neutral'" @click="setPreset('lastWeek')">上週</UButton>
          <UButton size="xs" :variant="activePreset === 'week' ? 'soft' : 'ghost'" :color="activePreset === 'week' ? 'primary' : 'neutral'" @click="setPreset('week')">本週</UButton>
          <UButton size="xs" :variant="activePreset === 'nextWeek' ? 'soft' : 'ghost'" :color="activePreset === 'nextWeek' ? 'primary' : 'neutral'" @click="setPreset('nextWeek')">下週</UButton>
          <UButton size="xs" :variant="activePreset === 'lastMonth' ? 'soft' : 'ghost'" :color="activePreset === 'lastMonth' ? 'primary' : 'neutral'" @click="setPreset('lastMonth')">上個月</UButton>
          <UButton size="xs" :variant="activePreset === 'month' ? 'soft' : 'ghost'" :color="activePreset === 'month' ? 'primary' : 'neutral'" @click="setPreset('month')">本月</UButton>
          <UButton size="xs" :variant="activePreset === 'nextMonth' ? 'soft' : 'ghost'" :color="activePreset === 'nextMonth' ? 'primary' : 'neutral'" @click="setPreset('nextMonth')">下個月</UButton>
        </div>
        <UCalendar v-model="range" range :number-of-months="2" class="drp-calendar" />
      </div>
    </template>
  </UPopover>
</template>

<style scoped>
/* 多月並列時隱藏跨月顯示的日，避免同一日在兩個面板都被選中 */
.drp-calendar :deep([data-outside-view]) {
  visibility: hidden;
  pointer-events: none;
}
</style>
