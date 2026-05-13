<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header -->
    <div class="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-10">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">司機任務</h1>
          <p class="text-base text-gray-500 mt-0.5">{{ dateLabel }}</p>
        </div>
        <div class="flex items-center gap-2">
          <UButton
            icon="i-lucide-history"
            color="neutral"
            variant="ghost"
            size="lg"
            to="/driver/history"
            aria-label="歷史記錄"
          />
          <UDropdownMenu
            :items="[
              [{ label: driverName, disabled: true, icon: 'i-lucide-user-circle' }],
              [{ label: '我的資料', icon: 'i-lucide-id-card', to: '/driver/profile' }],
              [{ label: '登出', icon: 'i-lucide-log-out', color: 'error' as const, onSelect: handleSignOut }],
            ]"
          >
            <UButton
              icon="i-lucide-user-circle"
              color="neutral"
              variant="ghost"
              size="lg"
              aria-label="帳號"
            />
          </UDropdownMenu>
        </div>
      </div>

      <!-- 日期切換 tabs：今天 / 明天 / 後天 -->
      <div class="mt-3 grid grid-cols-3 gap-2 bg-gray-100 rounded-xl p-1">
        <button
          v-for="(opt, idx) in dateOptions"
          :key="opt.iso"
          class="py-2 rounded-lg text-sm font-medium transition-colors"
          :class="opt.iso === selectedDate
            ? 'bg-white text-blue-600 shadow-sm'
            : 'text-gray-600'"
          @click="setSelectedDate(opt.iso)"
        >
          <div class="font-bold">{{ opt.label }}</div>
          <div class="text-xs opacity-80">{{ opt.short }}</div>
        </button>
      </div>
    </div>

    <!-- Content -->
    <div class="px-4 py-4 space-y-3 pb-24">
      <!-- Loading -->
      <template v-if="pending">
        <div v-for="i in 3" :key="i" class="bg-white rounded-2xl p-5 shadow-sm animate-pulse">
          <div class="h-5 bg-gray-200 rounded w-1/3 mb-3" />
          <div class="h-6 bg-gray-200 rounded w-2/3 mb-2" />
          <div class="h-5 bg-gray-200 rounded w-full" />
        </div>
      </template>

      <!-- Empty -->
      <div v-else-if="trips.length === 0" class="text-center py-20">
        <div class="text-6xl mb-4">🚗</div>
        <p class="text-xl font-medium text-gray-600">{{ emptyLabel }}</p>
        <p class="text-base text-gray-400 mt-1">{{ emptySub }}</p>
      </div>

      <!-- Trip Cards：依共乘群組合併 -->
      <template v-for="(item, idx) in tripItems" :key="idx">
        <!-- 共乘群組卡 -->
        <div
          v-if="item.kind === 'carpool'"
          class="bg-white rounded-2xl p-4 shadow-sm border-2 border-purple-200"
        >
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2">
              <span class="inline-flex items-center gap-1 text-sm font-bold text-purple-700 bg-purple-100 px-2.5 py-1 rounded-full">
                <span>👥</span>共乘 {{ item.members.length }} 人
              </span>
              <span class="text-base font-bold text-purple-600">{{ formatTime(item.scheduledAt) }} ~ {{ formatTime(item.scheduledEndAt) }}</span>
            </div>
            <TripStatusBadge :status="item.status" />
          </div>

          <!-- 上車順序 -->
          <p class="text-xs text-gray-500 mb-1.5">📍 依序接</p>
          <div class="space-y-1 mb-3">
            <NuxtLink
              v-for="m in item.pickupSequence"
              :key="`pk-${m.id}`"
              :to="`/driver/trip/${m.id}`"
              class="flex items-start gap-2 bg-blue-50 rounded-lg px-3 py-2 active:bg-blue-100 transition-colors"
            >
              <span class="shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center mt-0.5">{{ m.carpoolOrder }}</span>
              <div class="flex-1 min-w-0">
                <p class="font-semibold text-base text-gray-900">
                  {{ m.careRecipient.name }}
                  <span class="text-sm text-gray-500 ml-2">{{ formatTime(m.carpoolPickupAt ?? m.scheduledAt) }}</span>
                </p>
                <p class="text-sm text-gray-500 truncate">▲ {{ m.originAddress }}</p>
              </div>
            </NuxtLink>
          </div>

          <!-- 下車順序 -->
          <p class="text-xs text-gray-500 mb-1.5">🏁 依序送</p>
          <div class="space-y-1">
            <div
              v-for="m in item.dropoffSequence"
              :key="`dp-${m.id}`"
              class="flex items-start gap-2 bg-green-50 rounded-lg px-3 py-2"
            >
              <span class="shrink-0 w-6 h-6 rounded-full bg-green-600 text-white text-xs font-bold flex items-center justify-center mt-0.5">{{ m.carpoolDropoffOrder ?? '·' }}</span>
              <div class="flex-1 min-w-0">
                <p class="font-semibold text-base text-gray-900">
                  {{ m.careRecipient.name }}
                  <span class="text-sm text-gray-500 ml-2">{{ formatTime(m.carpoolDropoffAt ?? m.scheduledEndAt) }}</span>
                </p>
                <p class="text-sm text-gray-500 truncate">● {{ m.destinationAddress }}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- 個別行程卡 -->
        <NuxtLink
          v-else
          :to="`/driver/trip/${item.trip.id}`"
          class="block bg-white rounded-2xl p-5 shadow-sm border border-gray-100 active:scale-[0.98] transition-transform"
          :class="item.trip.status === 'completed' || item.trip.status === 'cancelled' ? 'opacity-70' : ''"
        >
          <div class="flex items-center justify-between mb-3">
            <span class="text-lg font-bold text-blue-600">
              {{ formatTime(item.trip.scheduledAt) }}
              <span v-if="item.trip.tripDirection === 'outbound'" class="text-sm text-purple-600 ml-1">去程</span>
              <span v-else-if="item.trip.tripDirection === 'return'" class="text-sm text-purple-600 ml-1">回程</span>
            </span>
            <TripStatusBadge :status="item.trip.status" />
          </div>

          <p class="text-xl font-semibold text-gray-900 mb-3">{{ item.trip.careRecipient.name }}</p>

          <div class="space-y-2 text-base text-gray-600">
            <div class="flex items-start gap-2">
              <span class="text-green-500 mt-0.5 shrink-0">▲</span>
              <span class="leading-snug">{{ item.trip.originAddress }}</span>
            </div>
            <div class="flex items-start gap-2">
              <span class="text-red-500 mt-0.5 shrink-0">●</span>
              <span class="leading-snug">{{ item.trip.destinationAddress }}</span>
            </div>
          </div>

          <div class="mt-3 flex flex-wrap gap-1.5">
            <span v-if="item.trip.needsWheelchair" class="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full">
              ♿ 需要輪椅空間
            </span>
            <span
              v-for="n in (item.trip.careRecipient.specialNeeds ?? [])"
              :key="`sn-${n.id}`"
              class="inline-flex items-center gap-1 text-xs text-rose-700 bg-rose-50 px-2.5 py-1 rounded-full"
            >
              ⚠ {{ n.name }}
            </span>
            <span
              v-for="d in (item.trip.careRecipient.devices ?? [])"
              :key="`dv-${d.id}`"
              class="inline-flex items-center gap-1 text-xs text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full"
            >
              🧰 {{ d.name }}
            </span>
          </div>
        </NuxtLink>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: false })

