<script setup lang="ts">
const props = defineProps<{
  date: string  // 'YYYY-MM-DD'
}>()

const emit = defineEmits<{ refresh: [] }>()

const { api } = useApi()
const toast = useToast()

// 甘特圖資料 — 以司機為列
const ganttData = ref<{ drivers: any[], unassignedTrips: any[] }>({ drivers: [], unassignedTrips: [] })
const loading = ref(false)

// 時間單位：30 或 15 分鐘/格
const cellMinutes = ref(30)
const totalCells = computed(() => cellMinutes.value === 30 ? 28 : 56)

// 比例尺：每格最小寬度 + 預設時間精度（緊湊/標準=15分鐘、寬鬆/特寬=30分鐘）
type ScaleKey = 'compact' | 'normal' | 'wide' | 'xwide'
const SCALE_OPTIONS: { key: ScaleKey; label: string; width: number; minutes: 15 | 30 }[] = [
  { key: 'compact', label: '緊湊', width: 20, minutes: 15 },
  { key: 'normal', label: '標準', width: 32, minutes: 15 },
  { key: 'wide', label: '寬鬆', width: 56, minutes: 30 },
  { key: 'xwide', label: '特寬', width: 88, minutes: 30 },
]
const scaleKey = ref<ScaleKey>('normal')
const cellMinWidth = computed(() => SCALE_OPTIONS.find(s => s.key === scaleKey.value)?.width ?? 32)

function setScale(key: ScaleKey) {
  scaleKey.value = key
  const opt = SCALE_OPTIONS.find(s => s.key === key)
  if (opt) cellMinutes.value = opt.minutes
}

// 拖曳中的訂單
const draggingTrip = ref<any>(null)

// 詳情 modal
const selectedTrip = ref<any>(null)
const showDetailModal = ref(false)
const unassigning = ref(false)
const saving = ref(false)

// 輪椅警告
const showWheelchairWarning = ref(false)
const pendingAssign = ref<null | (() => Promise<void>)>(null)


// 一鍵排班
interface Suggestion {
  driverUserId: string
  driverName: string
  fleetName: string | null
  vehiclePlate: string | null
  distanceMeters: number
  distanceText: string
  travelMinutes: number
  fromType: 'home' | 'previous_trip'
  fromAddress: string | null
  reasoning: string
  canAssign: boolean
  conflictReason?: string
}
interface ExcludedDriver {
  driverUserId: string
  driverName: string
  reason: string
}
const showAutoAssignModal = ref(false)
const autoAssignLoading = ref(false)
const autoAssigning = ref(false)
const autoAssignTrip = ref<any>(null)
const autoAssignSuggested = ref<Suggestion | null>(null)
const autoAssignAlternatives = ref<Suggestion[]>([])
const autoAssignExcluded = ref<ExcludedDriver[]>([])
const autoAssignHasFeasible = ref(false)

// 共乘
interface CarpoolPeer {
  tripId: string
  careRecipientName: string | null
  originAddress: string
  scheduledAt: string
  needsWheelchair: boolean
}
interface CarpoolStop {
  tripId: string
  careRecipientName: string | null
  originAddress: string
  pickupOrder: number
  pickupAt: string
  originalScheduledAt: string
  waitMinutes: number
  segmentDistanceMeters: number
  segmentMinutes: number
}
interface CarpoolPlan {
  stops: CarpoolStop[]
  totalDistanceMeters: number
  totalDurationMinutes: number
  arrivalAt: string
  destinationAddress: string
  finalLegDistanceMeters: number
  finalLegMinutes: number
}
const carpoolPeers = ref<CarpoolPeer[]>([])
const carpoolMode = ref(false)
const carpoolPlan = ref<CarpoolPlan | null>(null)
const carpoolPlanLoading = ref(false)
// 使用者可勾選哪些 peer 一起共乘（anchor 永遠勾選不可取消）
const carpoolSelectedIds = ref<Set<string>>(new Set())
let carpoolReplanTimer: ReturnType<typeof setTimeout> | null = null

async function handleAutoAssign(trip: any) {
  autoAssignTrip.value = trip
  autoAssignSuggested.value = null
  autoAssignAlternatives.value = []
  autoAssignExcluded.value = []
  carpoolPeers.value = []
  carpoolMode.value = false
  carpoolPlan.value = null
  showAutoAssignModal.value = true
  autoAssignLoading.value = true
  try {
    // 並行：取司機建議 + 共乘候選
    const [assignRes, peersRes] = await Promise.all([
      api<{
        suggested: Suggestion | null
        alternatives: Suggestion[]
        excluded: ExcludedDriver[]
        hasFeasible: boolean
      }>('/api/dispatch/schedule/auto-assign-suggest', {
        method: 'POST',
        body: { tripId: trip.id },
      }),
      api<{ passengers: CarpoolPeer[]; seatCount: number | null }>('/api/dispatch/carpool/peers', {
        method: 'POST',
        body: { anchorTripId: trip.id },
      }).catch(() => ({ passengers: [] as CarpoolPeer[], seatCount: null })),
    ])
    autoAssignSuggested.value = assignRes.suggested
    autoAssignAlternatives.value = assignRes.alternatives
    autoAssignExcluded.value = assignRes.excluded || []
    autoAssignHasFeasible.value = assignRes.hasFeasible
    // 共乘候選包含 anchor 本身。> 1 才表示有可共乘
    carpoolPeers.value = peersRes.passengers || []
    // 預設全選
    carpoolSelectedIds.value = new Set(carpoolPeers.value.map(p => p.tripId))
  } catch (err: any) {
    toast.add({ title: err?.data?.statusMessage || '無法計算建議', color: 'error' })
    showAutoAssignModal.value = false
  } finally {
    autoAssignLoading.value = false
  }
}

async function toggleCarpoolMode() {
  carpoolMode.value = !carpoolMode.value
  if (carpoolMode.value && !carpoolPlan.value && autoAssignSuggested.value) {
    await fetchCarpoolPlan(autoAssignSuggested.value.driverUserId)
  }
}

