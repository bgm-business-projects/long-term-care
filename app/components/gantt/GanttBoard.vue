<script setup lang="ts">
const props = defineProps<{
  date: string  // 'YYYY-MM-DD'
}>()

const emit = defineEmits<{ refresh: [] }>()

const { api } = useApi()
const toast = useToast()

// 甘特圖資料
const ganttData = ref<{ vehicles: any[], unassignedTrips: any[] }>({ vehicles: [], unassignedTrips: [] })
const loading = ref(false)

// 時間單位：30 或 15 分鐘/格
const cellMinutes = ref(30)
const totalCells = computed(() => cellMinutes.value === 30 ? 28 : 56)

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


// 時間不一致警告
const showTimeWarning = ref(false)
const timeWarningInfo = ref<{
  trip: any
  originalMinutes: number
  dropMinutes: number
  vehicleId: string
  onConfirmOriginal: () => Promise<void>
  onConfirmDrop: () => Promise<void>
} | null>(null)

function formatMinutes(m: number): string {
  const h = Math.floor(m / 60).toString().padStart(2, '0')
  const min = (m % 60).toString().padStart(2, '0')
  return `${h}:${min}`
}

function getVehicleById(id: string | null) {
  return vehicles.value.find(v => v.id === id) ?? ganttData.value.vehicles.find(v => v.id === id) ?? null
}

function checkWheelchairConflict(tripNeedsWheelchair: boolean, vehicleId: string | null): boolean {
  if (!tripNeedsWheelchair || !vehicleId) return false
  const vehicle = getVehicleById(vehicleId)
  return vehicle ? (vehicle.wheelchairCapacity ?? 0) === 0 : false
}

function getWheelchairCapacity(vehicleId: string | null): number {
  if (!vehicleId) return 0
  const vehicle = getVehicleById(vehicleId)
  return vehicle?.wheelchairCapacity ?? 0
}