const { api } = useApi()
const { user, signOut } = useAuth()
const driverName = computed(() => (user.value as any)?.name || (user.value as any)?.email || '司機')

async function handleSignOut() {
  await signOut()
  navigateTo('/driver/login')
}

interface ApplicationStatus {
  hasApplication: boolean
  approvalStatus: 'pending' | 'approved' | 'rejected' | null
}
const role = computed(() => (user.value as any)?.role)
if (role.value !== 'admin' && role.value !== 'developer') {
  const appStatus = await api<ApplicationStatus>('/api/driver/me/application').catch(() => null)
  if (!appStatus || !appStatus.hasApplication) {
    await navigateTo('/driver/onboarding')
  } else if (appStatus.approvalStatus === 'pending') {
    await navigateTo('/driver/pending')
  } else if (appStatus.approvalStatus === 'rejected') {
    await navigateTo('/driver/rejected')
  }
}

function dateAt(offsetDays: number): { iso: string; date: Date } {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + offsetDays)
  return { iso: d.toISOString().split('T')[0]!, date: d }
}

const dateOptions = computed(() => {
  const labels = ['今天', '明天', '後天']
  return [0, 1, 2].map((offset, i) => {
    const { iso, date } = dateAt(offset)
    return {
      iso,
      label: labels[i]!,
      short: date.toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric', weekday: 'short' }),
    }
  })
})

