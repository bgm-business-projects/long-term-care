<script setup lang="ts">
definePageMeta({ layout: false })

const toast = useToast()
const { api } = useApi()
const { uploadOne } = useFileUploader()

interface Driver {
  id: string
  userId: string
  fleetId: string | null
  phone: string
  idCardFrontKey: string | null
  idCardBackKey: string | null
  professionalLicenseKey: string | null
  licenseExpiry: string | null
  approvalStatus: 'pending' | 'approved' | 'rejected'
  rejectionReason: string | null
  emergencyContact: string | null
  emergencyPhone: string | null
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

const showPersonalModal = ref(false)
const showDocsModal = ref(false)
const showVehicleModal = ref(false)
const savingPersonal = ref(false)
const savingDocs = ref(false)
const savingVehicle = ref(false)
const uploadingFlags = reactive<Record<string, boolean>>({})

const previewUrl = ref<string | null>(null)
const showPreview = ref(false)

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
  idCardFrontUrl: '',
  idCardBackUrl: '',
  professionalLicenseUrl: '',
  licenseExpiry: '',
})

const vehicleForm = reactive({
  plate: '',
  vehicleType: '',
  seatCount: 4,
  wheelchairCapacity: 0,
  isAccessible: false,
  isRental: false,
  homeAddress: '',
  vehiclePhotoUrl: '',
  vehicleRegistrationUrl: '',
  compulsoryInsurer: '',
  insuranceExpiry: '',
  hasThirdPartyLiability: false,
  hasPassengerLiability: false,
  hasDriverInjury: false,
  hasExcessLiability: false,
  notes: '',
})

const statusBadge = computed(() => {
  if (!driver.value) return { color: 'neutral' as const, text: '-' }
  switch (driver.value.approvalStatus) {
    case 'approved': return { color: 'success' as const, text: '已核准' }
    case 'rejected': return { color: 'error' as const, text: '已拒絕' }
    default: return { color: 'warning' as const, text: '審核中' }
  }
})

// 已核准後司機不能再自行編輯
const canEdit = computed(() => driver.value?.approvalStatus !== 'approved')

async function loadFleets() {
  if (fleetList.value.length > 0) return
  try {
    fleetList.value = await api<{ id: string; name: string }[]>('/api/fleets')
  } catch {
    fleetList.value = []
  }
}