async function fetchCarpoolPlan(driverUserId: string) {
  if (carpoolSelectedIds.value.size < 2) {
    carpoolPlan.value = null
    return
  }
  carpoolPlanLoading.value = true
  try {
    const tripIds = carpoolPeers.value
      .filter(p => carpoolSelectedIds.value.has(p.tripId))
      .map(p => p.tripId)
    const res = await api<{ plan: CarpoolPlan }>('/api/dispatch/carpool/plan', {
      method: 'POST',
      body: { tripIds, driverUserId },
    })
    carpoolPlan.value = res.plan
  } catch (err: any) {
    toast.add({ title: err?.data?.statusMessage || '無法計算共乘路線', color: 'error' })
    carpoolPlan.value = null
  } finally {
    carpoolPlanLoading.value = false
  }
}

// 切換某位 peer 是否參與共乘（anchor 不可取消）
function toggleCarpoolPeer(tripId: string) {
  if (tripId === autoAssignTrip.value?.id) return // anchor locked
  const next = new Set(carpoolSelectedIds.value)
  if (next.has(tripId)) next.delete(tripId)
  else next.add(tripId)
  carpoolSelectedIds.value = next
  // debounced 重算路線
  if (carpoolReplanTimer) clearTimeout(carpoolReplanTimer)
  if (carpoolMode.value && autoAssignSuggested.value && next.size >= 2) {
    carpoolReplanTimer = setTimeout(() => {
      fetchCarpoolPlan(autoAssignSuggested.value!.driverUserId)
    }, 250)
  } else if (next.size < 2) {
    carpoolPlan.value = null
  }
}

async function confirmAutoAssign(s: Suggestion) {
  if (!autoAssignTrip.value) return
  autoAssigning.value = true
  try {
    if (carpoolMode.value && carpoolPlan.value && carpoolSelectedIds.value.size >= 2) {
      // 共乘模式：用使用者選定的子集
      const selectedTripIds = carpoolPeers.value
        .filter(p => carpoolSelectedIds.value.has(p.tripId))
        .map(p => p.tripId)
      await api('/api/dispatch/carpool', {
        method: 'POST',
        body: { tripIds: selectedTripIds, driverUserId: s.driverUserId },
      })
      toast.add({ title: `已建立共乘（${selectedTripIds.length} 人）給 ${s.driverName}`, color: 'success' })
    } else {
      // 單筆指派
      const trip = autoAssignTrip.value
      const scheduledAt = new Date(trip.scheduledAt).toISOString()
      const scheduledEndAt = new Date(new Date(trip.scheduledAt).getTime() + (trip.estimatedDuration || 60) * 60_000).toISOString()
      await api(`/api/dispatch/trips/${trip.id}/assign`, {
        method: 'PATCH',
        body: { driverUserId: s.driverUserId, scheduledAt, scheduledEndAt },
      })
      toast.add({ title: `已指派給 ${s.driverName}`, color: 'success' })
    }

    await loadGantt()
    emit('refresh')

    // 連續排班：找下一筆未派
    const next = ganttData.value.unassignedTrips[0]
    if (next) {
      await handleAutoAssign(next)
    } else {
      showAutoAssignModal.value = false
      toast.add({ title: '所有訂單已排班完成', color: 'success' })
    }
  } catch (err: any) {
    if (err?.data?.statusCode === 409) {
      toast.add({ title: '資源衝突', description: err.data.data?.conflicts?.[0]?.detail || '時間重疊', color: 'error' })
    } else {
      toast.add({ title: err?.data?.statusMessage || '指派失敗', color: 'error' })
    }
  } finally {
    autoAssigning.value = false
  }
}

// 「跳過此筆」— 仍開下一筆建議（用於使用者覺得這筆需手動處理）
async function skipAutoAssign() {
  const current = autoAssignTrip.value
  await loadGantt()
  // 跳過當前那筆，找下一筆（避開剛剛跳過的 id）
  const next = ganttData.value.unassignedTrips.find(t => t.id !== current?.id)
  if (next) {
    await handleAutoAssign(next)
  } else {
    showAutoAssignModal.value = false
  }
}

// 時間不一致警告
const showTimeWarning = ref(false)
const timeWarningInfo = ref<{
  trip: any
  originalMinutes: number
  dropMinutes: number
  driverUserId: string
  onConfirmOriginal: () => Promise<void>
  onConfirmDrop: () => Promise<void>
} | null>(null)

function formatMinutes(m: number): string {
  const h = Math.floor(m / 60).toString().padStart(2, '0')
  const min = (m % 60).toString().padStart(2, '0')
  return `${h}:${min}`
}

function getVehicleByDriverUserId(userId: string | null) {
  if (!userId) return null
  const row = ganttData.value.drivers.find(d => d.userId === userId)
  return row?.vehicle ?? null
}

function checkWheelchairConflict(tripNeedsWheelchair: boolean, driverUserId: string | null): boolean {
  if (!tripNeedsWheelchair || !driverUserId) return false
  const vehicle = getVehicleByDriverUserId(driverUserId)
  return vehicle ? (vehicle.wheelchairCapacity ?? 0) === 0 : false
}

// 下拉選單資料
const drivers = ref<any[]>([])
const editDriverUserId = ref<string | null>(null)
const editScheduledAt = ref('')       // datetime-local string
const editEstimatedDuration = ref(60) // minutes

// scheduledAt <-> datetime-local 轉換
function toDatetimeLocal(dt: string | null): string {
  if (!dt) return ''
  const d = new Date(dt)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fromDatetimeLocal(val: string): string {
  // 轉回含時區的 ISO string（使用 +08:00）
  if (!val) return ''
  return val + ':00+08:00'
}

const editScheduledEndAt = computed(() => {
  if (!editScheduledAt.value) return ''
  const d = new Date(fromDatetimeLocal(editScheduledAt.value))
  d.setMinutes(d.getMinutes() + editEstimatedDuration.value)
  return d.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })
})

const driverOptions = computed(() => [
  { label: '未指派', value: null },
  ...drivers.value.map(d => ({
    label: d.fleet?.name ? `${d.user.name}（${d.fleet.name}）` : d.user.name,
    value: d.userId,
  })),
])

async function loadGantt() {
  loading.value = true
  try {
    const res = await api<any>(`/api/dispatch/schedule/gantt?date=${props.date}`)
    ganttData.value = res
  } catch (e: any) {
    toast.add({ title: '載入排班台失敗', color: 'error' })
  } finally {
    loading.value = false
  }
}

