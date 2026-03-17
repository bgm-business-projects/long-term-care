<script setup lang="ts">
const { t } = useI18n()

useSeoMeta({
  title: () => t('seo.plans.title'),
  ogTitle: () => t('seo.plans.title'),
  description: () => t('seo.plans.description'),
  ogDescription: () => t('seo.plans.description'),
})

const toast = useToast()
const { tier, redeem, previewCode } = useSubscription()

type PlanDef = {
  tier: string
  title: string
  features: string[]
}

const plans = computed<PlanDef[]>(() => [
  {
    tier: 'free',
    title: t('onboarding.tier.free.name'),
    features: [
      t('onboarding.tier.free.totalSamples'),
      t('onboarding.tier.free.csv')
    ]
  },
  {
    tier: 'pro',
    title: t('onboarding.tier.pro.name'),
    features: [
      t('onboarding.tier.pro.totalSamples'),
      t('onboarding.tier.pro.csv')
    ]
  },
  {
    tier: 'premium',
    title: t('onboarding.tier.premium.name'),
    features: [
      t('onboarding.tier.premium.totalSamples'),
      t('onboarding.tier.premium.csv')
    ]
  },
  {
    tier: 'partner',
    title: t('onboarding.tier.partner.name'),
    features: [
      t('onboarding.tier.partner.totalSamples'),
      t('onboarding.tier.partner.csv'),
      t('onboarding.tier.partner.earlyAccess'),
    ]
  }
])

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
  <div class="p-4 pb-24 max-w-4xl mx-auto space-y-8">
    <!-- Header -->
    <div class="text-center space-y-2">
      <h1 class="text-2xl font-bold text-highlighted">{{ t('plans.title') }}</h1>
      <p class="text-muted">{{ t('plans.subtitle') }}</p>
    </div>

    <!-- Pricing Plans -->
    <UPricingPlans compact>
      <UPricingPlan
        v-for="plan in plans"
        :key="plan.tier"
        :title="plan.title"
        :features="plan.features"
        :highlight="plan.tier === tier"
        :badge="plan.tier === tier ? t('onboarding.tier.currentPlan') : undefined"
        :ui="{ root: 'p-3 sm:p-6 lg:p-8 gap-3 sm:gap-6', title: 'text-lg sm:text-2xl', features: 'gap-1.5 sm:gap-3 mt-3 sm:mt-6 text-xs sm:text-sm' }"
      />
    </UPricingPlans>

    <!-- Redeem Code -->
    <UCard>
      <div class="space-y-3">
        <div class="text-center space-y-1">
          <h2 class="text-lg font-semibold text-highlighted">{{ t('plans.redeemTitle') }}</h2>
          <p class="text-sm text-muted">{{ t('plans.redeemSubtitle') }}</p>
        </div>
        <form class="flex gap-2 max-w-md mx-auto" @submit.prevent="handlePreview">
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
        <p v-if="redeemError" class="text-sm text-red-500 text-center">{{ redeemError }}</p>
      </div>
    </UCard>

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
