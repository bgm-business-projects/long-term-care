<script setup lang="ts">
definePageMeta({ layout: 'admin-panel' })

const route = useRoute()
const router = useRouter()
const toast = useToast()
const { api } = useApi()

interface Driver {
  id: string
  userId: string
  fleetId: string | null
  phone: string
  termsAcceptedAt: string | Date | null
  idCardFrontKey: string | null
  idCardBackKey: string | null
  professionalLicenseKey: string | null
  licenseExpiry: string | null
  approvalStatus: 'pending' | 'approved' | 'rejected'
  approvedAt: string | Date | null
  rejectionReason: string | null
  isActive: boolean
  status: 'active' | 'on_leave' | 'resigned'
  emergencyContact: string | null
  emergencyPhone: string | null
  createdAt: string | Date
  user: { id: string; name: string; email: string }
  fleet: { id: string; name: string } | null
}
interface Vehicle {
  id: string
  plate: string
  vehicleType: string
  seatCount: number
  wheelchairCapacity: number
  isAccessible: boolean
  isRental: boolean
  homeAddress: string | null
  vehiclePhotoKey: string | null
  vehicleRegistrationKey: string | null
  compulsoryInsurer: string | null
  insuranceExpiry: string | null
  hasThirdPartyLiability: boolean
  hasPassengerLiability: boolean
  hasDriverInjury: boolean
  hasExcessLiability: boolean
  notes: string | null
}

const driver = ref<Driver | null>(null)
const vehicle = ref<Vehicle | null>(null)
const loading = ref(true)
const acting = ref(false)

const showStatusModal = ref(false)
const statusForm = reactive({
  approvalStatus: 'pending' as 'pending' | 'approved' | 'rejected',
  rejectionReason: '',
  isActive: true,
})

const approvalOptions = [
  { label: '待審核', value: 'pending' },
  { label: '已核准', value: 'approved' },
  { label: '已拒絕', value: 'rejected' },
]

function openStatusEdit() {
  if (!driver.value) return
  statusForm.approvalStatus = driver.value.approvalStatus
  statusForm.rejectionReason = driver.value.rejectionReason || ''
  statusForm.isActive = driver.value.isActive
  showStatusModal.value = true
}

async function saveStatus() {
  if (!driver.value) return
  if (statusForm.approvalStatus === 'rejected' && !statusForm.rejectionReason.trim()) {
    toast.add({ title: '請填寫拒絕原因', color: 'warning' })
    return
  }
  acting.value = true
  try {
    // 1. 審核狀態（如有變更）
    if (statusForm.approvalStatus !== driver.value.approvalStatus
      || (statusForm.approvalStatus === 'rejected' && statusForm.rejectionReason.trim() !== (driver.value.rejectionReason || ''))
    ) {
      await api(`/api/admin/drivers/${driver.value.id}/status`, {
        method: 'POST',
        body: {
          status: statusForm.approvalStatus,
          reason: statusForm.approvalStatus === 'rejected' ? statusForm.rejectionReason.trim() : undefined,
        },
      })
    }
    // 2. 帳號啟用（如有變更）
    if (statusForm.isActive !== driver.value.isActive) {
      await api(`/api/admin/drivers/${driver.value.id}`, {
        method: 'PUT',
        body: { isActive: statusForm.isActive },
      })
    }
    toast.add({ title: '狀態已更新', color: 'success' })
    showStatusModal.value = false
    await load()
  } catch (err: any) {
    toast.add({ title: err?.data?.statusMessage || '操作失敗', color: 'error' })
  } finally {
    acting.value = false
  }
}

const previewUrl = ref<string | null>(null)
const showPreview = ref(false)