onMounted(loadGantt)
watch(() => props.date, loadGantt)
watch(cellMinutes, loadGantt)

// 拖曳指派 — 以司機為主
async function handleDrop(driverUserId: string, startMinutes: number) {
  if (!draggingTrip.value) return

  const trip = draggingTrip.value
  const estimatedDuration = trip.estimatedDuration || 60

  const originalMinutes = datetimeToMinutes(trip.scheduledAt)
  const isSameSlot = startMinutes <= originalMinutes && originalMinutes < startMinutes + cellMinutes.value

  function buildAssignFn(useMinutes: number) {
    const scheduledAt = minutesToDatetime(props.date, useMinutes)
    const scheduledEndAt = minutesToDatetime(props.date, useMinutes + estimatedDuration)
    return async () => {
      try {
        await api(`/api/dispatch/trips/${trip.id}/assign`, {
          method: 'PATCH',
          body: { driverUserId, scheduledAt, scheduledEndAt },
        })
        await loadGantt()
        emit('refresh')
        toast.add({ title: '指派成功', color: 'success' })
      } catch (e: any) {
        if (e?.data?.statusCode === 409) {
          toast.add({
            title: '資源衝突',
            description: e.data.data?.conflicts?.[0]?.detail || '時間重疊，請選擇其他時段',
            color: 'error',
          })
        } else {
          toast.add({ title: '指派失敗', color: 'error' })
        }
      }
      draggingTrip.value = null
    }
  }

  async function proceedWithTime(useMinutes: number) {
    const doAssign = buildAssignFn(useMinutes)
    if (checkWheelchairConflict(trip.needsWheelchair, driverUserId)) {
      pendingAssign.value = doAssign
      showWheelchairWarning.value = true
    } else {
      await doAssign()
    }
  }

  if (!isSameSlot) {
    timeWarningInfo.value = {
      trip,
      originalMinutes,
      dropMinutes: startMinutes,
      driverUserId,
      onConfirmOriginal: () => proceedWithTime(originalMinutes),
      onConfirmDrop: () => proceedWithTime(startMinutes),
    }
    showTimeWarning.value = true
  } else {
    await proceedWithTime(originalMinutes)
  }
}

// 點擊行程開 modal
async function handleTripClick(trip: any) {
  selectedTrip.value = trip
  editDriverUserId.value = trip.driverUserId ?? null
  editScheduledAt.value = toDatetimeLocal(trip.scheduledAt)
  editEstimatedDuration.value = trip.estimatedDuration ?? 60
  showDetailModal.value = true
  if (drivers.value.length === 0) {
    drivers.value = await api<any[]>('/api/dispatch/drivers')
  }
}

async function handleSaveAssign() {
  if (!selectedTrip.value) return
  if (checkWheelchairConflict(selectedTrip.value.needsWheelchair, editDriverUserId.value)) {
    pendingAssign.value = doSaveAssign
    showWheelchairWarning.value = true
    return
  }
  await doSaveAssign()
}

async function doSaveAssign() {
  if (!selectedTrip.value) return
  saving.value = true
  try {
    const scheduledAtStr = fromDatetimeLocal(editScheduledAt.value)
    const endLocal = new Date(new Date(editScheduledAt.value).getTime() + editEstimatedDuration.value * 60000)
    const pad = (n: number) => String(n).padStart(2, '0')
    const scheduledEndAtStr = `${endLocal.getFullYear()}-${pad(endLocal.getMonth() + 1)}-${pad(endLocal.getDate())}T${pad(endLocal.getHours())}:${pad(endLocal.getMinutes())}:00+08:00`

    await api(`/api/dispatch/trips/${selectedTrip.value.id}`, {
      method: 'PUT',
      body: {
        driverUserId: editDriverUserId.value,
        scheduledAt: scheduledAtStr,
        scheduledEndAt: scheduledEndAtStr,
        estimatedDuration: editEstimatedDuration.value,
      },
    })
    toast.add({ title: '已更新指派', color: 'success' })
    showDetailModal.value = false
    await loadGantt()
    emit('refresh')
  } catch {
    toast.add({ title: '更新失敗', color: 'error' })
  } finally {
    saving.value = false
  }
}

async function confirmWheelchairWarning() {
  showWheelchairWarning.value = false
  if (pendingAssign.value) {
    await pendingAssign.value()
    pendingAssign.value = null
  }
}

// 取消派遣
async function handleUnassign() {
  if (!selectedTrip.value) return
  unassigning.value = true
  try {
    await api(`/api/dispatch/trips/${selectedTrip.value.id}`, {
      method: 'PUT',
      body: { driverUserId: null, vehicleId: null, status: 'pending' },
    })
    toast.add({ title: '已取消派遣', color: 'success' })
    showDetailModal.value = false
    await loadGantt()
    emit('refresh')
  } catch {
    toast.add({ title: '取消派遣失敗', color: 'error' })
  } finally {
    unassigning.value = false
  }
}

function minutesToDatetime(date: string, minutes: number): string {
  const h = Math.floor(minutes / 60).toString().padStart(2, '0')
  const m = (minutes % 60).toString().padStart(2, '0')
  return `${date}T${h}:${m}:00+08:00`
}

function datetimeToMinutes(dt: string | Date): number {
  const d = new Date(dt)
  return d.getHours() * 60 + d.getMinutes()
}