// 下拉選單資料
const drivers = ref<any[]>([])
const vehicles = ref<any[]>([])
const editVehicleId = ref<string | null>(null)
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
  ...drivers.value.map(d => ({ label: d.user.name, value: d.userId })),
])
const vehicleOptions = computed(() => [
  { label: '未指派', value: null },
  ...vehicles.value.map(v => ({ label: `${v.plate}（${v.vehicleType}）`, value: v.id })),
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

// 拖曳指派
async function handleDrop(vehicleId: string, vehicleDriverUserId: string | null, startMinutes: number) {
  if (!draggingTrip.value) return

  const trip = draggingTrip.value
  const estimatedDuration = trip.estimatedDuration || 60

  // 判斷拖曳時間與原定時間是否相同（在同一個格子內視為相同）
  const originalMinutes = datetimeToMinutes(trip.scheduledAt)
  const isSameSlot = startMinutes <= originalMinutes && originalMinutes < startMinutes + cellMinutes.value

  function buildAssignFn(useMinutes: number) {
    const scheduledAt = minutesToDatetime(props.date, useMinutes)
    const scheduledEndAt = minutesToDatetime(props.date, useMinutes + estimatedDuration)
    return async () => {
      try {
        await api(`/api/dispatch/trips/${trip.id}/assign`, {
          method: 'PATCH',
          body: { vehicleId, scheduledAt, scheduledEndAt },
        })
        await loadGantt()
        emit('refresh')
        toast.add({ title: '指派成功', color: 'success' })
      } catch (e: any) {
        if (e?.data?.statusCode === 409) {
          toast.add({
            title: '資源衝突',
            description: e.data.data?.conflicts?.[0]?.detail || '時間重疊，請選擇其他時段',
            color: 'error'
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
    if (checkWheelchairConflict(trip.needsWheelchair, vehicleId)) {
      pendingAssign.value = doAssign
      showWheelchairWarning.value = true
    } else {
      await doAssign()
    }
  }

  // 時間不同時（不論來源）先提示
  if (!isSameSlot) {
    timeWarningInfo.value = {
      trip,
      originalMinutes,
      dropMinutes: startMinutes,
      vehicleId,
      onConfirmOriginal: () => proceedWithTime(originalMinutes),
      onConfirmDrop: () => proceedWithTime(startMinutes),
    }
    showTimeWarning.value = true
  } else {
    // 同一時間格，保留原定時間但仍做輪椅檢查
    await proceedWithTime(originalMinutes)
  }
}

// 點擊行程開 modal
async function handleTripClick(trip: any) {
  selectedTrip.value = trip
  editVehicleId.value = trip.vehicleId ?? null
  editDriverUserId.value = trip.driverUserId ?? null
  editScheduledAt.value = toDatetimeLocal(trip.scheduledAt)
  editEstimatedDuration.value = trip.estimatedDuration ?? 60
  showDetailModal.value = true
  // 載入司機與車輛清單（只載入一次）
  if (drivers.value.length === 0 || vehicles.value.length === 0) {
    const [d, v] = await Promise.all([
      api<any[]>('/api/dispatch/drivers'),
      api<any[]>('/api/dispatch/vehicles'),
    ])
    drivers.value = d
    vehicles.value = v
  }
}

// 儲存司機/車輛指派
async function handleSaveAssign() {
  if (!selectedTrip.value) return

  if (checkWheelchairConflict(selectedTrip.value.needsWheelchair, editVehicleId.value)) {
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
    // 用 datetime-local 字串直接加分鐘，避免 UTC 轉換問題
    const endLocal = new Date(new Date(editScheduledAt.value).getTime() + editEstimatedDuration.value * 60000)
    const pad = (n: number) => String(n).padStart(2, '0')
    const scheduledEndAtStr = `${endLocal.getFullYear()}-${pad(endLocal.getMonth() + 1)}-${pad(endLocal.getDate())}T${pad(endLocal.getHours())}:${pad(endLocal.getMinutes())}:00+08:00`

    await api(`/api/dispatch/trips/${selectedTrip.value.id}`, {
      method: 'PUT',
      body: {
        vehicleId: editVehicleId.value,
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
      body: { vehicleId: null, driverUserId: null, status: 'pending' },
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

provide('ganttState', {
  cellMinutes,
  draggingTrip,
  datetimeToMinutes,
  onDrop: handleDrop,
  onTripClick: handleTripClick,
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
          <!-- 顏色說明 -->
          <div class="flex items-center gap-2 text-xs border border-default rounded-md px-3 py-1.5">
            <span class="flex items-center gap-1"><span class="w-3 h-3 rounded-sm bg-blue-200 border border-blue-300 inline-block" />已指派</span>
            <span class="flex items-center gap-1"><span class="w-3 h-3 rounded-sm bg-green-200 border border-green-300 inline-block" />進行中</span>
            <span class="flex items-center gap-1"><span class="w-3 h-3 rounded-sm bg-gray-200 border border-gray-300 inline-block" />已完成</span>
            <span class="flex items-center gap-1"><span class="w-3 h-3 rounded-sm bg-red-200 border border-red-300 inline-block" />已取消</span>
            <span class="flex items-center gap-1"><UIcon name="i-lucide-user-x" class="text-warning" />未排司機</span>
          </div>
          <UButton size="sm" variant="outline" icon="i-lucide-refresh-cw" @click="loadGantt" :loading="loading">
            重新整理
          </UButton>
        </div>
      </div>

      <!-- 甘特圖捲動容器 -->
      <div class="overflow-x-auto border border-default rounded-lg flex-1">
        <div class="min-w-max">
          <GanttTimeHeader :cell-minutes="cellMinutes" :total-cells="totalCells" />
          <div v-if="loading" class="p-8 text-center text-muted">載入中...</div>
          <GanttRow
            v-for="vehicle in ganttData.vehicles"
            :key="vehicle.id"
            :vehicle="vehicle"
            :cell-minutes="cellMinutes"
            :total-cells="totalCells"
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
      />
    </div>

    <!-- 行程詳情 Modal -->
    <UModal v-model:open="showDetailModal" title="行程詳情" description=" ">
      <template #content>
        <div v-if="selectedTrip" class="p-5 space-y-4">
          <div class="space-y-2 text-sm">
            <div class="grid grid-cols-3 gap-1">
              <span class="text-muted">案主</span>
              <span class="col-span-2 font-medium">{{ selectedTrip.careRecipientName || '—' }}</span>
            </div>
            <div class="grid grid-cols-3 gap-1 items-center">
              <span class="text-muted">出發時間</span>
              <div class="col-span-2">
                <input
                  v-model="editScheduledAt"
                  type="datetime-local"
                  class="w-full px-2 py-1 text-sm border border-default rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
            <div class="grid grid-cols-3 gap-1 items-center">
              <span class="text-muted">行程時長</span>
              <div class="col-span-2 flex items-center gap-2">
                <UButton icon="i-lucide-minus" size="xs" variant="outline" color="neutral"
                  @click="editEstimatedDuration = Math.max(5, editEstimatedDuration - 5)" />
                <span class="text-sm font-medium w-16 text-center">{{ editEstimatedDuration }} 分鐘</span>
                <UButton icon="i-lucide-plus" size="xs" variant="outline" color="neutral"
                  @click="editEstimatedDuration = Math.min(480, editEstimatedDuration + 5)" />
              </div>
            </div>
            <div class="grid grid-cols-3 gap-1 items-center">
              <span class="text-muted">預計抵達</span>
              <span class="col-span-2 text-sm">{{ editScheduledEndAt || '—' }}</span>
            </div>
            <div class="grid grid-cols-3 gap-1">
              <span class="text-muted">起點</span>
              <span class="col-span-2">{{ selectedTrip.originAddress || '—' }}</span>
            </div>
            <div class="grid grid-cols-3 gap-1">
              <span class="text-muted">終點</span>
              <span class="col-span-2">{{ selectedTrip.destinationAddress || '—' }}</span>
            </div>
            <div class="grid grid-cols-3 gap-1 items-center">
              <span class="text-muted">司機</span>
              <div class="col-span-2">
                <USelect
                  v-model="editDriverUserId"
                  :items="driverOptions"
                  value-key="value"
                  class="w-full"
                />
              </div>
            </div>
            <div class="grid grid-cols-3 gap-1 items-center">
              <span class="text-muted">車輛</span>
              <div class="col-span-2">
                <USelect
                  v-model="editVehicleId"
                  :items="vehicleOptions"
                  value-key="value"
                  class="w-full"
                />
              </div>
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
              <UButton variant="ghost" @click="showDetailModal = false">關閉</UButton>
              <UButton color="primary" icon="i-lucide-save" :loading="saving" @click="handleSaveAssign">儲存</UButton>
            </div>
          </div>
        </div>
      </template>
    </UModal>
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
