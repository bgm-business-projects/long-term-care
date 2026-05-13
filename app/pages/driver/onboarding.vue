<script setup lang="ts">
definePageMeta({ layout: false })

const { user } = useAuth()
const { api } = useApi()
const { uploadOne } = useFileUploader()
const toast = useToast()

interface FleetOption { id: string; name: string }
interface DriverData {
  fleetId: string | null
  phone: string
  idCardFrontKey: string | null
  idCardBackKey: string | null
  professionalLicenseKey: string | null
  licenseExpiry: string | null
  emergencyContact: string | null
  emergencyPhone: string | null
  user: { name: string }
}
interface VehicleData {
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
interface ApplicationStatus {
  hasApplication: boolean
  approvalStatus: 'pending' | 'approved' | 'rejected' | null
  rejectionReason?: string | null
  driver?: DriverData
  vehicle?: VehicleData | null
}

const isResubmit = ref(false)
const previousReason = ref('')

const fleets = ref<FleetOption[]>([])
const terms = ref({ content: '', updatedAt: null as string | Date | null })
const checking = ref(true)
const submitting = ref(false)
const submitError = ref('')

const form = reactive({
  name: '',
  phone: '',
  termsAccepted: false,
  hasFleet: false,
  fleetId: '',
  idCardFrontUrl: '' as string,
  idCardBackUrl: '' as string,
  professionalLicenseUrl: '' as string,
  licenseExpiry: '',
  emergencyContact: '',
  emergencyPhone: '',
  vehicle: {
    plate: '',
    vehicleType: '',
    seatCount: 4,
    wheelchairCapacity: 0,
    isAccessible: false,
    isRental: false,
    homeAddress: '',
    photoUrl: '' as string,
    registrationUrl: '' as string,
    compulsoryInsurer: '',
    insuranceExpiry: '',
    hasThirdPartyLiability: false,
    hasPassengerLiability: false,
    hasDriverInjury: false,
    hasExcessLiability: false,
    notes: '',
  },
})

const uploadingFlags = reactive<Record<string, boolean>>({})

async function handleFile(field: 'idCardFrontUrl' | 'idCardBackUrl' | 'professionalLicenseUrl' | 'photoUrl' | 'registrationUrl', e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  uploadingFlags[field] = true
  try {
    const url = await uploadOne(file)
    if (field === 'photoUrl' || field === 'registrationUrl') {
      form.vehicle[field] = url
    } else {
      form[field] = url
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '上傳失敗'
    toast.add({ title: msg, color: 'error' })
  } finally {
    uploadingFlags[field] = false
    input.value = ''
  }
}

async function loadInitial() {
  checking.value = true
  try {
    // 1. 檢查現有申請狀態
    const status = await api<ApplicationStatus>('/api/driver/me/application').catch(() => null)
    if (status?.hasApplication) {
      if (status.approvalStatus === 'pending' || status.approvalStatus === 'approved') {
        navigateTo('/driver/pending')
        return
      }
      // rejected — 帶回舊資料供修改後重新送審
      if (status.approvalStatus === 'rejected' && status.driver) {
        isResubmit.value = true
        previousReason.value = status.rejectionReason || ''
        prefillFromExisting(status.driver, status.vehicle ?? null)
      }
    }

    // 2. 若無舊資料則預填姓名
    if (!isResubmit.value && user.value?.name) {
      form.name = user.value.name
    }

    // 3. 載入車行清單與條款
    const [fleetList, termsRes] = await Promise.all([
      api<FleetOption[]>('/api/fleets'),
      api<{ content: string; updatedAt: string | null }>('/api/settings/terms'),
    ])
    fleets.value = fleetList
    terms.value = termsRes
  } finally {
    checking.value = false
  }
}

function prefillFromExisting(d: DriverData, v: VehicleData | null) {
  form.name = d.user.name
  form.phone = d.phone
  form.hasFleet = !!d.fleetId
  form.fleetId = d.fleetId || ''
  form.idCardFrontUrl = d.idCardFrontKey || ''
  form.idCardBackUrl = d.idCardBackKey || ''
  form.professionalLicenseUrl = d.professionalLicenseKey || ''
  form.licenseExpiry = d.licenseExpiry || ''
  form.emergencyContact = d.emergencyContact || ''
  form.emergencyPhone = d.emergencyPhone || ''

  if (v) {
    form.vehicle.plate = v.plate
    form.vehicle.vehicleType = v.vehicleType
    form.vehicle.seatCount = v.seatCount
    form.vehicle.wheelchairCapacity = v.wheelchairCapacity
    form.vehicle.isAccessible = v.isAccessible
    form.vehicle.isRental = v.isRental
    form.vehicle.homeAddress = v.homeAddress || ''
    form.vehicle.photoUrl = v.vehiclePhotoKey || ''
    form.vehicle.registrationUrl = v.vehicleRegistrationKey || ''
    form.vehicle.compulsoryInsurer = v.compulsoryInsurer || ''
    form.vehicle.insuranceExpiry = v.insuranceExpiry || ''
    form.vehicle.hasThirdPartyLiability = v.hasThirdPartyLiability
    form.vehicle.hasPassengerLiability = v.hasPassengerLiability
    form.vehicle.hasDriverInjury = v.hasDriverInjury
    form.vehicle.hasExcessLiability = v.hasExcessLiability
    form.vehicle.notes = v.notes || ''
  }
}

const fleetItems = computed(() =>
  fleets.value.map(f => ({ label: f.name, value: f.id })),
)

function validate(): string | null {
  if (!form.name.trim()) return '請填寫姓名'
  if (!form.phone.trim()) return '請填寫手機號碼'
  if (!form.termsAccepted) return '請勾選同意使用條款'
  if (form.hasFleet && !form.fleetId) return '請選擇所屬車行'
  if (!form.vehicle.plate.trim()) return '請填寫車牌號碼'
  if (!form.vehicle.vehicleType.trim()) return '請填寫車型'
  if (form.vehicle.seatCount < 1) return '可乘載人數需 ≥ 1'
  if (form.vehicle.isAccessible && form.vehicle.wheelchairCapacity < 1) {
    return '無障礙車輛之輪椅承載數需 ≥ 1'
  }
  if (!form.idCardFrontUrl) return '請上傳身分證正面'
  if (!form.idCardBackUrl) return '請上傳身分證背面'
  if (!form.professionalLicenseUrl) return '請上傳職業駕照'
  if (!form.vehicle.photoUrl) return '請上傳汽車照片'
  if (!form.vehicle.registrationUrl) return '請上傳汽車行照'
  return null
}

async function handleSubmit() {
  submitError.value = ''
  const err = validate()
  if (err) {
    submitError.value = err
    return
  }

  submitting.value = true
  try {
    await api('/api/driver/me/application', {
      method: 'POST',
      body: {
        name: form.name,
        phone: form.phone,
        termsAccepted: form.termsAccepted,
        hasFleet: form.hasFleet,
        fleetId: form.hasFleet ? form.fleetId : null,
        idCardFrontUrl: form.idCardFrontUrl,
        idCardBackUrl: form.idCardBackUrl,
        professionalLicenseUrl: form.professionalLicenseUrl,
        licenseExpiry: form.licenseExpiry || null,
        emergencyContact: form.emergencyContact || null,
        emergencyPhone: form.emergencyPhone || null,
        vehicle: {
          plate: form.vehicle.plate.toUpperCase().trim(),
          vehicleType: form.vehicle.vehicleType,
          seatCount: form.vehicle.seatCount,
          wheelchairCapacity: form.vehicle.wheelchairCapacity,
          isAccessible: form.vehicle.isAccessible,
          isRental: form.vehicle.isRental,
          homeAddress: form.vehicle.homeAddress || null,
          photoUrl: form.vehicle.photoUrl,
          registrationUrl: form.vehicle.registrationUrl,
          compulsoryInsurer: form.vehicle.compulsoryInsurer || null,
          insuranceExpiry: form.vehicle.insuranceExpiry || null,
          hasThirdPartyLiability: form.vehicle.hasThirdPartyLiability,
          hasPassengerLiability: form.vehicle.hasPassengerLiability,
          hasDriverInjury: form.vehicle.hasDriverInjury,
          hasExcessLiability: form.vehicle.hasExcessLiability,
          notes: form.vehicle.notes || null,
        },
      },
    })
    toast.add({ title: '申請已送出，等待審核', color: 'success' })
    navigateTo('/driver/pending')
  } catch (err: any) {
    submitError.value = err?.data?.statusMessage || err?.message || '提交失敗，請稍後再試'
  } finally {
    submitting.value = false
  }
}

onMounted(loadInitial)
</script>

<template>
  <div class="min-h-screen bg-default px-4 py-6">
    <div class="max-w-2xl mx-auto space-y-6">
      <div class="text-center space-y-2">
        <h1 class="text-2xl font-bold text-highlighted">{{ isResubmit ? '修改後重新送審' : '司機申請表' }}</h1>
        <p class="text-sm text-muted">{{ isResubmit ? '已帶入您先前送出的資料，請修正後重新送出' : '填寫完成後送出，平台將進行審核' }}</p>
      </div>

      <div v-if="checking" class="text-center text-muted py-12">
        載入中…
      </div>

      <UCard v-else-if="isResubmit && previousReason" class="border-l-4 border-red-500">
        <p class="text-sm font-medium">前次審核未通過原因</p>
        <p class="text-xs text-muted mt-1 whitespace-pre-line">{{ previousReason }}</p>
      </UCard>

      <form v-if="!checking" class="space-y-6" @submit.prevent="handleSubmit">
        <!-- 個人資料 -->
        <UCard>
          <template #header>
            <h2 class="font-semibold">個人資料</h2>
          </template>
          <div class="space-y-3">
            <UFormField label="姓名" required>
              <UInput v-model="form.name" placeholder="王小明" class="w-full" />
            </UFormField>
            <UFormField label="手機號碼" required>
              <UInput v-model="form.phone" placeholder="0912-345-678" class="w-full" />
            </UFormField>
            <div class="grid grid-cols-2 gap-3">
              <UFormField label="緊急聯絡人">
                <UInput v-model="form.emergencyContact" placeholder="選填" class="w-full" />
              </UFormField>
              <UFormField label="緊急聯絡電話">
                <UInput v-model="form.emergencyPhone" placeholder="選填" class="w-full" />
              </UFormField>
            </div>
          </div>
        </UCard>

        <!-- 車行 -->
        <UCard>
          <template #header>
            <h2 class="font-semibold">車行歸屬</h2>
          </template>
          <div class="space-y-3">
            <label class="flex items-center gap-3">
              <UCheckbox v-model="form.hasFleet" />
              <span class="text-sm">我有所屬車行</span>
            </label>
            <UFormField v-if="form.hasFleet" label="所屬車行" required>
              <USelectMenu v-model="form.fleetId" :items="fleetItems" value-key="value" placeholder="請選擇" class="w-full" />
            </UFormField>
            <p v-else class="text-xs text-muted">未綁定車行＝獨立司機，平台直接派遣</p>
          </div>
        </UCard>

        <!-- 證件 -->
        <UCard>
          <template #header>
            <h2 class="font-semibold">身分與駕照</h2>
          </template>
          <div class="space-y-4">
            <div class="grid grid-cols-2 gap-3">
              <FileUploadField label="身分證正面" :value="form.idCardFrontUrl" :uploading="uploadingFlags.idCardFrontUrl" required @select="(e: Event) => handleFile('idCardFrontUrl', e)" />
              <FileUploadField label="身分證背面" :value="form.idCardBackUrl" :uploading="uploadingFlags.idCardBackUrl" required @select="(e: Event) => handleFile('idCardBackUrl', e)" />
            </div>
            <FileUploadField label="職業駕照" :value="form.professionalLicenseUrl" :uploading="uploadingFlags.professionalLicenseUrl" required @select="(e: Event) => handleFile('professionalLicenseUrl', e)" />
            <UFormField label="駕照到期日">
              <UInput v-model="form.licenseExpiry" type="date" class="w-full" />
            </UFormField>
          </div>
        </UCard>

        <!-- 車輛 -->
        <UCard>
          <template #header>
            <h2 class="font-semibold">車輛資料</h2>
          </template>
          <div class="space-y-3">
            <div class="grid grid-cols-2 gap-3">
              <UFormField label="車牌號碼" required>
                <UInput v-model="form.vehicle.plate" placeholder="ABC-1234" class="w-full" />
              </UFormField>
              <UFormField label="車型" required>
                <UInput v-model="form.vehicle.vehicleType" placeholder="廂型車 / 轎車 / 輪椅車" class="w-full" />
              </UFormField>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <UFormField label="可乘載人數" required>
                <UInput v-model.number="form.vehicle.seatCount" type="number" min="1" max="50" class="w-full" />
              </UFormField>
              <UFormField label="可乘載輪椅數量">
                <UInput v-model.number="form.vehicle.wheelchairCapacity" type="number" min="0" max="20" class="w-full" />
              </UFormField>
            </div>
            <div class="flex flex-wrap gap-4">
              <label class="flex items-center gap-2">
                <UCheckbox v-model="form.vehicle.isAccessible" />
                <span class="text-sm">無障礙車輛</span>
              </label>
              <label class="flex items-center gap-2">
                <UCheckbox v-model="form.vehicle.isRental" />
                <span class="text-sm">租賃車</span>
              </label>
            </div>
            <UFormField label="起始地點">
              <UInput v-model="form.vehicle.homeAddress" placeholder="如：台北市大安區忠孝東路四段" class="w-full" />
            </UFormField>
            <FileUploadField label="汽車照片" :value="form.vehicle.photoUrl" :uploading="uploadingFlags.photoUrl" required @select="(e: Event) => handleFile('photoUrl', e)" />
            <FileUploadField label="汽車行照" :value="form.vehicle.registrationUrl" :uploading="uploadingFlags.registrationUrl" required @select="(e: Event) => handleFile('registrationUrl', e)" />
          </div>
        </UCard>

        <!-- 保險 -->
        <UCard>
          <template #header>
            <h2 class="font-semibold">保險資訊</h2>
          </template>
          <div class="space-y-3">
            <div class="grid grid-cols-2 gap-3">
              <UFormField label="強制險公司">
                <UInput v-model="form.vehicle.compulsoryInsurer" placeholder="如：富邦產險" class="w-full" />
              </UFormField>
              <UFormField label="保險到期日">
                <UInput v-model="form.vehicle.insuranceExpiry" type="date" class="w-full" />
              </UFormField>
            </div>
            <p class="text-xs text-muted pt-2">已承保的其他險種（可複選）：</p>
            <div class="grid grid-cols-2 gap-2">
              <label class="flex items-center gap-2"><UCheckbox v-model="form.vehicle.hasThirdPartyLiability" /><span class="text-sm">第三責任險</span></label>
              <label class="flex items-center gap-2"><UCheckbox v-model="form.vehicle.hasPassengerLiability" /><span class="text-sm">旅客責任險</span></label>
              <label class="flex items-center gap-2"><UCheckbox v-model="form.vehicle.hasDriverInjury" /><span class="text-sm">駕駛人傷害險</span></label>
              <label class="flex items-center gap-2"><UCheckbox v-model="form.vehicle.hasExcessLiability" /><span class="text-sm">超額責任險</span></label>
            </div>
            <UFormField label="備註">
              <UTextarea v-model="form.vehicle.notes" placeholder="選填" class="w-full" :rows="2" />
            </UFormField>
          </div>
        </UCard>

        <!-- 條款 -->
        <UCard>
          <template #header>
            <h2 class="font-semibold">使用條款</h2>
          </template>
          <div class="text-xs text-muted whitespace-pre-line max-h-48 overflow-y-auto p-3 bg-elevated rounded">
            {{ terms.content }}
          </div>
          <label class="flex items-start gap-3 mt-3 cursor-pointer">
            <UCheckbox v-model="form.termsAccepted" />
            <span class="text-sm">我已閱讀並同意上述條款</span>
          </label>
        </UCard>

        <p v-if="submitError" class="text-sm text-red-500 text-center">{{ submitError }}</p>

        <UButton type="submit" block size="xl" :loading="submitting" label="送出申請" />
      </form>
    </div>
  </div>
</template>