function formatDateTime(dt: string | null) {
  if (!dt) return '—'
  return new Date(dt).toLocaleString('zh-TW', {
    month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

// 單筆 trip 路線地圖
const showTripMap = ref(false)

interface MapPoint {
  lat: number
  lng: number
  label: string
  sub?: string
  kind: 'start' | 'stop' | 'dest'
  order?: number
}

const tripArrivalTime = computed(() => {
  const t = selectedTrip.value
  if (!t?.scheduledAt) return null
  const dur = t.estimatedDuration || 60
  const eta = new Date(new Date(t.scheduledAt).getTime() + dur * 60_000)
  return eta.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })
})

const tripMapPoints = computed<MapPoint[]>(() => {
  const t = selectedTrip.value
  if (!t) return []
  const pts: MapPoint[] = []
  // 司機起點（若有）
  const driver = ganttData.value.drivers.find(d => d.userId === t.driverUserId)
  if (driver?.vehicle?.homeLat && driver?.vehicle?.homeLng) {
    pts.push({
      lat: Number(driver.vehicle.homeLat),
      lng: Number(driver.vehicle.homeLng),
      label: '司機起點',
      sub: driver.vehicle.homeAddress || undefined,
      kind: 'start',
    })
  }
  if (t.originLat && t.originLng) {
    pts.push({
      lat: Number(t.originLat),
      lng: Number(t.originLng),
      label: t.careRecipientName || '上車點',
      sub: t.originAddress,
      kind: 'stop',
      order: 1,
    })
  }
  if (t.destinationLat && t.destinationLng) {
    pts.push({
      lat: Number(t.destinationLat),
      lng: Number(t.destinationLng),
      label: '目的地',
      sub: t.destinationAddress,
      kind: 'dest',
    })
  }
  return pts
})

// 共乘詳情 modal
const showCarpoolDetail = ref(false)
const carpoolDetailId = ref<string | null>(null)
function handleCarpoolClick(carpool: any) {
  carpoolDetailId.value = carpool.id
  showCarpoolDetail.value = true
}
async function onCarpoolDissolved() {
  showCarpoolDetail.value = false
  await loadGantt()
  emit('refresh')
}

// 手動共乘流程
const showManualCarpoolModal = ref(false)
const manualCarpoolTripIds = ref<string[]>([])
const manualCarpoolDriverId = ref<string | null>(null)
const manualCarpoolPlan = ref<CarpoolPlan | null>(null)
const manualCarpoolPlanLoading = ref(false)
const manualCarpoolDriverName = ref<string | null>(null)
const manualCarpoolCreating = ref(false)
// 手動共乘：上車 / 下車順序（tripId）
const manualPickupOrder = ref<string[]>([])
const manualDropoffOrder = ref<string[]>([])

// 由 unassignedTrips 對應出選中訂單的明細
const manualCarpoolTripMap = computed<Record<string, any>>(() => {
  const map: Record<string, any> = {}
  for (const t of ganttData.value.unassignedTrips || []) {
    if (manualCarpoolTripIds.value.includes(t.id)) map[t.id] = t
  }
  return map
})

function tripLabel(tripId: string): string {
  const t = manualCarpoolTripMap.value[tripId]
  if (!t) return tripId
  const time = new Date(t.scheduledAt).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })
  return `${t.careRecipientName ?? '未知個案'} · ${time}`
}

function moveInList(list: 'pickup' | 'dropoff', index: number, delta: number) {
  const arr = list === 'pickup' ? manualPickupOrder.value : manualDropoffOrder.value
  const next = index + delta
  if (next < 0 || next >= arr.length) return
  const copy = [...arr]
  const tmp = copy[index]!
  copy[index] = copy[next]!
  copy[next] = tmp
  if (list === 'pickup') manualPickupOrder.value = copy
  else manualDropoffOrder.value = copy
  // 順序變更後清除過期 plan
  manualCarpoolPlan.value = null
}

async function handleManualCarpool(tripIds: string[]) {
  manualCarpoolTripIds.value = tripIds
  manualCarpoolDriverId.value = null
  manualCarpoolPlan.value = null
  manualCarpoolDriverName.value = null
  // 預設順序：依原訂時間
  const sorted = [...tripIds].sort((a, b) => {
    const ta = ganttData.value.unassignedTrips?.find((t: any) => t.id === a)?.scheduledAt ?? ''
    const tb = ganttData.value.unassignedTrips?.find((t: any) => t.id === b)?.scheduledAt ?? ''
    return ta.localeCompare(tb)
  })
  manualPickupOrder.value = sorted
  manualDropoffOrder.value = [...sorted]
  showManualCarpoolModal.value = true
  if (drivers.value.length === 0) {
    drivers.value = await api<any[]>('/api/dispatch/drivers')
  }
}

async function previewManualCarpool() {
  if (!manualCarpoolDriverId.value) return
  manualCarpoolPlanLoading.value = true
  try {
    const res = await api<{ plan: CarpoolPlan; driver: { name: string; fleetName: string | null } }>('/api/dispatch/carpool/plan', {
      method: 'POST',
      body: {
        tripIds: manualCarpoolTripIds.value,
        driverUserId: manualCarpoolDriverId.value,
        pickupOrder: manualPickupOrder.value,
        dropoffOrder: manualDropoffOrder.value,
      },
    })
    manualCarpoolPlan.value = res.plan
    manualCarpoolDriverName.value = res.driver.fleetName ? `${res.driver.name}（${res.driver.fleetName}）` : res.driver.name
  } catch (err: any) {
    toast.add({ title: err?.data?.statusMessage || '無法計算路線', color: 'error' })
  } finally {
    manualCarpoolPlanLoading.value = false
  }
}

async function commitManualCarpool() {
  if (!manualCarpoolDriverId.value || !manualCarpoolPlan.value) return
  manualCarpoolCreating.value = true
  try {
    await api('/api/dispatch/carpool', {
      method: 'POST',
      body: {
        tripIds: manualCarpoolTripIds.value,
        driverUserId: manualCarpoolDriverId.value,
        pickupOrder: manualPickupOrder.value,
        dropoffOrder: manualDropoffOrder.value,
      },
    })
    toast.add({ title: `已建立共乘（${manualCarpoolTripIds.value.length} 人）`, color: 'success' })
    showManualCarpoolModal.value = false
    await loadGantt()
    emit('refresh')
  } catch (err: any) {
    toast.add({ title: err?.data?.statusMessage || '建立失敗', color: 'error' })
  } finally {
    manualCarpoolCreating.value = false
  }
}

provide('ganttState', {
  cellMinutes,
  draggingTrip,
  datetimeToMinutes,
  onDrop: handleDrop,
  onTripClick: handleTripClick,
  onCarpoolClick: handleCarpoolClick,
})
</script>

