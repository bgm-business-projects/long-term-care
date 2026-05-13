<script setup lang="ts">
const { api } = useApi()
const toast = useToast()

// ── 地圖檢視（個案接送）──
interface MapPoint {
  lat: number
  lng: number
  label: string
  sub?: string
  kind: 'start' | 'stop' | 'dest'
  order?: number
}
const showMap = ref(false)
const mapPoints = ref<MapPoint[]>([])
const mapTitle = ref('路線地圖')
const mapMeta = ref<{ recipient: string; date: string; distanceKm: string | null } | null>(null)

function openTripMap(trip: any, title: string, meta: typeof mapMeta.value) {
  if (!trip.originLat || !trip.originLng || !trip.destinationLat || !trip.destinationLng) {
    toast.add({ title: '訂單缺少座標資料，無法顯示地圖', color: 'warning' })
    return
  }
  mapPoints.value = [
    { lat: Number(trip.originLat), lng: Number(trip.originLng), label: '起點', sub: trip.originAddress, kind: 'start' },
    { lat: Number(trip.destinationLat), lng: Number(trip.destinationLng), label: '終點', sub: trip.destinationAddress, kind: 'dest' },
  ]
  mapTitle.value = title
  mapMeta.value = meta
  showMap.value = true
}

function openPairMap(pair: any) {
  const ob = pair.outbound
  const rt = pair.return
  if (!ob.originLat || !ob.originLng || !ob.destinationLat || !ob.destinationLng) {
    toast.add({ title: '訂單缺少座標資料，無法顯示地圖', color: 'warning' })
    return
  }
  const points: MapPoint[] = [
    { lat: Number(ob.originLat), lng: Number(ob.originLng), label: '個案家（起）', sub: ob.originAddress, kind: 'start' },
    { lat: Number(ob.destinationLat), lng: Number(ob.destinationLng), label: rt ? '機構' : '目的地', sub: ob.destinationAddress, kind: rt ? 'stop' : 'dest', order: 1 },
  ]
  if (rt) {
    points.push({ lat: Number(rt.destinationLat), lng: Number(rt.destinationLng), label: '個案家（回）', sub: rt.destinationAddress, kind: 'dest' })
  }
  mapPoints.value = points
  mapTitle.value = `${pair.careRecipientName || '個案'} · ${pair.date}`
  const totalKm = pairTotalKm(pair)
  mapMeta.value = { recipient: pair.careRecipientName || '—', date: pair.date, distanceKm: totalKm }
  showMap.value = true
}

// Haversine（前端粗估，當 mileageActual 為空時備用）
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

function tripKm(t: any): number | null {
  const actual = t.mileageActual ? Number(t.mileageActual) : null
  if (actual != null) return actual
  if (t.mileageEstimated) return Number(t.mileageEstimated)
  if (t.originLat && t.originLng && t.destinationLat && t.destinationLng) {
    return haversineKm(Number(t.originLat), Number(t.originLng), Number(t.destinationLat), Number(t.destinationLng))
  }
  return null
}

function pairTotalKm(pair: any): string | null {
  const a = tripKm(pair.outbound)
  const b = pair.return ? tripKm(pair.return) : 0
  if (a == null) return null
  return (a + (b ?? 0)).toFixed(1)
}

// 下載地圖截圖（用 html-to-image，能處理 Tailwind v4 的 oklch）
async function downloadMapImage() {
  try {
    const { toPng } = await import('html-to-image')
    const container = document.querySelector('.map-export-target') as HTMLElement | null
    if (!container) {
      toast.add({ title: '找不到地圖元素', color: 'error' })
      return
    }
    const dataUrl = await toPng(container, {
      pixelRatio: 2,
      backgroundColor: '#ffffff',
      cacheBust: true,
      // 過濾掉可能破壞畫面的元素（例如 leaflet 控制列）
      filter: (node) => {
        if (!(node instanceof Element)) return true
        return !node.classList?.contains('leaflet-control-container')
      },
    })
    const filename = `${mapMeta.value?.recipient || '路線'}_${mapMeta.value?.date || ''}.png`.replace(/[\/\\]/g, '-')
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = filename
    a.click()
    toast.add({ title: '已下載地圖圖片', color: 'success' })
  } catch (err: any) {
    console.error('downloadMapImage error', err)
    toast.add({ title: err?.message || '截圖失敗', color: 'error' })
  }
}

