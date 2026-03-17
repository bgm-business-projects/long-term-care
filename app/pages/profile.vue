<script setup lang="ts">
const { t } = useI18n()

useSeoMeta({
  title: () => t('seo.profile.title'),
  ogTitle: () => t('seo.profile.title'),
  description: () => t('seo.profile.description'),
  ogDescription: () => t('seo.profile.description'),
})

const toast = useToast()
const { user, signOut, updateUser, changePassword } = useAuth()
const { api } = useApi()
const { tier, isPermanent, isExpired, redeem, previewCode, fetchSubscriptionState } = useSubscription()

// --- Personal Info ---
const nameInput = ref(user.value?.name ?? '')
const nameSaving = ref(false)

const nameChanged = computed(() => nameInput.value.trim() !== (user.value?.name ?? ''))

async function handleSaveName() {
  const trimmed = nameInput.value.trim()
  if (!trimmed) {
    nameError.value = t('profile.error.nameTooShort')
    return
  }
  nameError.value = ''
  nameSaving.value = true
  try {
    await updateUser({ name: trimmed })
    toast.add({ title: t('profile.toast.nameUpdated'), color: 'success' })
  } catch {
    nameError.value = t('auth.error.generic')
  } finally {
    nameSaving.value = false
  }
}

const nameError = ref('')

// --- Linked Accounts ---
const { $authClient } = useNuxtApp()
const authClient = $authClient as ReturnType<typeof import('better-auth/vue').createAuthClient>

interface LinkedAccount {
  id: string
  providerId: string
  accountId: string
}

const linkedAccounts = ref<LinkedAccount[]>([])
const accountsLoading = ref(true)
const linkingGoogle = ref(false)
const unlinkingGoogle = ref(false)

const hasEmailPassword = computed(() =>
  linkedAccounts.value.some(a => a.providerId === 'credential')
)
const hasGoogle = computed(() =>
  linkedAccounts.value.some(a => a.providerId === 'google')
)
const canUnlink = computed(() => linkedAccounts.value.length > 1)

async function loadLinkedAccounts() {
  accountsLoading.value = true
  try {
    const { data } = await authClient.listAccounts()
    linkedAccounts.value = (data as LinkedAccount[]) ?? []
  } catch {
    linkedAccounts.value = []
  } finally {
    accountsLoading.value = false
  }
}

async function handleLinkGoogle() {
  linkingGoogle.value = true
  try {
    await authClient.linkSocial({
      provider: 'google',
      callbackURL: '/profile'
    })
  } catch {
    toast.add({ title: t('auth.error.generic'), color: 'error' })
    linkingGoogle.value = false
  }
}

async function handleUnlinkGoogle() {
  if (!canUnlink.value) {
    toast.add({ title: t('profile.linkedAccounts.cannotUnlink'), color: 'warning', icon: 'i-lucide-alert-triangle' })
    return
  }
  if (!confirm(t('profile.linkedAccounts.unlinkConfirm'))) return
  unlinkingGoogle.value = true
  try {
    await authClient.unlinkAccount({ providerId: 'google' })
    toast.add({ title: t('profile.linkedAccounts.toast.unlinked'), color: 'success', icon: 'i-lucide-unlink' })
    await loadLinkedAccounts()
  } catch {
    toast.add({ title: t('auth.error.generic'), color: 'error' })
  } finally {
    unlinkingGoogle.value = false
  }
}

// --- Change Password ---
const pwForm = reactive({ current: '', newPw: '', confirm: '' })
const pwError = ref('')
const pwSaving = ref(false)

const passwordChecks = computed(() => [
  { key: 'minLength', pass: pwForm.newPw.length >= 8, label: t('auth.passwordRule.minLength') },
  { key: 'maxLength', pass: pwForm.newPw.length <= 128, label: t('auth.passwordRule.maxLength') },
  { key: 'match', pass: pwForm.confirm.length > 0 && pwForm.newPw === pwForm.confirm, label: t('auth.passwordRule.match') }
])

const passwordValid = computed(() => passwordChecks.value.every(c => c.pass))