// ── 重設密碼 ──
const showPasswordModal = ref(false)
const passwordForm = reactive({ password: '', confirm: '' })
const savingPassword = ref(false)

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let out = ''
  for (let i = 0; i < 10; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

function openPasswordReset() {
  passwordForm.password = ''
  passwordForm.confirm = ''
  showPasswordModal.value = true
}

function fillRandomPassword() {
  const p = generateTempPassword()
  passwordForm.password = p
  passwordForm.confirm = p
}

async function copyPassword() {
  if (!passwordForm.password) return
  try {
    await navigator.clipboard.writeText(passwordForm.password)
    toast.add({ title: '已複製到剪貼簿', color: 'success' })
  } catch {
    toast.add({ title: '複製失敗，請手動選取', color: 'warning' })
  }
}

async function submitPassword() {
  if (!driver.value) return
  if (passwordForm.password.length < 6) {
    toast.add({ title: '密碼至少需 6 個字元', color: 'warning' })
    return
  }
  if (passwordForm.password !== passwordForm.confirm) {
    toast.add({ title: '兩次輸入的密碼不一致', color: 'warning' })
    return
  }
  savingPassword.value = true
  try {
    await api(`/api/dispatch/drivers/${driver.value.id}/password`, {
      method: 'POST',
      body: { password: passwordForm.password },
    })
    toast.add({ title: '密碼已更新，該司機需重新登入', color: 'success' })
    showPasswordModal.value = false
  } catch (err: any) {
    toast.add({ title: err?.data?.statusMessage || '更新失敗', color: 'error' })
  } finally {
    savingPassword.value = false
  }
}

const showVehicleModal = ref(false)
const showPersonalModal = ref(false)
const showDocsModal = ref(false)
const savingVehicle = ref(false)
const savingPersonal = ref(false)
const savingDocs = ref(false)
const { uploadOne } = useFileUploader()
const uploadingFlags = reactive<Record<string, boolean>>({})

const NO_FLEET = '__none__'
const fleetList = ref<{ id: string; name: string }[]>([])
const fleetItems = computed(() => [
  { label: '獨立司機 (無車行)', value: NO_FLEET },
  ...fleetList.value.map(f => ({ label: f.name, value: f.id })),
])

const personalForm = reactive({
  name: '',
  phone: '',
  fleetId: NO_FLEET,
  emergencyContact: '',
  emergencyPhone: '',
})

const docsForm = reactive({
  idCardFrontKey: '',
  idCardBackKey: '',
  professionalLicenseKey: '',
  licenseExpiry: '',
})

async function loadFleets() {
  if (fleetList.value.length > 0) return
  try {
    fleetList.value = await api<{ id: string; name: string }[]>('/api/fleets')
  } catch {
    fleetList.value = []
  }
}

function openPersonalEdit() {
  if (!driver.value) return
  loadFleets()
  personalForm.name = driver.value.user.name
  personalForm.phone = driver.value.phone
  personalForm.fleetId = driver.value.fleetId || NO_FLEET
  personalForm.emergencyContact = driver.value.emergencyContact || ''
  personalForm.emergencyPhone = driver.value.emergencyPhone || ''
  showPersonalModal.value = true
}

async function savePersonal() {
  if (!driver.value) return
  if (!personalForm.name.trim() || !personalForm.phone.trim()) {
    toast.add({ title: '姓名與手機為必填', color: 'error' })
    return
  }
  savingPersonal.value = true
  try {
    await api(`/api/admin/drivers/${driver.value.id}`, {
      method: 'PUT',
      body: {
        name: personalForm.name.trim(),
        phone: personalForm.phone.trim(),
        fleetId: personalForm.fleetId === NO_FLEET ? null : personalForm.fleetId,
        emergencyContact: personalForm.emergencyContact.trim() || null,
        emergencyPhone: personalForm.emergencyPhone.trim() || null,
      },
    })
    toast.add({ title: '個人資料已更新', color: 'success' })
    showPersonalModal.value = false
    await load()
  } catch (err: any) {
    toast.add({ title: err?.data?.statusMessage || '更新失敗', color: 'error' })
  } finally {
    savingPersonal.value = false
  }
}

function openDocsEdit() {
  if (!driver.value) return
  docsForm.idCardFrontKey = driver.value.idCardFrontKey || ''
  docsForm.idCardBackKey = driver.value.idCardBackKey || ''
  docsForm.professionalLicenseKey = driver.value.professionalLicenseKey || ''
  docsForm.licenseExpiry = driver.value.licenseExpiry || ''
  showDocsModal.value = true
}

async function handleDocFile(field: 'idCardFrontKey' | 'idCardBackKey' | 'professionalLicenseKey', e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  uploadingFlags[field] = true
  try {
    docsForm[field] = await uploadOne(file)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '上傳失敗'
    toast.add({ title: msg, color: 'error' })
  } finally {
    uploadingFlags[field] = false
    input.value = ''
  }
}

async function saveDocs() {
  if (!driver.value) return
  savingDocs.value = true
  try {
    await api(`/api/admin/drivers/${driver.value.id}`, {
      method: 'PUT',
      body: {
        idCardFrontKey: docsForm.idCardFrontKey || null,
        idCardBackKey: docsForm.idCardBackKey || null,
        professionalLicenseKey: docsForm.professionalLicenseKey || null,
        licenseExpiry: docsForm.licenseExpiry || null,
      },
    })
    toast.add({ title: '證件已更新', color: 'success' })
    showDocsModal.value = false
    await load()
  } catch (err: any) {
    toast.add({ title: err?.data?.statusMessage || '更新失敗', color: 'error' })
  } finally {
    savingDocs.value = false
  }
}

const vehicleForm = reactive({
  plate: '',
  vehicleType: '',
  seatCount: 4,
  wheelchairCapacity: 0,
  isAccessible: false,
  isRental: false,
  homeAddress: '',
  vehiclePhotoKey: '',
  vehicleRegistrationKey: '',
  compulsoryInsurer: '',
  insuranceExpiry: '',
  hasThirdPartyLiability: false,
  hasPassengerLiability: false,
  hasDriverInjury: false,
  hasExcessLiability: false,
  notes: '',
})

function openVehicleEdit() {
  if (!vehicle.value) return
  const v = vehicle.value
  vehicleForm.plate = v.plate
  vehicleForm.vehicleType = v.vehicleType
  vehicleForm.seatCount = v.seatCount
  vehicleForm.wheelchairCapacity = v.wheelchairCapacity
  vehicleForm.isAccessible = v.isAccessible
  vehicleForm.isRental = v.isRental
  vehicleForm.homeAddress = v.homeAddress || ''
  vehicleForm.vehiclePhotoKey = v.vehiclePhotoKey || ''
  vehicleForm.vehicleRegistrationKey = v.vehicleRegistrationKey || ''
  vehicleForm.compulsoryInsurer = v.compulsoryInsurer || ''
  vehicleForm.insuranceExpiry = v.insuranceExpiry || ''
  vehicleForm.hasThirdPartyLiability = v.hasThirdPartyLiability
  vehicleForm.hasPassengerLiability = v.hasPassengerLiability
  vehicleForm.hasDriverInjury = v.hasDriverInjury
  vehicleForm.hasExcessLiability = v.hasExcessLiability
  vehicleForm.notes = v.notes || ''
  showVehicleModal.value = true
}

async function handleVehicleFile(field: 'vehiclePhotoKey' | 'vehicleRegistrationKey', e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  uploadingFlags[field] = true
  try {
    vehicleForm[field] = await uploadOne(file)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '上傳失敗'
    toast.add({ title: msg, color: 'error' })
  } finally {
    uploadingFlags[field] = false
    input.value = ''
  }
}

async function saveVehicle() {
  if (!vehicle.value) return
  savingVehicle.value = true
  try {
    await api(`/api/dispatch/vehicles/${vehicle.value.id}`, {
      method: 'PUT',
      body: {
        plate: vehicleForm.plate.trim().toUpperCase(),
        vehicleType: vehicleForm.vehicleType,
        seatCount: vehicleForm.seatCount,
        wheelchairCapacity: vehicleForm.wheelchairCapacity,
        isAccessible: vehicleForm.isAccessible,
        isRental: vehicleForm.isRental,
        homeAddress: vehicleForm.homeAddress.trim() || null,
        vehiclePhotoKey: vehicleForm.vehiclePhotoKey || null,
        vehicleRegistrationKey: vehicleForm.vehicleRegistrationKey || null,
        compulsoryInsurer: vehicleForm.compulsoryInsurer.trim() || null,
        insuranceExpiry: vehicleForm.insuranceExpiry || null,
        hasThirdPartyLiability: vehicleForm.hasThirdPartyLiability,
        hasPassengerLiability: vehicleForm.hasPassengerLiability,
        hasDriverInjury: vehicleForm.hasDriverInjury,
        hasExcessLiability: vehicleForm.hasExcessLiability,
        notes: vehicleForm.notes.trim() || null,
      },
    })
    toast.add({ title: '車輛資料已更新', color: 'success' })
    showVehicleModal.value = false
    await load()
  } catch (err: any) {
    toast.add({ title: err?.data?.statusMessage || '更新失敗', color: 'error' })
  } finally {
    savingVehicle.value = false
  }
}

async function load() {
  loading.value = true
  try {
    const res = await api<{ driver: Driver; vehicle: Vehicle | null }>(`/api/admin/drivers/${route.params.id}`)
    driver.value = res.driver
    vehicle.value = res.vehicle
  } catch (err: any) {
    toast.add({ title: err?.data?.statusMessage || '載入失敗', color: 'error' })
    router.push('/admin/drivers')
  } finally {
    loading.value = false
  }
}

function openPreview(url: string | null) {
  if (!url) return
  previewUrl.value = url
  showPreview.value = true
}

const statusBadge = computed(() => {
  if (!driver.value) return { color: 'neutral' as const, text: '-' }
  switch (driver.value.approvalStatus) {
    case 'approved': return { color: 'success' as const, text: '已核准' }
    case 'rejected': return { color: 'error' as const, text: '已拒絕' }
    default: return { color: 'warning' as const, text: '待審核' }
  }
})

const accountStatusBadge = computed(() => {
  if (!driver.value) return { color: 'neutral' as const, text: '-' }
  return driver.value.isActive
    ? { color: 'success' as const, text: '啟用' }
    : { color: 'neutral' as const, text: '停用' }
})

onMounted(load)
</script>

<template>
  <div class="p-6 max-w-5xl mx-auto space-y-4">
    <div class="flex items-center justify-between">
      <UButton variant="ghost" icon="i-lucide-arrow-left" label="返回司機列表" to="/admin/drivers" />
      <UBadge :color="statusBadge.color" :label="statusBadge.text" size="lg" />
    </div>

    <div v-if="loading" class="text-center py-20 text-muted">載入中…</div>

    <template v-else-if="driver">
      <!-- 狀態卡 -->
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h2 class="font-semibold">狀態管理</h2>
            <div class="flex items-center gap-2">
              <UButton size="xs" variant="outline" color="warning" icon="i-lucide-key-round" label="重設密碼" @click="openPasswordReset" />
              <UButton size="xs" variant="outline" icon="i-lucide-edit" label="變更狀態" @click="openStatusEdit" />
            </div>
          </div>
        </template>
        <div class="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p class="text-xs text-muted mb-1">審核狀態</p>
            <UBadge :color="statusBadge.color" variant="subtle">{{ statusBadge.text }}</UBadge>
            <p v-if="driver.approvalStatus === 'rejected' && driver.rejectionReason" class="text-xs text-muted mt-2 whitespace-pre-line">原因：{{ driver.rejectionReason }}</p>
            <p v-if="driver.approvedAt" class="text-xs text-muted mt-1">時間：{{ new Date(driver.approvedAt).toLocaleString('zh-TW') }}</p>
          </div>
          <div>
            <p class="text-xs text-muted mb-1">帳號狀態</p>
            <UBadge :color="accountStatusBadge.color" variant="subtle">{{ accountStatusBadge.text }}</UBadge>
          </div>
        </div>
      </UCard>

      <!-- 個人資料 -->
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h2 class="font-semibold">個人資料</h2>
            <UButton size="xs" variant="outline" icon="i-lucide-edit" label="編輯" @click="openPersonalEdit" />
          </div>
        </template>
        <div class="grid grid-cols-2 gap-3 text-sm">
          <div><span class="text-muted">姓名：</span>{{ driver.user.name }}</div>
          <div><span class="text-muted">Email：</span>{{ driver.user.email }}</div>
          <div><span class="text-muted">手機：</span>{{ driver.phone }}</div>
          <div><span class="text-muted">所屬車行：</span>{{ driver.fleet?.name || '獨立司機' }}</div>
          <div><span class="text-muted">緊急聯絡：</span>{{ driver.emergencyContact || '-' }} / {{ driver.emergencyPhone || '-' }}</div>
          <div><span class="text-muted">送出時間：</span>{{ new Date(driver.createdAt).toLocaleString('zh-TW') }}</div>
        </div>
      </UCard>

      <!-- 證件 -->
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h2 class="font-semibold">證件</h2>
            <UButton size="xs" variant="outline" icon="i-lucide-edit" label="編輯證件" @click="openDocsEdit" />
          </div>
        </template>
        <div class="grid grid-cols-3 gap-3">
          <div>
            <p class="text-sm text-muted mb-1">身分證正面</p>
            <button class="aspect-3/2 w-full rounded border bg-elevated overflow-hidden cursor-pointer hover:opacity-80" @click="openPreview(driver.idCardFrontKey)">
              <img v-if="driver.idCardFrontKey" :src="driver.idCardFrontKey" alt="" class="w-full h-full object-cover" />
              <span v-else class="text-xs text-muted">未上傳</span>
            </button>
          </div>
          <div>
            <p class="text-sm text-muted mb-1">身分證背面</p>
            <button class="aspect-3/2 w-full rounded border bg-elevated overflow-hidden cursor-pointer hover:opacity-80" @click="openPreview(driver.idCardBackKey)">
              <img v-if="driver.idCardBackKey" :src="driver.idCardBackKey" alt="" class="w-full h-full object-cover" />
              <span v-else class="text-xs text-muted">未上傳</span>
            </button>
          </div>
          <div>
            <p class="text-sm text-muted mb-1">職業駕照 (到期：{{ driver.licenseExpiry || '-' }})</p>
            <button class="aspect-3/2 w-full rounded border bg-elevated overflow-hidden cursor-pointer hover:opacity-80" @click="openPreview(driver.professionalLicenseKey)">
              <img v-if="driver.professionalLicenseKey" :src="driver.professionalLicenseKey" alt="" class="w-full h-full object-cover" />
              <span v-else class="text-xs text-muted">未上傳</span>
            </button>
          </div>
        </div>
      </UCard>

      <!-- 車輛 -->
      <UCard v-if="vehicle">
        <template #header>
          <div class="flex items-center justify-between">
            <h2 class="font-semibold">車輛資料</h2>
            <UButton size="xs" variant="outline" icon="i-lucide-edit" label="編輯車輛" @click="openVehicleEdit" />
          </div>
        </template>
        <div class="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
          <div><span class="text-muted">車牌：</span>{{ vehicle.plate }}</div>
          <div><span class="text-muted">車型：</span>{{ vehicle.vehicleType }}</div>
          <div><span class="text-muted">乘載人數：</span>{{ vehicle.seatCount }}</div>
          <div><span class="text-muted">輪椅承載：</span>{{ vehicle.wheelchairCapacity }}</div>
          <div><span class="text-muted">無障礙車：</span>{{ vehicle.isAccessible ? '✓' : '-' }}</div>
          <div><span class="text-muted">租賃車：</span>{{ vehicle.isRental ? '✓' : '-' }}</div>
          <div class="col-span-2"><span class="text-muted">起始地點：</span>{{ vehicle.homeAddress || '-' }}</div>
        </div>
        <div class="grid grid-cols-2 gap-3 mt-4">
          <div>
            <p class="text-sm text-muted mb-1">汽車照片</p>
            <button class="aspect-3/2 w-full rounded border bg-elevated overflow-hidden cursor-pointer hover:opacity-80" @click="openPreview(vehicle.vehiclePhotoKey)">
              <img v-if="vehicle.vehiclePhotoKey" :src="vehicle.vehiclePhotoKey" alt="" class="w-full h-full object-cover" />
              <span v-else class="text-xs text-muted">未上傳</span>
            </button>
          </div>
          <div>
            <p class="text-sm text-muted mb-1">汽車行照</p>
            <button class="aspect-3/2 w-full rounded border bg-elevated overflow-hidden cursor-pointer hover:opacity-80" @click="openPreview(vehicle.vehicleRegistrationKey)">
              <img v-if="vehicle.vehicleRegistrationKey" :src="vehicle.vehicleRegistrationKey" alt="" class="w-full h-full object-cover" />
              <span v-else class="text-xs text-muted">未上傳</span>
            </button>
          </div>
        </div>
      </UCard>

      <!-- 保險 -->
      <UCard v-if="vehicle">
        <template #header>
          <h2 class="font-semibold">保險資訊</h2>
        </template>
        <div class="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
          <div><span class="text-muted">強制險公司：</span>{{ vehicle.compulsoryInsurer || '-' }}</div>
          <div><span class="text-muted">到期日：</span>{{ vehicle.insuranceExpiry || '-' }}</div>
          <div><span class="text-muted">第三責任險：</span>{{ vehicle.hasThirdPartyLiability ? '✓' : '-' }}</div>
          <div><span class="text-muted">旅客責任險：</span>{{ vehicle.hasPassengerLiability ? '✓' : '-' }}</div>
          <div><span class="text-muted">駕駛人傷害險：</span>{{ vehicle.hasDriverInjury ? '✓' : '-' }}</div>
          <div><span class="text-muted">超額責任險：</span>{{ vehicle.hasExcessLiability ? '✓' : '-' }}</div>
          <div v-if="vehicle.notes" class="col-span-2"><span class="text-muted">備註：</span>{{ vehicle.notes }}</div>
        </div>
      </UCard>
    </template>

    <!-- 狀態管理 modal -->
    <UModal v-model:open="showStatusModal" title="變更狀態" description=" ">
      <template #content>
        <div class="p-6 space-y-4">
          <UFormField label="審核狀態">
            <USelectMenu v-model="statusForm.approvalStatus" :items="approvalOptions" value-key="value" class="w-full" />
          </UFormField>
          <UFormField v-if="statusForm.approvalStatus === 'rejected'" label="拒絕原因 *">
            <UTextarea v-model="statusForm.rejectionReason" placeholder="請說明原因，司機將會看到此訊息" :rows="3" class="w-full" />
          </UFormField>

          <div class="border-t pt-4">
            <label class="flex items-center gap-2 cursor-pointer">
              <UCheckbox v-model="statusForm.isActive" />
              <span class="text-sm">帳號啟用（停用後不會出現在派車選單）</span>
            </label>
          </div>

          <div class="flex justify-end gap-2 pt-2">
            <UButton color="neutral" variant="ghost" label="取消" @click="showStatusModal = false" />
            <UButton color="primary" :loading="acting" label="儲存" @click="saveStatus" />
          </div>
        </div>
      </template>
    </UModal>

    <!-- 重設密碼 modal -->
    <UModal v-model:open="showPasswordModal" title="重設司機登入密碼" description=" ">
      <template #content>
        <div class="p-6 space-y-4">
          <div class="bg-warning/10 border border-warning/30 rounded-lg p-3 text-xs text-warning">
            <UIcon name="i-lucide-alert-triangle" class="inline mr-1" />
            存檔後該司機所有 session 會立即失效，需用新密碼重新登入。
          </div>
          <UFormField label="新密碼（至少 6 個字元）">
            <UInput v-model="passwordForm.password" type="text" placeholder="請輸入新密碼" class="w-full" />
          </UFormField>
          <UFormField label="再次輸入新密碼">
            <UInput v-model="passwordForm.confirm" type="text" placeholder="確認新密碼" class="w-full" />
          </UFormField>
          <div class="flex items-center justify-between">
            <div class="flex gap-2">
              <UButton size="xs" color="neutral" variant="outline" icon="i-lucide-shuffle" label="隨機產生" @click="fillRandomPassword" />
              <UButton size="xs" color="neutral" variant="outline" icon="i-lucide-copy" label="複製密碼" :disabled="!passwordForm.password" @click="copyPassword" />
            </div>
          </div>
          <div class="flex justify-end gap-2 pt-2">
            <UButton color="neutral" variant="ghost" label="取消" @click="showPasswordModal = false" />
            <UButton color="warning" :loading="savingPassword" icon="i-lucide-key-round" label="確認重設" @click="submitPassword" />
          </div>
        </div>
      </template>
    </UModal>

    <!-- 圖片預覽 modal -->
    <UModal v-model:open="showPreview">
      <template #content>
        <div class="p-2">
          <img v-if="previewUrl" :src="previewUrl" alt="預覽" class="w-full h-auto rounded" />
        </div>
      </template>
    </UModal>

    <!-- 編輯個人資料 modal -->
    <UModal v-model:open="showPersonalModal" title="編輯個人資料" description=" ">
      <template #content>
        <div class="p-6 space-y-4">
          <UFormField label="姓名 *">
            <UInput v-model="personalForm.name" class="w-full" />
          </UFormField>
          <UFormField label="手機號碼 *">
            <UInput v-model="personalForm.phone" class="w-full" />
          </UFormField>
          <UFormField label="所屬車行">
            <USelectMenu v-model="personalForm.fleetId" :items="fleetItems" value-key="value" class="w-full" />
          </UFormField>
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="緊急聯絡人">
              <UInput v-model="personalForm.emergencyContact" class="w-full" />
            </UFormField>
            <UFormField label="緊急聯絡電話">
              <UInput v-model="personalForm.emergencyPhone" class="w-full" />
            </UFormField>
          </div>
          <div class="flex justify-end gap-2 pt-2">
            <UButton color="neutral" variant="outline" label="取消" @click="showPersonalModal = false" />
            <UButton color="primary" :loading="savingPersonal" label="儲存" @click="savePersonal" />
          </div>
        </div>
      </template>
    </UModal>

    <!-- 編輯證件 modal -->
    <UModal v-model:open="showDocsModal" title="編輯證件" description=" ">
      <template #content>
        <div class="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          <div class="grid grid-cols-2 gap-3">
            <FileUploadField
              label="身分證正面"
              :value="docsForm.idCardFrontKey"
              :uploading="uploadingFlags.idCardFrontKey"
              @select="(e: Event) => handleDocFile('idCardFrontKey', e)"
            />
            <FileUploadField
              label="身分證背面"
              :value="docsForm.idCardBackKey"
              :uploading="uploadingFlags.idCardBackKey"
              @select="(e: Event) => handleDocFile('idCardBackKey', e)"
            />
          </div>
          <FileUploadField
            label="職業駕照"
            :value="docsForm.professionalLicenseKey"
            :uploading="uploadingFlags.professionalLicenseKey"
            @select="(e: Event) => handleDocFile('professionalLicenseKey', e)"
          />
          <UFormField label="駕照到期日">
            <UInput v-model="docsForm.licenseExpiry" type="date" class="w-full" />
          </UFormField>
          <div class="flex justify-end gap-2 pt-2">
            <UButton color="neutral" variant="outline" label="取消" @click="showDocsModal = false" />
            <UButton color="primary" :loading="savingDocs" label="儲存" @click="saveDocs" />
          </div>
        </div>
      </template>
    </UModal>

    <!-- 編輯車輛 modal -->
    <UModal v-model:open="showVehicleModal" title="編輯車輛資料" description=" ">
      <template #content>
        <div class="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          <h3 class="font-semibold text-base">基本資料</h3>
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="車牌號碼">
              <UInput v-model="vehicleForm.plate" class="w-full" />
            </UFormField>
            <UFormField label="車型">
              <UInput v-model="vehicleForm.vehicleType" class="w-full" />
            </UFormField>
            <UFormField label="可乘載人數">
              <UInput v-model.number="vehicleForm.seatCount" type="number" min="1" max="50" class="w-full" />
            </UFormField>
            <UFormField label="可乘載輪椅">
              <UInput v-model.number="vehicleForm.wheelchairCapacity" type="number" min="0" max="20" class="w-full" />
            </UFormField>
          </div>
          <div class="flex flex-wrap gap-4">
            <label class="flex items-center gap-2"><UCheckbox v-model="vehicleForm.isAccessible" /><span class="text-sm">無障礙車輛</span></label>
            <label class="flex items-center gap-2"><UCheckbox v-model="vehicleForm.isRental" /><span class="text-sm">租賃車</span></label>
          </div>
          <UFormField label="起始地點">
            <UInput v-model="vehicleForm.homeAddress" class="w-full" />
          </UFormField>

          <h3 class="font-semibold text-base pt-2">證件文件</h3>
          <div class="grid grid-cols-2 gap-3">
            <FileUploadField
              label="汽車照片"
              :value="vehicleForm.vehiclePhotoKey"
              :uploading="uploadingFlags.vehiclePhotoKey"
              @select="(e: Event) => handleVehicleFile('vehiclePhotoKey', e)"
            />
            <FileUploadField
              label="汽車行照"
              :value="vehicleForm.vehicleRegistrationKey"
              :uploading="uploadingFlags.vehicleRegistrationKey"
              @select="(e: Event) => handleVehicleFile('vehicleRegistrationKey', e)"
            />
          </div>

          <h3 class="font-semibold text-base pt-2">保險</h3>
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="強制險公司">
              <UInput v-model="vehicleForm.compulsoryInsurer" class="w-full" />
            </UFormField>
            <UFormField label="保險到期日">
              <UInput v-model="vehicleForm.insuranceExpiry" type="date" class="w-full" />
            </UFormField>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <label class="flex items-center gap-2"><UCheckbox v-model="vehicleForm.hasThirdPartyLiability" /><span class="text-sm">第三責任險</span></label>
            <label class="flex items-center gap-2"><UCheckbox v-model="vehicleForm.hasPassengerLiability" /><span class="text-sm">旅客責任險</span></label>
            <label class="flex items-center gap-2"><UCheckbox v-model="vehicleForm.hasDriverInjury" /><span class="text-sm">駕駛人傷害險</span></label>
            <label class="flex items-center gap-2"><UCheckbox v-model="vehicleForm.hasExcessLiability" /><span class="text-sm">超額責任險</span></label>
          </div>
          <UFormField label="備註">
            <UTextarea v-model="vehicleForm.notes" :rows="2" class="w-full" />
          </UFormField>

          <div class="flex justify-end gap-2 pt-2">
            <UButton color="neutral" variant="outline" label="取消" @click="showVehicleModal = false" />
            <UButton color="primary" :loading="savingVehicle" label="儲存" @click="saveVehicle" />
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