const tab = ref<'recipient' | 'driver'>('recipient')

const filter = reactive({
  startDate: new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0],
  endDate: new Date().toISOString().split('T')[0],
  driverUserId: '',
  careRecipientId: '',
  vehicleId: '',
})

const recipientRows = ref<any[]>([])
const driverRows = ref<any[]>([])
const loading = ref(false)
const exporting = ref(false)

const drivers = ref<any[]>([])
const recipients = ref<any[]>([])
const vehicles = ref<any[]>([])

onMounted(async () => {
  const [d, v, r] = await Promise.all([
    api<any[]>('/api/dispatch/drivers'),
    api<any[]>('/api/dispatch/vehicles'),
    api<any[]>('/api/dispatch/care-recipients').catch(() => []),
  ])
  drivers.value = d
  vehicles.value = v
  recipients.value = r
})

const STATUS_LABEL: Record<string, string> = {
  pending: '待派',
  assigned: '已指派',
  in_progress: '進行中',
  completed: '已完成',
  cancelled: '已取消',
}

function statusColor(s: string) {
  return s === 'completed' ? 'neutral'
    : s === 'in_progress' ? 'success'
    : s === 'assigned' ? 'info'
    : s === 'cancelled' ? 'error' : 'warning'
}

function formatDate(dt: string | null | undefined) {
  return dt ? new Date(dt).toLocaleDateString('zh-TW') : '—'
}
function formatTime(dt: string | null | undefined) {
  return dt ? new Date(dt).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }) : '—'
}

function buildParams() {
  const p = new URLSearchParams()
  p.set('startDate', filter.startDate ?? '')
  p.set('endDate', filter.endDate ?? '')
  if (filter.driverUserId) p.set('driverUserId', filter.driverUserId)
  if (filter.careRecipientId) p.set('careRecipientId', filter.careRecipientId)
  if (filter.vehicleId) p.set('vehicleId', filter.vehicleId)
  return p
}

async function search() {
  loading.value = true
  try {
    if (tab.value === 'recipient') {
      recipientRows.value = await api<any[]>(`/api/dispatch/reports/recipient?${buildParams()}`)
    } else {
      driverRows.value = await api<any[]>(`/api/dispatch/reports/driver-attendance?${buildParams()}`)
    }
  } catch (err: any) {
    toast.add({ title: err?.data?.statusMessage || '查詢失敗', color: 'error' })
  } finally {
    loading.value = false
  }
}

async function exportExcel() {
  exporting.value = true
  try {
    const endpoint = tab.value === 'recipient'
      ? '/api/dispatch/reports/recipient/export'
      : '/api/dispatch/reports/driver-attendance/export'
    const blob = await $fetch(`${endpoint}?${buildParams()}`, {
      responseType: 'blob',
      credentials: 'include',
    }) as Blob
    const url = URL.createObjectURL(blob)
    const filename = tab.value === 'recipient'
      ? `個案接送報表_${filter.startDate}_${filter.endDate}.xlsx`
      : `司機出勤報表_${filter.startDate}_${filter.endDate}.xlsx`
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  } catch {
    toast.add({ title: '匯出失敗', color: 'error' })
  } finally {
    exporting.value = false
  }
}