async function load() {
  loading.value = true
  try {
    const res = await api<{ hasApplication: boolean; driver?: Driver; vehicle?: Vehicle }>('/api/driver/me/application')
    if (!res.hasApplication) {
      navigateTo('/driver/onboarding')
      return
    }
    driver.value = res.driver as Driver
    vehicle.value = res.vehicle as Vehicle
  } catch (err: any) {
    toast.add({ title: err?.data?.statusMessage || '載入失敗', color: 'error' })
  } finally {
    loading.value = false
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
  if (!personalForm.name.trim() || !personalForm.phone.trim()) {
    toast.add({ title: '姓名與手機為必填', color: 'error' })
    return
  }
  savingPersonal.value = true
  try {
    await api('/api/driver/me/profile', {
      method: 'PUT',
      body: {
        name: personalForm.name.trim(),
        phone: personalForm.phone.trim(),
        hasFleet: personalForm.fleetId !== NO_FLEET,
        fleetId: personalForm.fleetId === NO_FLEET ? null : personalForm.fleetId,
        emergencyContact: personalForm.emergencyContact.trim() || null,
        emergencyPhone: personalForm.emergencyPhone.trim() || null,
      },
    })
    toast.add({ title: '已更新', color: 'success' })
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
  docsForm.idCardFrontUrl = driver.value.idCardFrontKey || ''
  docsForm.idCardBackUrl = driver.value.idCardBackKey || ''
  docsForm.professionalLicenseUrl = driver.value.professionalLicenseKey || ''
  docsForm.licenseExpiry = driver.value.licenseExpiry || ''
  showDocsModal.value = true
}

async function handleDocFile(field: 'idCardFrontUrl' | 'idCardBackUrl' | 'professionalLicenseUrl', e: Event) {
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
  savingDocs.value = true
  try {
    await api('/api/driver/me/profile', {
      method: 'PUT',
      body: {
        idCardFrontUrl: docsForm.idCardFrontUrl || null,
        idCardBackUrl: docsForm.idCardBackUrl || null,
        professionalLicenseUrl: docsForm.professionalLicenseUrl || null,
        licenseExpiry: docsForm.licenseExpiry || null,
      },
    })
    toast.add({ title: '已更新', color: 'success' })
    showDocsModal.value = false
    await load()
  } catch (err: any) {
    toast.add({ title: err?.data?.statusMessage || '更新失敗', color: 'error' })
  } finally {
    savingDocs.value = false
  }
}

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
  vehicleForm.vehiclePhotoUrl = v.vehiclePhotoKey || ''
  vehicleForm.vehicleRegistrationUrl = v.vehicleRegistrationKey || ''
  vehicleForm.compulsoryInsurer = v.compulsoryInsurer || ''
  vehicleForm.insuranceExpiry = v.insuranceExpiry || ''
  vehicleForm.hasThirdPartyLiability = v.hasThirdPartyLiability
  vehicleForm.hasPassengerLiability = v.hasPassengerLiability
  vehicleForm.hasDriverInjury = v.hasDriverInjury
  vehicleForm.hasExcessLiability = v.hasExcessLiability
  vehicleForm.notes = v.notes || ''
  showVehicleModal.value = true
}

async function handleVehicleFile(field: 'vehiclePhotoUrl' | 'vehicleRegistrationUrl', e: Event) {
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
  savingVehicle.value = true
  try {
    await api('/api/driver/me/vehicle', {
      method: 'PUT',
      body: {
        plate: vehicleForm.plate.trim().toUpperCase(),
        vehicleType: vehicleForm.vehicleType,
        seatCount: vehicleForm.seatCount,
        wheelchairCapacity: vehicleForm.wheelchairCapacity,
        isAccessible: vehicleForm.isAccessible,
        isRental: vehicleForm.isRental,
        homeAddress: vehicleForm.homeAddress.trim() || null,
        vehiclePhotoUrl: vehicleForm.vehiclePhotoUrl || null,
        vehicleRegistrationUrl: vehicleForm.vehicleRegistrationUrl || null,
        compulsoryInsurer: vehicleForm.compulsoryInsurer.trim() || null,
        insuranceExpiry: vehicleForm.insuranceExpiry || null,
        hasThirdPartyLiability: vehicleForm.hasThirdPartyLiability,
        hasPassengerLiability: vehicleForm.hasPassengerLiability,
        hasDriverInjury: vehicleForm.hasDriverInjury,
        hasExcessLiability: vehicleForm.hasExcessLiability,
        notes: vehicleForm.notes.trim() || null,
      },
    })
    toast.add({ title: '已更新', color: 'success' })
    showVehicleModal.value = false
    await load()
  } catch (err: any) {
    toast.add({ title: err?.data?.statusMessage || '更新失敗', color: 'error' })
  } finally {
    savingVehicle.value = false
  }
}

function openImagePreview(url: string | null) {
  if (!url) return
  previewUrl.value = url
  showPreview.value = true
}

onMounted(load)
</script>

<template>
  <div class="min-h-screen bg-default">
    <!-- Header -->
    <div class="bg-white dark:bg-elevated border-b px-4 py-3 sticky top-0 z-10">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <UButton variant="ghost" icon="i-lucide-arrow-left" to="/driver" aria-label="返回" />
          <h1 class="text-xl font-bold">我的資料</h1>
        </div>
        <UBadge :color="statusBadge.color" :label="statusBadge.text" />
      </div>
    </div>

    <div v-if="loading" class="text-center py-20 text-muted">載入中…</div>

    <div v-else-if="driver" class="px-4 py-4 space-y-4 max-w-2xl mx-auto pb-20">
      <UCard v-if="driver.approvalStatus === 'approved'" class="border-l-4 border-green-500">
        <p class="text-sm font-medium">資料已核准</p>
        <p class="text-xs text-muted mt-1">如需修改任何資訊，請聯絡平台管理員協助。</p>
      </UCard>

      <UCard v-else-if="driver.approvalStatus === 'rejected'" class="border-l-4 border-red-500">
        <p class="text-sm font-medium">申請未通過</p>
        <p v-if="driver.rejectionReason" class="text-xs text-muted mt-1 whitespace-pre-line">原因：{{ driver.rejectionReason }}</p>
        <p class="text-xs text-muted mt-2">請修正以下資料後，至「申請」頁重新送審。</p>
      </UCard>

      <!-- 個人資料 -->
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h2 class="font-semibold">個人資料</h2>
            <UButton v-if="canEdit" size="xs" variant="outline" icon="i-lucide-edit" label="編輯" @click="openPersonalEdit" />
          </div>
        </template>
        <div class="grid grid-cols-2 gap-3 text-sm">
          <div><span class="text-muted">姓名：</span>{{ driver.user.name }}</div>
          <div><span class="text-muted">Email：</span>{{ driver.user.email }}</div>
          <div><span class="text-muted">手機：</span>{{ driver.phone }}</div>
          <div><span class="text-muted">所屬車行：</span>{{ driver.fleet?.name || '獨立' }}</div>
          <div><span class="text-muted">緊急聯絡人：</span>{{ driver.emergencyContact || '-' }}</div>
          <div><span class="text-muted">緊急聯絡電話：</span>{{ driver.emergencyPhone || '-' }}</div>
        </div>
      </UCard>

      <!-- 證件 -->
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h2 class="font-semibold">證件</h2>
            <UButton v-if="canEdit" size="xs" variant="outline" icon="i-lucide-edit" label="編輯證件" @click="openDocsEdit" />
          </div>
        </template>
        <div class="grid grid-cols-3 gap-2">
          <div>
            <p class="text-xs text-muted mb-1">身分證正面</p>
            <button class="aspect-3/2 w-full rounded border bg-elevated overflow-hidden hover:opacity-80" @click="openImagePreview(driver.idCardFrontKey)">
              <img v-if="driver.idCardFrontKey" :src="driver.idCardFrontKey" alt="" class="w-full h-full object-cover" />
              <span v-else class="text-xs text-muted">未上傳</span>
            </button>
          </div>
          <div>
            <p class="text-xs text-muted mb-1">身分證背面</p>
            <button class="aspect-3/2 w-full rounded border bg-elevated overflow-hidden hover:opacity-80" @click="openImagePreview(driver.idCardBackKey)">
              <img v-if="driver.idCardBackKey" :src="driver.idCardBackKey" alt="" class="w-full h-full object-cover" />
              <span v-else class="text-xs text-muted">未上傳</span>
            </button>
          </div>
          <div>
            <p class="text-xs text-muted mb-1">職業駕照</p>
            <button class="aspect-3/2 w-full rounded border bg-elevated overflow-hidden hover:opacity-80" @click="openImagePreview(driver.professionalLicenseKey)">
              <img v-if="driver.professionalLicenseKey" :src="driver.professionalLicenseKey" alt="" class="w-full h-full object-cover" />
              <span v-else class="text-xs text-muted">未上傳</span>
            </button>
          </div>
        </div>
        <p class="text-xs text-muted mt-3">駕照到期日：{{ driver.licenseExpiry || '未填寫' }}</p>
      </UCard>

      <!-- 車輛 -->
      <UCard v-if="vehicle">
        <template #header>
          <div class="flex items-center justify-between">
            <h2 class="font-semibold">車輛資料</h2>
            <UButton v-if="canEdit" size="xs" variant="outline" icon="i-lucide-edit" label="編輯車輛" @click="openVehicleEdit" />
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
        <div class="grid grid-cols-2 gap-2 mt-4">
          <div>
            <p class="text-xs text-muted mb-1">汽車照片</p>
            <button class="aspect-3/2 w-full rounded border bg-elevated overflow-hidden hover:opacity-80" @click="openImagePreview(vehicle.vehiclePhotoKey)">
              <img v-if="vehicle.vehiclePhotoKey" :src="vehicle.vehiclePhotoKey" alt="" class="w-full h-full object-cover" />
              <span v-else class="text-xs text-muted">未上傳</span>
            </button>
          </div>
          <div>
            <p class="text-xs text-muted mb-1">汽車行照</p>
            <button class="aspect-3/2 w-full rounded border bg-elevated overflow-hidden hover:opacity-80" @click="openImagePreview(vehicle.vehicleRegistrationKey)">
              <img v-if="vehicle.vehicleRegistrationKey" :src="vehicle.vehicleRegistrationKey" alt="" class="w-full h-full object-cover" />
              <span v-else class="text-xs text-muted">未上傳</span>
            </button>
          </div>
        </div>

        <div class="border-t pt-3 mt-4">
          <p class="text-sm font-medium mb-2">保險</p>
          <div class="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
            <div><span class="text-muted">強制險：</span>{{ vehicle.compulsoryInsurer || '-' }}</div>
            <div><span class="text-muted">到期日：</span>{{ vehicle.insuranceExpiry || '-' }}</div>
            <div>第三責任險：{{ vehicle.hasThirdPartyLiability ? '✓' : '-' }}</div>
            <div>旅客責任險：{{ vehicle.hasPassengerLiability ? '✓' : '-' }}</div>
            <div>駕駛人傷害險：{{ vehicle.hasDriverInjury ? '✓' : '-' }}</div>
            <div>超額責任險：{{ vehicle.hasExcessLiability ? '✓' : '-' }}</div>
          </div>
        </div>
      </UCard>
    </div>

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
            <FileUploadField label="身分證正面" :value="docsForm.idCardFrontUrl" :uploading="uploadingFlags.idCardFrontUrl" @select="(e: Event) => handleDocFile('idCardFrontUrl', e)" />
            <FileUploadField label="身分證背面" :value="docsForm.idCardBackUrl" :uploading="uploadingFlags.idCardBackUrl" @select="(e: Event) => handleDocFile('idCardBackUrl', e)" />
          </div>
          <FileUploadField label="職業駕照" :value="docsForm.professionalLicenseUrl" :uploading="uploadingFlags.professionalLicenseUrl" @select="(e: Event) => handleDocFile('professionalLicenseUrl', e)" />
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
            <UFormField label="車牌"><UInput v-model="vehicleForm.plate" class="w-full" /></UFormField>
            <UFormField label="車型"><UInput v-model="vehicleForm.vehicleType" class="w-full" /></UFormField>
            <UFormField label="可乘載人數"><UInput v-model.number="vehicleForm.seatCount" type="number" min="1" max="50" class="w-full" /></UFormField>
            <UFormField label="可乘載輪椅"><UInput v-model.number="vehicleForm.wheelchairCapacity" type="number" min="0" max="20" class="w-full" /></UFormField>
          </div>
          <div class="flex flex-wrap gap-4">
            <label class="flex items-center gap-2"><UCheckbox v-model="vehicleForm.isAccessible" /><span class="text-sm">無障礙車輛</span></label>
            <label class="flex items-center gap-2"><UCheckbox v-model="vehicleForm.isRental" /><span class="text-sm">租賃車</span></label>
          </div>
          <UFormField label="起始地點"><UInput v-model="vehicleForm.homeAddress" class="w-full" /></UFormField>

          <h3 class="font-semibold text-base pt-2">證件文件</h3>
          <div class="grid grid-cols-2 gap-3">
            <FileUploadField label="汽車照片" :value="vehicleForm.vehiclePhotoUrl" :uploading="uploadingFlags.vehiclePhotoUrl" @select="(e: Event) => handleVehicleFile('vehiclePhotoUrl', e)" />
            <FileUploadField label="汽車行照" :value="vehicleForm.vehicleRegistrationUrl" :uploading="uploadingFlags.vehicleRegistrationUrl" @select="(e: Event) => handleVehicleFile('vehicleRegistrationUrl', e)" />
          </div>

          <h3 class="font-semibold text-base pt-2">保險</h3>
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="強制險公司"><UInput v-model="vehicleForm.compulsoryInsurer" class="w-full" /></UFormField>
            <UFormField label="保險到期日"><UInput v-model="vehicleForm.insuranceExpiry" type="date" class="w-full" /></UFormField>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <label class="flex items-center gap-2"><UCheckbox v-model="vehicleForm.hasThirdPartyLiability" /><span class="text-sm">第三責任險</span></label>
            <label class="flex items-center gap-2"><UCheckbox v-model="vehicleForm.hasPassengerLiability" /><span class="text-sm">旅客責任險</span></label>
            <label class="flex items-center gap-2"><UCheckbox v-model="vehicleForm.hasDriverInjury" /><span class="text-sm">駕駛人傷害險</span></label>
            <label class="flex items-center gap-2"><UCheckbox v-model="vehicleForm.hasExcessLiability" /><span class="text-sm">超額責任險</span></label>
          </div>
          <UFormField label="備註"><UTextarea v-model="vehicleForm.notes" :rows="2" class="w-full" /></UFormField>

          <div class="flex justify-end gap-2 pt-2">
            <UButton color="neutral" variant="outline" label="取消" @click="showVehicleModal = false" />
            <UButton color="primary" :loading="savingVehicle" label="儲存" @click="saveVehicle" />
          </div>
        </div>
      </template>
    </UModal>

    <!-- 圖片預覽 -->
    <UModal v-model:open="showPreview">
      <template #content>
        <div class="p-2">
          <img v-if="previewUrl" :src="previewUrl" alt="預覽" class="w-full h-auto rounded" />
        </div>
      </template>
    </UModal>
  </div>
</template>