async function handleChangePassword() {
  pwError.value = ''

  if (!passwordValid.value) {
    pwError.value = t('auth.error.passwordTooShort')
    return
  }

  pwSaving.value = true
  try {
    await changePassword(pwForm.current, pwForm.newPw)
    toast.add({ title: t('profile.toast.passwordChanged'), color: 'success' })
    pwForm.current = ''
    pwForm.newPw = ''
    pwForm.confirm = ''
  } catch (err: any) {
    if (err?.code === 'INVALID_CREDENTIALS') {
      pwError.value = t('profile.error.wrongPassword')
    } else {
      pwError.value = t('auth.error.generic')
    }
  } finally {
    pwSaving.value = false
  }
}

// --- Scroll to section if query param present ---
const route = useRoute()
const redeemCardRef = ref<HTMLElement | null>(null)

onMounted(() => {
  loadLinkedAccounts()
  fetchSubscriptionState()
  if (route.query.section === 'redeem') {
    nextTick(() => {
      redeemCardRef.value?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }
})

// --- Redemption Code ---
const redeemCode = ref('')
const redeemLoading = ref(false)
const redeemError = ref('')
const showDowngradeModal = ref(false)
const downgradeInfo = ref<{ currentTier: string; newTier: string } | null>(null)

// Preview state
const showPreviewModal = ref(false)
const previewLoading = ref(false)
const previewData = ref<{ status: string; tier?: string; durationDays?: number | null } | null>(null)

const tierBadgeColor = computed(() => {
  switch (tier.value) {
    case 'partner': return 'success' as const
    case 'premium': return 'warning' as const
    case 'pro': return 'primary' as const
    default: return 'neutral' as const
  }
})

const expiresAtDisplay = computed(() => {
  if (tier.value === 'free') return null
  if (isPermanent.value) return t('subscription.permanent')
  if (isExpired.value) return t('subscription.expired')
  const exp = user.value?.subscriptionExpiresAt
  if (!exp) return null
  const ms = typeof exp === 'string' ? new Date(exp).getTime() : (Number(exp) > 1e12 ? Number(exp) : Number(exp) * 1000)
  const d = new Date(ms)
  return t('subscription.expiresOn', { date: d.toLocaleDateString() })
})

async function handlePreview() {
  const code = redeemCode.value.trim()
  if (!code) return
  redeemError.value = ''
  previewLoading.value = true
  try {
    const result = await previewCode(code)
    previewData.value = result
    if (result.status === 'available') {
      showPreviewModal.value = true
    } else if (result.status === 'used') {
      redeemError.value = t('subscription.preview.statusUsed')
    } else if (result.status === 'disabled') {
      redeemError.value = t('subscription.preview.statusDisabled')
    } else {
      redeemError.value = t('subscription.preview.statusInvalid')
    }
  } catch {
    redeemError.value = t('auth.error.generic')
  } finally {
    previewLoading.value = false
  }
}

async function handleConfirmRedeem(force = false) {
  showPreviewModal.value = false
  const code = redeemCode.value.trim()
  if (!code) return
  redeemError.value = ''
  redeemLoading.value = true
  try {
    const result = await redeem(code, force)
    if (result.action === 'downgrade_confirm') {
      downgradeInfo.value = { currentTier: result.currentTier, newTier: result.newTier }
      showDowngradeModal.value = true
      return
    }
    if (result.action === 'already_permanent') {
      toast.add({ title: t('subscription.toast.alreadyPermanent'), color: 'info', icon: 'i-lucide-info' })
    } else if (result.action === 'extended') {
      toast.add({ title: t('subscription.toast.extended'), color: 'success', icon: 'i-lucide-calendar-plus' })
    } else {
      toast.add({ title: t('subscription.toast.redeemed'), color: 'success', icon: 'i-lucide-gift' })
    }
    redeemCode.value = ''
  } catch (err: any) {
    const msg = err?.data?.statusMessage || err?.statusMessage || ''
    if (msg === 'INVALID_CODE') redeemError.value = t('subscription.error.invalidCode')
    else if (msg === 'ALREADY_USED') redeemError.value = t('subscription.error.alreadyUsed')
    else if (msg === 'CODE_DISABLED') redeemError.value = t('subscription.error.codeDisabled')
    else redeemError.value = t('auth.error.generic')
  } finally {
    redeemLoading.value = false
  }
}

async function handleForceDowngrade() {
  showDowngradeModal.value = false
  await handleConfirmRedeem(true)
}
</script>

<template>
  <div class="p-4 pb-24 max-w-2xl mx-auto space-y-6">
    <h1 class="text-2xl font-bold text-highlighted">{{ t('profile.title') }}</h1>

    <!-- Subscription Information -->
    <UCard>
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-semibold text-highlighted">{{ t('subscription.title') }}</h2>
          <UBadge
            :label="t(`subscription.tier.${tier}`)"
            :color="tierBadgeColor"
            size="lg"
          />
        </div>

        <!-- Expiry -->
        <div v-if="expiresAtDisplay" class="text-sm" :class="isExpired ? 'text-red-500 font-medium' : 'text-muted'">
          {{ expiresAtDisplay }}
        </div>
      </div>
    </UCard>

    <!-- Redeem Code -->
    <UCard ref="redeemCardRef">
      <div class="space-y-3">
        <h2 class="text-lg font-semibold text-highlighted">{{ t('subscription.redeem') }}</h2>
        <form class="flex gap-2" @submit.prevent="handlePreview">
          <UInput
            v-model="redeemCode"
            :placeholder="t('subscription.redeemPlaceholder')"
            class="flex-1"
          />
          <UButton
            type="submit"
            :label="t('subscription.redeemButton')"
            :loading="previewLoading"
            :disabled="!redeemCode.trim()"
            color="primary"
          />
        </form>
        <p v-if="redeemError" class="text-sm text-red-500">{{ redeemError }}</p>
      </div>
    </UCard>

    <!-- Personal Information -->
    <UCard>
      <div class="space-y-4">
        <h2 class="text-lg font-semibold text-highlighted">{{ t('profile.personalInfo') }}</h2>

        <UFormField :label="t('profile.email')">
          <UInput
            :model-value="user?.email"
            disabled
            class="w-full"
          />
        </UFormField>

        <form class="space-y-3" @submit.prevent="handleSaveName">
          <UFormField :label="t('profile.name')">
            <UInput
              v-model="nameInput"
              class="w-full"
            />
          </UFormField>

          <p v-if="nameError" class="text-sm text-red-500">{{ nameError }}</p>

          <UButton
            type="submit"
            :loading="nameSaving"
            :disabled="!nameChanged"
            :label="t('profile.save')"
          />
        </form>
      </div>
    </UCard>

    <!-- Linked Accounts -->
    <UCard>
      <div class="space-y-4">
        <h2 class="text-lg font-semibold text-highlighted">{{ t('profile.linkedAccounts.title') }}</h2>

        <div v-if="accountsLoading" class="flex justify-center py-4">
          <UIcon name="i-lucide-loader-2" class="text-xl text-muted animate-spin" />
        </div>

        <div v-else class="space-y-3">
          <!-- Email & Password -->
          <div class="flex items-center justify-between p-3 rounded-lg border border-muted">
            <div class="flex items-center gap-3">
              <UIcon name="i-lucide-mail" class="text-lg text-muted" />
              <div>
                <p class="text-sm font-medium">{{ t('profile.linkedAccounts.emailPassword') }}</p>
                <p class="text-xs text-muted">{{ user?.email }}</p>
              </div>
            </div>
            <UBadge v-if="hasEmailPassword" :label="t('profile.linkedAccounts.linked')" color="success" variant="subtle" size="xs" />
          </div>

          <!-- Google -->
          <div class="flex items-center justify-between p-3 rounded-lg border border-muted">
            <div class="flex items-center gap-3">
              <UIcon name="i-lucide-chrome" class="text-lg text-muted" />
              <div>
                <p class="text-sm font-medium">{{ t('profile.linkedAccounts.google') }}</p>
                <p v-if="hasGoogle" class="text-xs text-muted">{{ t('profile.linkedAccounts.linked') }}</p>
              </div>
            </div>
            <UButton
              v-if="!hasGoogle"
              :label="t('profile.linkedAccounts.linkGoogle')"
              color="primary"
              variant="outline"
              size="xs"
              icon="i-lucide-link"
              :loading="linkingGoogle"
              @click="handleLinkGoogle"
            />
            <UButton
              v-else
              :label="t('profile.linkedAccounts.unlinkGoogle')"
              color="neutral"
              variant="ghost"
              size="xs"
              icon="i-lucide-unlink"
              :loading="unlinkingGoogle"
              :disabled="!canUnlink"
              :title="!canUnlink ? t('profile.linkedAccounts.cannotUnlink') : undefined"
              @click="handleUnlinkGoogle"
            />
          </div>
        </div>
      </div>
    </UCard>

    <!-- Change Password -->
    <UCard>
      <div class="space-y-4">
        <h2 class="text-lg font-semibold text-highlighted">{{ t('profile.changePassword') }}</h2>

        <form class="space-y-3" @submit.prevent="handleChangePassword">
          <UFormField :label="t('profile.currentPassword')">
            <UInput
              v-model="pwForm.current"
              type="password"
              :placeholder="t('auth.passwordPlaceholder')"
              required
              class="w-full"
            />
          </UFormField>

          <UFormField :label="t('profile.newPassword')">
            <UInput
              v-model="pwForm.newPw"
              type="password"
              :placeholder="t('auth.passwordPlaceholder')"
              required
              minlength="8"
              maxlength="128"
              class="w-full"
            />
          </UFormField>

          <UFormField :label="t('profile.confirmNewPassword')">
            <UInput
              v-model="pwForm.confirm"
              type="password"
              :placeholder="t('auth.confirmPasswordPlaceholder')"
              required
              class="w-full"
            />
          </UFormField>

          <ul v-if="pwForm.newPw.length > 0" class="space-y-1 text-xs">
            <li
              v-for="check in passwordChecks"
              :key="check.key"
              class="flex items-center gap-1.5"
              :class="check.pass ? 'text-green-600' : 'text-muted'"
            >
              <UIcon
                :name="check.pass ? 'i-lucide-check-circle' : 'i-lucide-circle'"
                class="text-sm flex-shrink-0"
              />
              {{ check.label }}
            </li>
          </ul>

          <p v-if="pwError" class="text-sm text-red-500">{{ pwError }}</p>

          <UButton
            type="submit"
            :loading="pwSaving"
            :label="t('profile.updatePassword')"
          />
        </form>
      </div>
    </UCard>

    <!-- Sign Out -->
    <UButton
      block
      variant="outline"
      icon="i-lucide-log-out"
      :label="t('auth.logout')"
      @click="signOut()"
    />

    <!-- Preview Confirmation Modal -->
    <UModal v-model:open="showPreviewModal" :title="t('subscription.preview.title')">
      <template #body>
        <div v-if="previewData" class="space-y-4 p-4">
          <div class="space-y-3">
            <div class="flex justify-between text-sm">
              <span class="text-muted">{{ t('subscription.preview.tier') }}</span>
              <UBadge :label="t(`subscription.tier.${previewData.tier}`)" color="primary" />
            </div>
            <div class="flex justify-between text-sm">
              <span class="text-muted">{{ t('subscription.preview.duration') }}</span>
              <span class="font-medium text-highlighted">
                {{ previewData.durationDays ? t('subscription.preview.durationValue', { n: previewData.durationDays }) : t('subscription.preview.permanent') }}
              </span>
            </div>
          </div>
          <div class="flex justify-end gap-2">
            <UButton
              :label="t('subscription.downgrade.cancel')"
              color="neutral"
              variant="outline"
              @click="showPreviewModal = false"
            />
            <UButton
              :label="t('subscription.preview.confirm')"
              color="primary"
              :loading="redeemLoading"
              @click="handleConfirmRedeem(false)"
            />
          </div>
        </div>
      </template>
    </UModal>

    <!-- Downgrade Confirmation Modal -->
    <UModal v-model:open="showDowngradeModal" :title="t('subscription.downgrade.title')">
      <template #body>
        <div class="space-y-4 p-4">
          <p class="text-sm text-default">
            {{ t('subscription.downgrade.message', {
              current: t(`subscription.tier.${downgradeInfo?.currentTier ?? 'free'}`),
              new: t(`subscription.tier.${downgradeInfo?.newTier ?? 'free'}`)
            }) }}
          </p>
          <div class="flex justify-end gap-2">
            <UButton
              :label="t('subscription.downgrade.cancel')"
              color="neutral"
              variant="outline"
              @click="showDowngradeModal = false"
            />
            <UButton
              :label="t('subscription.downgrade.confirm')"
              color="error"
              @click="handleForceDowngrade"
            />
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