// ── 個案接送報表：配對成「來回」── ──
interface RecipientPair {
  kind: 'pair' | 'single'
  careRecipientName: string | null
  organizationName: string | null
  date: string
  outbound: any
  return: any | null
}
const recipientPairs = computed<RecipientPair[]>(() => {
  const out: RecipientPair[] = []
  const byId = new Map<string, any>(recipientRows.value.map(r => [r.id, r]))
  const seen = new Set<string>()
  // 仍依原順序（個案+時間）走訪
  for (const r of recipientRows.value) {
    if (seen.has(r.id)) continue
    const partner = r.pairedTripId ? byId.get(r.pairedTripId) : null
    if (partner) {
      const ob = r.tripDirection === 'outbound' ? r : partner
      const rt = r.tripDirection === 'outbound' ? partner : r
      out.push({
        kind: 'pair',
        careRecipientName: ob.careRecipientName,
        organizationName: ob.organizationName,
        date: ob.scheduledAt ? new Date(ob.scheduledAt).toLocaleDateString('zh-TW') : '',
        outbound: ob,
        return: rt,
      })
      seen.add(r.id); seen.add(partner.id)
    } else {
      out.push({
        kind: 'single',
        careRecipientName: r.careRecipientName,
        organizationName: r.organizationName,
        date: r.scheduledAt ? new Date(r.scheduledAt).toLocaleDateString('zh-TW') : '',
        outbound: r,
        return: null,
      })
      seen.add(r.id)
    }
  }
  return out
})

// ── 司機出勤報表：先按司機+日期分組，再把共乘合併 ──
interface DriverDayItem {
  kind: 'solo' | 'carpool'
  scheduledAt: string | null
  scheduledEndAt: string | null
  dailySeq: number
  // solo
  trip?: any
  // carpool
  carpoolGroupId?: string
  members?: any[]
}
interface DriverDayGroup {
  driverName: string
  date: string
  rows: any[]
  items: DriverDayItem[]
  totalKm: number
  totalTrips: number
}

const driverGroups = computed<DriverDayGroup[]>(() => {
  const groups: DriverDayGroup[] = []
  let cur: DriverDayGroup | null = null
  for (const r of driverRows.value) {
    const date = r.scheduledAt ? new Date(r.scheduledAt).toLocaleDateString('zh-TW') : ''
    const driverName = r.driverName ?? '未指派'
    if (!cur || cur.driverName !== driverName || cur.date !== date) {
      cur = { driverName, date, rows: [], items: [], totalKm: 0, totalTrips: 0 }
      groups.push(cur)
    }
    cur.rows.push(r)
  }
  // 對每組內的 rows 合併共乘
  for (const g of groups) {
    const seen = new Set<string>()
    const seq = (r: any) => r.dailySeq as number
    for (const r of g.rows) {
      if (seen.has(r.id)) continue
      if (r.carpoolGroupId) {
        const members = g.rows.filter(x => x.carpoolGroupId === r.carpoolGroupId)
        for (const m of members) seen.add(m.id)
        // 用上車順序排序成員
        members.sort((a, b) => (a.carpoolOrder ?? 0) - (b.carpoolOrder ?? 0))
        const earliest = members.reduce((a, b) => (a.scheduledAt < b.scheduledAt ? a : b))
        const latest = members.reduce((a, b) => ((a.carpoolDropoffAt ?? a.scheduledEndAt) > (b.carpoolDropoffAt ?? b.scheduledEndAt) ? a : b))
        g.items.push({
          kind: 'carpool',
          scheduledAt: earliest.scheduledAt,
          scheduledEndAt: latest.carpoolDropoffAt ?? latest.scheduledEndAt,
          dailySeq: seq(earliest),
          carpoolGroupId: r.carpoolGroupId,
          members,
        })
      } else {
        g.items.push({
          kind: 'solo',
          scheduledAt: r.scheduledAt,
          scheduledEndAt: r.scheduledEndAt,
          dailySeq: seq(r),
          trip: r,
        })
        seen.add(r.id)
      }
    }
    // 排序：依 scheduledAt
    g.items.sort((a, b) => (a.scheduledAt ?? '').localeCompare(b.scheduledAt ?? ''))
    // 統計總公里 + 總趟數（共乘合併算 1 趟）
    g.totalTrips = g.items.length
    g.totalKm = 0
    for (const it of g.items) {
      if (it.kind === 'carpool') {
        // 共乘：用群組總距離（公尺）→ 公里；若沒有則加總成員里程
        const groupDist = it.members?.[0]?.carpoolTotalDistanceMeters
        if (groupDist) {
          g.totalKm += groupDist / 1000
        } else {
          for (const m of it.members ?? []) {
            const km = tripKm(m)
            if (km != null) g.totalKm += km
          }
        }
      } else if (it.trip) {
        const km = tripKm(it.trip)
        if (km != null) g.totalKm += km
      }
    }
  }
  return groups
})