<template>
  <div class="flex gap-4 h-full">
    <!-- 左側：甘特圖主體 -->
    <div class="flex-1 overflow-hidden flex flex-col">
      <!-- 工具列 -->
      <div class="flex items-center justify-between mb-3 shrink-0">
        <h2 class="text-lg font-semibold">排班台 — {{ date }}</h2>
        <div class="flex items-center gap-2">
          <span class="text-sm text-muted">時間精度：</span>
          <div class="flex rounded-md overflow-hidden border border-default">
            <button
              v-for="unit in [30, 15]"
              :key="unit"
              class="px-3 py-1.5 text-sm transition-colors"
              :class="cellMinutes === unit ? 'bg-primary text-white' : 'hover:bg-default text-muted'"
              @click="cellMinutes = unit"
            >{{ unit }}分鐘</button>
          </div>
          <span class="text-sm text-muted">比例尺：</span>
          <div class="flex rounded-md overflow-hidden border border-default">
            <button
              v-for="opt in SCALE_OPTIONS"
              :key="opt.key"
              class="px-3 py-1.5 text-sm transition-colors"
              :class="scaleKey === opt.key ? 'bg-primary text-white' : 'hover:bg-default text-muted'"
              @click="setScale(opt.key)"
            >{{ opt.label }}</button>
          </div>
          <!-- 顏色說明 -->
          <div class="flex items-center gap-2 text-xs border border-default rounded-md px-3 py-1.5">
            <span class="flex items-center gap-1"><span class="w-3 h-3 rounded-sm bg-blue-200 border border-blue-300 inline-block" />已指派</span>
            <span class="flex items-center gap-1"><span class="w-3 h-3 rounded-sm bg-green-200 border border-green-300 inline-block" />進行中</span>
            <span class="flex items-center gap-1"><span class="w-3 h-3 rounded-sm bg-gray-200 border border-gray-300 inline-block" />已完成</span>
            <span class="flex items-center gap-1"><span class="w-3 h-3 rounded-sm bg-red-200 border border-red-300 inline-block" />已取消</span>
          </div>
          <UButton size="sm" variant="outline" icon="i-lucide-refresh-cw" @click="loadGantt" :loading="loading">
            重新整理
          </UButton>
        </div>
      </div>

      <!-- 甘特圖捲動容器 -->
      <div class="overflow-x-auto border border-default rounded-lg flex-1">
        <div class="min-w-max">
          <GanttTimeHeader :cell-minutes="cellMinutes" :total-cells="totalCells" :cell-min-width="cellMinWidth" />
          <div v-if="loading" class="p-8 text-center text-muted">載入中...</div>
          <GanttRow
            v-for="driver in ganttData.drivers"
            :key="driver.userId"
            :driver="driver"
            :cell-minutes="cellMinutes"
            :total-cells="totalCells"
            :cell-min-width="cellMinWidth"
          />
        </div>
      </div>
    </div>

    <!-- 右側：待派訂單池 -->
    <div class="w-64 shrink-0 h-full">
      <GanttOrderPool
        :trips="ganttData.unassignedTrips"
        @drag-start="draggingTrip = $event"
        @trip-click="handleTripClick"
        @auto-assign="handleAutoAssign"
        @manual-carpool="handleManualCarpool"
      />
    </div>

    <!-- 行程詳情 Modal (唯讀，只能取消派遣或檢視地圖) -->
    <UModal v-model:open="showDetailModal" title="行程詳情" description=" ">
      <template #content>
        <div v-if="selectedTrip" class="p-5 space-y-4">
          <div class="space-y-2 text-sm">
            <div class="grid grid-cols-3 gap-1">
              <span class="text-muted">案主</span>
              <span class="col-span-2 font-medium">{{ selectedTrip.careRecipientName || '—' }}</span>
            </div>
            <div class="grid grid-cols-3 gap-1">
              <span class="text-muted">出發時間</span>
              <span class="col-span-2">{{ formatDateTime(selectedTrip.scheduledAt) }}</span>
            </div>
            <div class="grid grid-cols-3 gap-1">
              <span class="text-muted">行程時長</span>
              <span class="col-span-2">{{ selectedTrip.estimatedDuration || 60 }} 分鐘</span>
            </div>
            <div class="grid grid-cols-3 gap-1">
              <span class="text-muted">預計抵達</span>
              <span class="col-span-2">{{ tripArrivalTime || '—' }}</span>
            </div>
            <div class="grid grid-cols-3 gap-1">
              <span class="text-muted">起點</span>
              <span class="col-span-2">{{ selectedTrip.originAddress || '—' }}</span>
            </div>
            <div class="grid grid-cols-3 gap-1">
              <span class="text-muted">終點</span>
              <span class="col-span-2">{{ selectedTrip.destinationAddress || '—' }}</span>
            </div>
            <div class="grid grid-cols-3 gap-1">
              <span class="text-muted">司機</span>
              <span class="col-span-2">{{ selectedTrip.driverName || '—' }}</span>
            </div>
            <div v-if="selectedTrip.needsWheelchair" class="grid grid-cols-3 gap-1">
              <span class="text-muted">輪椅</span>
              <span class="col-span-2"><UBadge label="需要" color="info" size="xs" /></span>
            </div>
          </div>

          <div class="flex justify-between pt-2 border-t border-default">
            <UButton
              v-if="selectedTrip.vehicleId"
              color="error"
              variant="ghost"
              size="sm"
              icon="i-lucide-unlink"
              :loading="unassigning"
              @click="handleUnassign"
            >取消派遣</UButton>
            <span v-else />
            <div class="flex gap-2">
              <UButton
                v-if="tripMapPoints.length >= 2"
                color="neutral"
                variant="outline"
                icon="i-lucide-map"
                @click="showTripMap = true"
              >地圖檢視</UButton>
              <UButton variant="ghost" @click="showDetailModal = false">關閉</UButton>
            </div>
          </div>
        </div>
      </template>
    </UModal>

    <!-- 單筆訂單路線地圖 -->
    <GanttCarpoolMapModal
      v-model:open="showTripMap"
      :points="tripMapPoints"
      title="行程路線地圖"
    />
    <!-- 輪椅衝突警告 -->
    <UModal v-model:open="showWheelchairWarning" title="輪椅需求警告" description=" ">
      <template #content>
        <div class="p-6 space-y-4">
          <div class="flex items-start gap-3">
            <UIcon name="i-lucide-alert-triangle" class="text-2xl text-warning shrink-0 mt-0.5" />
            <p class="text-sm text-muted">此個案需要輪椅，但所選車輛<span class="font-semibold text-highlighted">可載輪椅數為 0</span>。確定仍要指派嗎？</p>
          </div>
          <div class="flex justify-end gap-2">
            <UButton color="neutral" variant="outline" @click="showWheelchairWarning = false; pendingAssign = null">取消</UButton>
            <UButton color="warning" @click="confirmWheelchairWarning">確定指派</UButton>
          </div>
        </div>
      </template>
    </UModal>

    <!-- 一鍵排班建議 -->
    <UModal v-model:open="showAutoAssignModal" title="一鍵排班建議" description=" " size="lg">
      <template #content>
        <div class="p-6 space-y-4 max-h-[85vh] overflow-y-auto">
          <div v-if="autoAssignLoading" class="flex items-center justify-center py-12">
            <UIcon name="i-lucide-loader-2" class="text-3xl animate-spin text-muted" />
            <span class="ml-2 text-sm text-muted">計算最佳司機中…</span>
          </div>
          <template v-else>
            <div v-if="autoAssignTrip" class="text-sm space-y-1">
              <p class="text-xs text-muted">
                <UBadge color="primary" variant="subtle" size="xs">剩 {{ ganttData.unassignedTrips.length }} 筆待派</UBadge>
              </p>
              <p>個案：<span class="font-medium text-highlighted">{{ autoAssignTrip.careRecipientName }}</span></p>
              <p class="text-muted">出發：{{ new Date(autoAssignTrip.scheduledAt).toLocaleString('zh-TW') }}</p>
              <p class="text-muted truncate">起點：{{ autoAssignTrip.originAddress || '—' }}</p>
            </div>

            <!-- 推薦 -->
            <div v-if="autoAssignSuggested" class="border-2 rounded-lg p-4 space-y-2"
              :class="autoAssignSuggested.canAssign ? 'border-success bg-success/5' : 'border-warning bg-warning/5'">
              <div class="flex items-center gap-2">
                <UIcon
                  :name="autoAssignSuggested.canAssign ? 'i-lucide-circle-check' : 'i-lucide-alert-triangle'"
                  :class="autoAssignSuggested.canAssign ? 'text-success' : 'text-warning'"
                  class="text-xl"
                />
                <p class="text-sm font-semibold">
                  {{ autoAssignSuggested.canAssign ? '推薦司機' : '無可指派司機，最接近：' }}
                </p>
              </div>
              <div>
                <p class="text-base font-bold">
                  {{ autoAssignSuggested.driverName }}
                  <span v-if="autoAssignSuggested.fleetName" class="text-sm text-muted font-normal">（{{ autoAssignSuggested.fleetName }}）</span>
                </p>
                <p v-if="autoAssignSuggested.vehiclePlate" class="text-xs text-muted">{{ autoAssignSuggested.vehiclePlate }}</p>
              </div>
              <p class="text-sm">{{ autoAssignSuggested.reasoning }}</p>
              <p v-if="autoAssignSuggested.conflictReason" class="text-sm text-error font-medium">
                ⚠ {{ autoAssignSuggested.conflictReason }}
              </p>

              <!-- 共乘建議 -->
              <div v-if="carpoolPeers.length > 1" class="border-t border-default pt-3 mt-2">
                <label class="flex items-center gap-2 cursor-pointer">
                  <UCheckbox :model-value="carpoolMode" @update:model-value="toggleCarpoolMode" />
                  <span class="text-sm font-medium">
                    <UIcon name="i-lucide-users" class="inline" />
                    可共乘 {{ carpoolPeers.length }} 人 — 同目的地、時間相近
                  </span>
                </label>
                <div v-if="carpoolMode" class="mt-3 space-y-2">
                  <p class="text-xs text-muted">勾選要一起共乘的乘客（至少 2 人）：</p>
                  <!-- 候選人勾選清單 -->
                  <div class="space-y-1.5">
                    <label
                      v-for="p in carpoolPeers"
                      :key="p.tripId"
                      class="flex items-start gap-2 p-2 rounded border border-default text-xs cursor-pointer hover:bg-elevated transition-colors"
                      :class="carpoolSelectedIds.has(p.tripId) ? 'bg-primary/5 border-primary/40' : 'opacity-60'"
                    >
                      <UCheckbox
                        :model-value="carpoolSelectedIds.has(p.tripId)"
                        :disabled="p.tripId === autoAssignTrip?.id"
                        @update:model-value="() => toggleCarpoolPeer(p.tripId)"
                      />
                      <div class="flex-1 min-w-0">
                        <p class="font-medium">
                          {{ p.careRecipientName }}
                          <UBadge v-if="p.tripId === autoAssignTrip?.id" label="原訂單" color="primary" variant="subtle" size="xs" />
                          <UBadge v-if="p.needsWheelchair" label="輪椅" color="info" variant="subtle" size="xs" />
                        </p>
                        <p class="text-muted truncate">{{ p.originAddress }}</p>
                        <p class="text-muted">原約 {{ new Date(p.scheduledAt).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }) }}</p>
                      </div>
                    </label>
                  </div>

                  <!-- 計算後路線 -->
                  <div v-if="carpoolSelectedIds.size < 2" class="text-xs text-warning">
                    至少需勾選 2 人才能建立共乘
                  </div>
                  <div v-else-if="carpoolPlanLoading" class="text-xs text-muted">計算共乘路線中…</div>
                  <div v-else-if="carpoolPlan" class="text-xs space-y-2 border-t border-default pt-2">
                    <p class="text-muted">路線（共 {{ (carpoolPlan.totalDistanceMeters / 1000).toFixed(1) }} km / {{ carpoolPlan.totalDurationMinutes }} 分鐘）：</p>
                    <ol class="space-y-1.5">
                      <li v-for="stop in carpoolPlan.stops" :key="stop.tripId" class="flex items-start gap-2">
                        <span class="shrink-0 w-5 h-5 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center mt-0.5">{{ stop.pickupOrder }}</span>
                        <div class="flex-1 min-w-0">
                          <p class="font-medium">{{ stop.careRecipientName }}</p>
                          <p>
                            <span class="text-muted">上車</span> {{ new Date(stop.pickupAt).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }) }}
                            <span v-if="stop.waitMinutes > 0" class="text-warning ml-1">(等 {{ stop.waitMinutes }} 分)</span>
                            <span v-else class="text-muted ml-1">(準時)</span>
                          </p>
                        </div>
                      </li>
                      <li class="flex items-start gap-2 pt-1 border-t border-default">
                        <UIcon name="i-lucide-flag" class="text-success mt-0.5" />
                        <div class="flex-1 min-w-0">
                          <p class="font-medium">抵達 {{ carpoolPlan.destinationAddress }}</p>
                          <p class="text-success">
                            預估 {{ new Date(carpoolPlan.arrivalAt).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }) }}
                          </p>
                        </div>
                      </li>
                    </ol>
                  </div>
                </div>
              </div>

              <UButton
                v-if="autoAssignSuggested.canAssign"
                color="primary"
                block
                :loading="autoAssigning"
                icon="i-lucide-check"
                :disabled="carpoolMode && (!carpoolPlan || carpoolSelectedIds.size < 2)"
                @click="confirmAutoAssign(autoAssignSuggested)"
              >
                {{ carpoolMode
                  ? (carpoolSelectedIds.size >= 2
                    ? `確認建立共乘（${carpoolSelectedIds.size} 人）`
                    : '請至少勾選 2 人')
                  : `確認指派給 ${autoAssignSuggested.driverName}` }}
              </UButton>
            </div>

            <div v-else class="text-center py-6 text-muted text-sm">
              無合適司機可推薦
              <p v-if="autoAssignExcluded.length === 0" class="mt-1 text-xs">系統中沒有已核准的司機</p>
            </div>

            <!-- 被排除的司機（無候補時顯示在這裡） -->
            <div v-if="autoAssignExcluded.length > 0" class="space-y-2">
              <p class="text-xs text-muted">無法評估的司機：</p>
              <div class="border border-default rounded-lg p-3 space-y-1.5">
                <div v-for="ex in autoAssignExcluded" :key="ex.driverUserId" class="flex items-center justify-between text-xs">
                  <span class="font-medium">{{ ex.driverName }}</span>
                  <span class="text-error">{{ ex.reason }}</span>
                </div>
              </div>
              <p class="text-xs text-muted">
                提示：請至 <NuxtLink to="/admin/drivers" class="text-primary hover:underline">司機管理</NuxtLink> 編輯各司機的車輛起始地（含座標）。
              </p>
            </div>

            <!-- 候補 -->
            <div v-if="autoAssignAlternatives.length > 0" class="space-y-2">
              <p class="text-xs text-muted">其他候補：</p>
              <div
                v-for="alt in autoAssignAlternatives"
                :key="alt.driverUserId"
                class="border border-default rounded-lg p-3 flex items-center justify-between gap-3"
              >
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-medium">
                    {{ alt.driverName }}
                    <span v-if="alt.fleetName" class="text-xs text-muted font-normal">（{{ alt.fleetName }}）</span>
                    <UBadge v-if="!alt.canAssign" label="衝突" color="error" variant="subtle" size="xs" class="ml-1" />
                  </p>
                  <p class="text-xs text-muted truncate">{{ alt.reasoning }}</p>
                  <p v-if="alt.conflictReason" class="text-xs text-error">{{ alt.conflictReason }}</p>
                </div>
                <UButton
                  v-if="alt.canAssign"
                  size="xs"
                  variant="outline"
                  :loading="autoAssigning"
                  @click="confirmAutoAssign(alt)"
                >
                  改派
                </UButton>
              </div>
            </div>

            <div class="flex justify-between pt-2">
              <UButton
                v-if="ganttData.unassignedTrips.length > 1"
                color="neutral"
                variant="ghost"
                icon="i-lucide-skip-forward"
                @click="skipAutoAssign"
              >跳過此筆</UButton>
              <span v-else />
              <UButton color="neutral" variant="ghost" @click="showAutoAssignModal = false">關閉</UButton>
            </div>
          </template>
        </div>
      </template>
    </UModal>

    <!-- 共乘詳情 -->
    <GanttCarpoolDetailModal
      v-model:open="showCarpoolDetail"
      :carpool-group-id="carpoolDetailId"
      @dissolved="onCarpoolDissolved"
    />

    <!-- 手動建立共乘 -->
    <UModal v-model:open="showManualCarpoolModal" title="手動建立共乘" description=" " size="xl">
      <template #content>
        <div class="p-6 space-y-4 max-h-[85vh] overflow-y-auto">
          <p class="text-sm text-muted">已選 {{ manualCarpoolTripIds.length }} 筆訂單，可調整上車/下車順序（支援多目的地）</p>

          <UFormField label="指派司機">
            <USelect
              v-model="manualCarpoolDriverId"
              :items="driverOptions.filter(d => d.value !== null)"
              value-key="value"
              placeholder="選擇司機..."
              class="w-full"
            />
          </UFormField>

          <!-- 順序調整 -->
          <div class="grid grid-cols-2 gap-3">
            <div class="border border-default rounded-lg p-3">
              <p class="text-xs font-semibold mb-2 flex items-center gap-1">
                <UIcon name="i-lucide-arrow-up-circle" class="text-primary" />上車順序
              </p>
              <ul class="space-y-1.5">
                <li v-for="(tid, idx) in manualPickupOrder" :key="`pk-${tid}`" class="flex items-center gap-1.5 text-xs">
                  <span class="shrink-0 w-5 h-5 rounded-full bg-primary text-white font-bold flex items-center justify-center">{{ idx + 1 }}</span>
                  <span class="flex-1 min-w-0 truncate">{{ tripLabel(tid) }}</span>
                  <UButton icon="i-lucide-chevron-up" size="xs" variant="ghost" :disabled="idx === 0" @click="moveInList('pickup', idx, -1)" />
                  <UButton icon="i-lucide-chevron-down" size="xs" variant="ghost" :disabled="idx === manualPickupOrder.length - 1" @click="moveInList('pickup', idx, 1)" />
                </li>
              </ul>
            </div>
            <div class="border border-default rounded-lg p-3">
              <p class="text-xs font-semibold mb-2 flex items-center gap-1">
                <UIcon name="i-lucide-arrow-down-circle" class="text-success" />下車順序
              </p>
              <ul class="space-y-1.5">
                <li v-for="(tid, idx) in manualDropoffOrder" :key="`dp-${tid}`" class="flex items-center gap-1.5 text-xs">
                  <span class="shrink-0 w-5 h-5 rounded-full bg-success text-white font-bold flex items-center justify-center">{{ idx + 1 }}</span>
                  <span class="flex-1 min-w-0 truncate">{{ tripLabel(tid) }}</span>
                  <UButton icon="i-lucide-chevron-up" size="xs" variant="ghost" :disabled="idx === 0" @click="moveInList('dropoff', idx, -1)" />
                  <UButton icon="i-lucide-chevron-down" size="xs" variant="ghost" :disabled="idx === manualDropoffOrder.length - 1" @click="moveInList('dropoff', idx, 1)" />
                </li>
              </ul>
            </div>
          </div>

          <UButton
            color="neutral"
            variant="outline"
            block
            :loading="manualCarpoolPlanLoading"
            :disabled="!manualCarpoolDriverId"
            icon="i-lucide-route"
            @click="previewManualCarpool"
          >預覽路線</UButton>

          <!-- 計畫顯示 -->
          <div v-if="manualCarpoolPlan" class="border border-default rounded-lg p-3 space-y-2">
            <p class="text-sm">
              <span class="text-muted">司機：</span><span class="font-medium">{{ manualCarpoolDriverName }}</span>
              <UBadge v-if="manualCarpoolPlan.multiDestination" label="多目的地" color="warning" variant="subtle" size="xs" class="ml-2" />
            </p>
            <p class="text-xs text-muted">
              全程 {{ (manualCarpoolPlan.totalDistanceMeters / 1000).toFixed(1) }} km · {{ manualCarpoolPlan.totalDurationMinutes }} 分鐘
            </p>
            <ol class="space-y-1.5 text-xs">
              <li v-for="stop in manualCarpoolPlan.stops" :key="`pk-${stop.tripId}`" class="flex items-start gap-2">
                <span class="shrink-0 w-5 h-5 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center mt-0.5">{{ stop.pickupOrder }}</span>
                <div class="flex-1 min-w-0">
                  <p class="font-medium">{{ stop.careRecipientName }} <span class="text-xs text-muted">上車</span></p>
                  <p class="text-muted truncate">{{ stop.originAddress }}</p>
                  <p>
                    {{ new Date(stop.pickupAt).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }) }}
                    <span v-if="stop.waitMinutes > 0" class="text-warning ml-1">(等 {{ stop.waitMinutes }} 分)</span>
                  </p>
                </div>
              </li>
              <li v-for="drop in manualCarpoolPlan.dropoffStops" :key="`dp-${drop.tripId}`" class="flex items-start gap-2 pt-1 border-t border-default/50">
                <span class="shrink-0 w-5 h-5 rounded-full bg-success text-white text-xs font-bold flex items-center justify-center mt-0.5">{{ drop.dropoffOrder }}</span>
                <div class="flex-1 min-w-0">
                  <p class="font-medium">{{ drop.careRecipientName }} <span class="text-xs text-muted">下車</span></p>
                  <p class="text-muted truncate">{{ drop.destinationAddress }}</p>
                  <p class="text-success">{{ new Date(drop.dropoffAt).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }) }}</p>
                </div>
              </li>
            </ol>
          </div>

          <div class="flex justify-end gap-2 pt-2">
            <UButton color="neutral" variant="ghost" @click="showManualCarpoolModal = false">取消</UButton>
            <UButton
              color="primary"
              :disabled="!manualCarpoolPlan"
              :loading="manualCarpoolCreating"
              icon="i-lucide-check"
              @click="commitManualCarpool"
            >確認建立共乘</UButton>
          </div>
        </div>
      </template>
    </UModal>

    <!-- 時間不一致警告 -->
    <UModal v-model:open="showTimeWarning" title="出發時間與原定不同" description=" ">
      <template #content>
        <div v-if="timeWarningInfo" class="p-6 space-y-4">
          <div class="flex items-start gap-3">
            <UIcon name="i-lucide-clock-alert" class="text-2xl text-warning shrink-0 mt-0.5" />
            <div class="text-sm space-y-1">
              <p class="text-muted">您將
                <span class="font-semibold text-highlighted">{{ timeWarningInfo.trip.careRecipientName }}</span>
                拖曳到的時間與原定出發時間不同：
              </p>
              <div class="mt-2 grid grid-cols-2 gap-3">
                <div class="rounded-lg border border-default p-3 text-center">
                  <p class="text-xs text-muted mb-1">原定時間</p>
                  <p class="text-lg font-bold text-primary">{{ formatMinutes(timeWarningInfo.originalMinutes) }}</p>
                </div>
                <div class="rounded-lg border border-warning/50 bg-warning/5 p-3 text-center">
                  <p class="text-xs text-muted mb-1">拖曳時間</p>
                  <p class="text-lg font-bold text-warning">{{ formatMinutes(timeWarningInfo.dropMinutes) }}</p>
                </div>
              </div>
            </div>
          </div>
          <div class="flex flex-col gap-2 pt-1">
            <UButton
              color="primary"
              icon="i-lucide-clock"
              class="w-full justify-center"
              @click="showTimeWarning = false; timeWarningInfo?.onConfirmOriginal()"
            >
              使用原定時間（{{ formatMinutes(timeWarningInfo.originalMinutes) }}）
            </UButton>
            <UButton
              color="warning"
              variant="outline"
              icon="i-lucide-move-right"
              class="w-full justify-center"
              @click="showTimeWarning = false; timeWarningInfo?.onConfirmDrop()"
            >
              使用拖曳時間（{{ formatMinutes(timeWarningInfo.dropMinutes) }}）
            </UButton>
            <UButton
              color="neutral"
              variant="ghost"
              class="w-full justify-center"
              @click="showTimeWarning = false; timeWarningInfo = null; draggingTrip = null"
            >
              取消
            </UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