const selectedDate = ref(dateAt(0).iso)
function setSelectedDate(iso: string) {
  selectedDate.value = iso
}

const dateLabel = computed(() => {
  const opt = dateOptions.value.find(o => o.iso === selectedDate.value)
  return opt ? `${opt.label} · ${opt.short}` : selectedDate.value
})

const emptyLabel = computed(() => {
  const opt = dateOptions.value.find(o => o.iso === selectedDate.value)
  return opt ? `${opt.label}沒有任務` : '沒有任務'
})
const emptySub = computed(() => {
  if (selectedDate.value === dateOptions.value[0]?.iso) return '好好休息！'
  return '可切換其他日期查看'
})

const { data, pending } = useAsyncData(
  () => `driver-trips-${selectedDate.value}`,
  async () => {
    const result = await api<any[]>(`/api/driver/trips?date=${selectedDate.value}`)
    return result
  },
  { watch: [selectedDate] },
)
const trips = computed(() => data.value ?? [])

// 將共乘 trips 合併成一個 group 卡，個別 trips 保持原樣
type CarpoolItem = {
  kind: 'carpool'
  carpoolGroupId: string
  scheduledAt: string
  scheduledEndAt: string
  status: string
  members: any[]
  pickupSequence: any[]
  dropoffSequence: any[]
}
type SoloItem = { kind: 'solo'; trip: any; scheduledAt: string }
type TripItem = CarpoolItem | SoloItem

const tripItems = computed<TripItem[]>(() => {
  const out: TripItem[] = []
  const seen = new Set<string>()
  for (const t of trips.value) {
    if (seen.has(t.id)) continue
    if (t.carpoolGroupId) {
      const members = trips.value.filter((x: any) => x.carpoolGroupId === t.carpoolGroupId)
      for (const m of members) seen.add(m.id)
      const pickup = [...members].sort((a, b) => (a.carpoolOrder ?? 0) - (b.carpoolOrder ?? 0))
      const dropoff = [...members].sort((a, b) => (a.carpoolDropoffOrder ?? a.carpoolOrder ?? 0) - (b.carpoolDropoffOrder ?? b.carpoolOrder ?? 0))
      const earliest = pickup[0]
      const latest = [...members].reduce((acc, m) => {
        const t = m.carpoolDropoffAt ?? m.scheduledEndAt ?? m.scheduledAt
        return !acc || t > acc ? t : acc
      }, '' as string)
      // 群組 status：以最差的個別 status 為主（避免一筆完成就誤判整組完成）
      const statuses = members.map((m: any) => m.status)
      const status = statuses.includes('cancelled') ? 'cancelled'
        : statuses.includes('in_progress') ? 'in_progress'
        : statuses.every((s: string) => s === 'completed') ? 'completed'
        : 'assigned'
      out.push({
        kind: 'carpool',
        carpoolGroupId: t.carpoolGroupId,
        scheduledAt: earliest?.carpoolPickupAt ?? earliest?.scheduledAt,
        scheduledEndAt: latest,
        status,
        members,
        pickupSequence: pickup,
        dropoffSequence: dropoff,
      })
    } else {
      out.push({ kind: 'solo', trip: t, scheduledAt: t.scheduledAt })
      seen.add(t.id)
    }
  }
  // 依時間排序
  out.sort((a, b) => (a.scheduledAt ?? '').localeCompare(b.scheduledAt ?? ''))
  return out
})

function formatTime(scheduledAt: string | Date) {
  return new Date(scheduledAt).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false })
}
</script>