watch(tab, () => {
  if (tab.value === 'recipient' && recipientRows.value.length === 0) search()
  else if (tab.value === 'driver' && driverRows.value.length === 0) search()
})
</script>

<template>
  <div class="space-y-4">
    <h1 class="text-xl font-bold">出勤報表</h1>

    <!-- Tab 切換 -->
    <div class="flex border-b border-default">
      <button
        class="px-4 py-2 text-sm font-medium transition-colors -mb-px"
        :class="tab === 'recipient' ? 'border-b-2 border-primary text-primary' : 'text-muted hover:text-default'"
        @click="tab = 'recipient'"
      >
        <UIcon name="i-lucide-user-round" class="mr-1" />個案接送報表
      </button>
      <button
        class="px-4 py-2 text-sm font-medium transition-colors -mb-px"
        :class="tab === 'driver' ? 'border-b-2 border-primary text-primary' : 'text-muted hover:text-default'"
        @click="tab = 'driver'"
      >
        <UIcon name="i-lucide-car" class="mr-1" />司機出勤報表
      </button>
    </div>

    <!-- 篩選列 -->
    <div class="flex flex-wrap gap-3 p-4 border border-default rounded-xl bg-default/30">
      <div class="flex items-center gap-2">
        <span class="text-sm">起始日</span>
        <input type="date" v-model="filter.startDate" class="border border-default rounded px-2 py-1 text-sm" />
      </div>
      <div class="flex items-center gap-2">
        <span class="text-sm">結束日</span>
        <input type="date" v-model="filter.endDate" class="border border-default rounded px-2 py-1 text-sm" />
      </div>
      <div v-if="tab === 'recipient'" class="flex items-center gap-2">
        <span class="text-sm">個案</span>
        <select v-model="filter.careRecipientId" class="border border-default rounded px-2 py-1 text-sm">
          <option value="">全部</option>
          <option v-for="r in recipients" :key="r.id" :value="r.id">{{ r.name }}</option>
        </select>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-sm">司機</span>
        <select v-model="filter.driverUserId" class="border border-default rounded px-2 py-1 text-sm">
          <option value="">全部</option>
          <option v-for="d in drivers" :key="d.userId" :value="d.userId">{{ d.name }}</option>
        </select>
      </div>
      <div v-if="tab === 'driver'" class="flex items-center gap-2">
        <span class="text-sm">車輛</span>
        <select v-model="filter.vehicleId" class="border border-default rounded px-2 py-1 text-sm">
          <option value="">全部</option>
          <option v-for="v in vehicles" :key="v.id" :value="v.id">{{ v.plate }}</option>
        </select>
      </div>
      <UButton @click="search" :loading="loading">查詢</UButton>
      <UButton @click="exportExcel" :loading="exporting" color="success" icon="i-lucide-download">
        匯出 Excel
      </UButton>
    </div>

    <!-- 個案接送報表（每組為一個來回行程） -->
    <div v-if="tab === 'recipient'" class="space-y-3">
      <div v-if="recipientPairs.length === 0" class="px-3 py-8 text-center text-muted border border-default rounded-xl">
        請點擊「查詢」載入資料
      </div>
      <div
        v-for="(p, idx) in recipientPairs"
        :key="idx"
        class="border border-default rounded-xl overflow-hidden"
        :class="p.kind === 'pair' ? 'border-l-4 border-l-amber-500' : ''"
      >
        <!-- 卡片標頭 -->
        <div class="bg-default/40 px-4 py-2 flex items-center justify-between border-b border-default flex-wrap gap-2">
          <div class="flex items-center gap-3 flex-wrap">
            <UIcon name="i-lucide-user-round" class="text-primary" />
            <span class="font-semibold">{{ p.careRecipientName || '—' }}</span>
            <span class="text-muted text-sm">{{ p.date }}</span>
            <UBadge v-if="p.kind === 'pair'" label="來回" color="warning" variant="subtle" size="xs" icon="i-lucide-repeat" />
            <UBadge v-else label="單程" color="neutral" variant="subtle" size="xs" />
            <span class="text-xs text-muted">{{ p.organizationName || '平台直接建立' }}</span>
            <span v-if="pairTotalKm(p)" class="text-xs flex items-center gap-1">
              <UIcon name="i-lucide-route" class="text-primary" />
              <span class="font-medium">總里程 {{ pairTotalKm(p) }} km</span>
            </span>
          </div>
          <UButton size="xs" variant="outline" color="neutral" icon="i-lucide-map" @click="openPairMap(p)">
            地圖檢視
          </UButton>
        </div>
        <table class="w-full text-sm">
          <thead class="bg-default/20 border-b border-default text-xs">
            <tr>
              <th class="px-3 py-2 text-center w-16">方向</th>
              <th class="px-3 py-2 text-left">時間</th>
              <th class="px-3 py-2 text-left">起點</th>
              <th class="px-3 py-2 text-left">終點</th>
              <th class="px-3 py-2 text-left">司機 / 車牌</th>
              <th class="px-3 py-2 text-right">里程</th>
              <th class="px-3 py-2 text-center">狀態</th>
            </tr>
          </thead>
          <tbody>
            <!-- 去程 -->
            <tr class="border-b border-default/30">
              <td class="px-3 py-2 text-center">
                <UBadge
                  :label="p.kind === 'pair' ? '去程' : '單程'"
                  :color="p.kind === 'pair' ? 'primary' : 'neutral'"
                  variant="subtle"
                  size="xs"
                />
              </td>
              <td class="px-3 py-2">{{ formatTime(p.outbound.scheduledAt) }} ~ {{ formatTime(p.outbound.scheduledEndAt) }}</td>
              <td class="px-3 py-2 max-w-48 truncate" :title="p.outbound.originAddress">{{ p.outbound.originAddress }}</td>
              <td class="px-3 py-2 max-w-48 truncate" :title="p.outbound.destinationAddress">{{ p.outbound.destinationAddress }}</td>
              <td class="px-3 py-2">
                <p>{{ p.outbound.driverName || '—' }}</p>
                <p class="text-xs text-muted">{{ p.outbound.vehiclePlate || '' }}</p>
              </td>
              <td class="px-3 py-2 text-right">{{ p.outbound.mileageActual ?? p.outbound.mileageEstimated ?? '—' }}</td>
              <td class="px-3 py-2 text-center">
                <UBadge :label="STATUS_LABEL[p.outbound.status] ?? p.outbound.status" :color="statusColor(p.outbound.status) as any" variant="subtle" size="xs" />
              </td>
            </tr>
            <!-- 回程 -->
            <tr v-if="p.return" class="border-b border-default/30 bg-amber-50/40">
              <td class="px-3 py-2 text-center">
                <UBadge label="回程" color="warning" variant="subtle" size="xs" />
              </td>
              <td class="px-3 py-2">{{ formatTime(p.return.scheduledAt) }} ~ {{ formatTime(p.return.scheduledEndAt) }}</td>
              <td class="px-3 py-2 max-w-48 truncate" :title="p.return.originAddress">{{ p.return.originAddress }}</td>
              <td class="px-3 py-2 max-w-48 truncate" :title="p.return.destinationAddress">{{ p.return.destinationAddress }}</td>
              <td class="px-3 py-2">
                <p>{{ p.return.driverName || '—' }}</p>
                <p class="text-xs text-muted">{{ p.return.vehiclePlate || '' }}</p>
              </td>
              <td class="px-3 py-2 text-right">{{ p.return.mileageActual ?? p.return.mileageEstimated ?? '—' }}</td>
              <td class="px-3 py-2 text-center">
                <UBadge :label="STATUS_LABEL[p.return.status] ?? p.return.status" :color="statusColor(p.return.status) as any" variant="subtle" size="xs" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 司機出勤報表（依司機+日期分組） -->
    <div v-else class="space-y-4">
      <div v-if="driverGroups.length === 0" class="px-3 py-8 text-center text-muted border border-default rounded-xl">
        請點擊「查詢」載入資料
      </div>
      <div
        v-for="g in driverGroups"
        :key="`${g.driverName}-${g.date}`"
        class="border border-default rounded-xl overflow-hidden"
      >
        <div class="bg-default/40 px-4 py-2 flex items-center justify-between border-b border-default flex-wrap gap-2">
          <div class="flex items-center gap-3 flex-wrap">
            <UIcon name="i-lucide-user" class="text-primary" />
            <span class="font-semibold">{{ g.driverName }}</span>
            <span class="text-muted text-sm">{{ g.date }}</span>
            <UBadge :label="`${g.totalTrips} 趟`" color="info" variant="subtle" size="xs" icon="i-lucide-list-checks" />
            <UBadge :label="`${g.rows.length} 個案`" color="neutral" variant="subtle" size="xs" icon="i-lucide-users" />
            <span class="text-sm flex items-center gap-1">
              <UIcon name="i-lucide-route" class="text-primary" />
              <span class="font-semibold">總里程 {{ g.totalKm.toFixed(1) }} km</span>
            </span>
          </div>
          <span class="text-xs text-muted">
            首趟 {{ formatTime(g.rows[0]?.scheduledAt) }} ~ 末趟 {{ formatTime(g.rows[g.rows.length - 1]?.scheduledEndAt) }}
          </span>
        </div>
        <div class="divide-y divide-default/40">
          <template v-for="(item, ii) in g.items" :key="ii">
            <!-- 共乘區塊：列出完整路線（上車序列 + 下車序列） -->
            <div v-if="item.kind === 'carpool'" class="px-4 py-3 bg-purple-50/40 border-l-4 border-l-purple-500">
              <div class="flex items-center gap-3 mb-2 flex-wrap">
                <span class="shrink-0 w-6 h-6 rounded-full bg-purple-500 text-white text-xs font-bold flex items-center justify-center">
                  {{ item.dailySeq }}
                </span>
                <UIcon name="i-lucide-users" class="text-purple-600" />
                <span class="font-semibold">共乘 {{ item.members?.length }} 人</span>
                <span class="text-sm text-muted">{{ formatTime(item.scheduledAt) }} ~ {{ formatTime(item.scheduledEndAt) }}</span>
                <span class="text-xs text-muted ml-auto">
                  乘客：{{ item.members?.map(m => m.careRecipientName).filter(Boolean).join('、') }}
                </span>
              </div>
              <!-- 路線：依時間軸列出上下車 -->
              <ol class="space-y-1.5 ml-3 text-sm">
                <!-- 上車順序 -->
                <li
                  v-for="m in [...(item.members ?? [])].sort((a, b) => (a.carpoolOrder ?? 0) - (b.carpoolOrder ?? 0))"
                  :key="`pk-${m.id}`"
                  class="flex items-start gap-2"
                >
                  <span class="shrink-0 w-5 h-5 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center mt-0.5">
                    {{ m.carpoolOrder ?? '·' }}
                  </span>
                  <div class="flex-1 min-w-0">
                    <span class="font-medium">{{ m.careRecipientName || '—' }}</span>
                    <span class="text-xs text-muted ml-1">上車</span>
                    <span class="text-xs text-muted ml-2">{{ formatTime(m.carpoolPickupAt ?? m.scheduledAt) }}</span>
                    <p class="text-xs text-muted truncate">{{ m.originAddress }}</p>
                  </div>
                </li>
                <!-- 下車順序（依 dropoffOrder） -->
                <li
                  v-for="m in [...(item.members ?? [])].sort((a, b) => (a.carpoolDropoffOrder ?? a.carpoolOrder ?? 0) - (b.carpoolDropoffOrder ?? b.carpoolOrder ?? 0))"
                  :key="`dp-${m.id}`"
                  class="flex items-start gap-2 pt-1 border-t border-default/40"
                >
                  <span class="shrink-0 w-5 h-5 rounded-full bg-success text-white text-xs font-bold flex items-center justify-center mt-0.5">
                    {{ m.carpoolDropoffOrder ?? '·' }}
                  </span>
                  <div class="flex-1 min-w-0">
                    <span class="font-medium">{{ m.careRecipientName || '—' }}</span>
                    <span class="text-xs text-muted ml-1">下車</span>
                    <span class="text-xs text-muted ml-2">{{ formatTime(m.carpoolDropoffAt ?? m.scheduledEndAt) }}</span>
                    <p class="text-xs text-muted truncate">{{ m.destinationAddress }}</p>
                  </div>
                </li>
              </ol>
            </div>

            <!-- 個別行程 -->
            <table v-else class="w-full text-sm">
              <tbody>
                <tr class="hover:bg-default/20">
                  <td class="px-3 py-2 text-center font-medium text-muted w-12">{{ item.dailySeq }}</td>
                  <td class="px-3 py-2 w-40">{{ formatTime(item.trip.scheduledAt) }} ~ {{ formatTime(item.trip.scheduledEndAt) }}</td>
                  <td class="px-3 py-2 font-medium">{{ item.trip.careRecipientName || '—' }}</td>
                  <td class="px-3 py-2 text-center w-16">
                    <UBadge
                      v-if="item.trip.directionLabel !== '單程'"
                      :label="item.trip.directionLabel"
                      :color="item.trip.directionLabel === '去程' ? 'primary' : 'warning'"
                      variant="subtle"
                      size="xs"
                    />
                  </td>
                  <td class="px-3 py-2 max-w-48 truncate" :title="item.trip.originAddress">{{ item.trip.originAddress }}</td>
                  <td class="px-3 py-2 max-w-48 truncate" :title="item.trip.destinationAddress">{{ item.trip.destinationAddress }}</td>
                  <td class="px-3 py-2 text-right w-20">{{ item.trip.mileageActual ?? item.trip.mileageEstimated ?? '—' }}</td>
                  <td class="px-3 py-2 text-center w-20">
                    <UBadge :label="STATUS_LABEL[item.trip.status] ?? item.trip.status" :color="statusColor(item.trip.status) as any" variant="subtle" size="xs" />
                  </td>
                </tr>
              </tbody>
            </table>
          </template>
        </div>
      </div>
    </div>

    <!-- 地圖檢視 modal（檢附文件用） -->
    <UModal v-model:open="showMap" :title="mapTitle" description=" " size="xl">
      <template #content>
        <div class="p-4 space-y-3">
          <!-- 截圖目標：使用內聯顏色，避免 Tailwind v4 的 oklch() 影響 html-to-image -->
          <div
            class="map-export-target"
            style="background:#ffffff; padding:12px; border-radius:8px; border:1px solid #e5e7eb; color:#111827"
          >
            <div style="margin-bottom:8px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px">
              <div>
                <p style="font-weight:600; font-size:16px; color:#111827">{{ mapMeta?.recipient }} · {{ mapMeta?.date }}</p>
                <p v-if="mapMeta?.distanceKm" style="font-size:14px; color:#6b7280">總里程：{{ mapMeta.distanceKm }} km</p>
              </div>
              <p style="font-size:12px; color:#6b7280">資料來源：OpenStreetMap</p>
            </div>
            <ReportRouteMap :points="mapPoints" :open="showMap" />
            <ol style="margin-top:12px; font-size:12px; display:flex; flex-direction:column; gap:4px">
              <li
                v-for="(pt, i) in mapPoints"
                :key="i"
                style="display:flex; align-items:flex-start; gap:8px"
              >
                <span
                  style="flex-shrink:0; width:20px; height:20px; border-radius:50%; color:#fff; font-size:11px; font-weight:bold; display:flex; align-items:center; justify-content:center; margin-top:2px"
                  :style="`background:${pt.kind === 'start' ? '#6b7280' : pt.kind === 'dest' ? '#16a34a' : '#2563eb'}`"
                >{{ pt.order ?? (pt.kind === 'start' ? '起' : pt.kind === 'dest' ? '終' : i) }}</span>
                <div style="flex:1; min-width:0">
                  <p style="font-weight:500; color:#111827">{{ pt.label }}</p>
                  <p style="color:#6b7280">{{ pt.sub }}</p>
                </div>
              </li>
            </ol>
          </div>
          <div class="flex justify-end gap-2">
            <UButton color="primary" variant="outline" icon="i-lucide-download" @click="downloadMapImage">
              下載圖片
            </UButton>
            <UButton color="neutral" variant="outline" @click="showMap = false">關閉</UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
