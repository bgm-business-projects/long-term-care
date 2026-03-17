<script setup lang="ts">
const { t } = useI18n()
const { showTierChangeModal, tierChangeInfo, acknowledgeTierChange } = useTierChangeModal()

const isUpgrade = computed(() => tierChangeInfo.value?.direction === 'upgrade')

async function handleOk() {
  await acknowledgeTierChange()
}

function handleViewPlans() {
  acknowledgeTierChange()
  navigateTo('/plans')
}
</script>

<template>
  <UModal v-model:open="showTierChangeModal" :title="isUpgrade ? t('subscription.tierChange.upgradeTitle') : t('subscription.tierChange.downgradeTitle')">
    <template #body>
      <div class="p-4 space-y-4">
        <!-- Icon + description -->
        <div class="flex flex-col items-center gap-3 text-center">
          <div
            class="flex size-12 items-center justify-center rounded-full"
            :class="isUpgrade ? 'bg-green-50 dark:bg-green-950' : 'bg-amber-50 dark:bg-amber-950'"
          >
            <UIcon
              :name="isUpgrade ? 'i-lucide-arrow-up-circle' : 'i-lucide-arrow-down-circle'"
              class="size-6"
              :class="isUpgrade ? 'text-green-500' : 'text-amber-500'"
            />
          </div>
          <p class="text-sm text-muted">{{ t('subscription.tierChange.description') }}</p>
        </div>

        <!-- Old → New comparison cards -->
        <div v-if="tierChangeInfo" class="flex items-center gap-3">
          <!-- Old plan -->
          <div class="flex-1 rounded-lg border border-muted p-3 text-center">
            <p class="text-xs text-muted mb-1">{{ t('subscription.tierChange.oldPlan') }}</p>
            <p class="font-semibold text-default">{{ t(`subscription.tier.${tierChangeInfo.oldTier}`) }}</p>
          </div>

          <!-- Arrow -->
          <UIcon name="i-lucide-arrow-right" class="text-muted shrink-0" />

          <!-- New plan -->
          <div
            class="flex-1 rounded-lg border p-3 text-center"
            :class="isUpgrade ? 'border-green-300 dark:border-green-700 bg-green-50/50 dark:bg-green-950/50' : 'border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/50'"
          >
            <p class="text-xs text-muted mb-1">{{ t('subscription.tierChange.newPlan') }}</p>
            <p class="font-semibold text-default">{{ t(`subscription.tier.${tierChangeInfo.newTier}`) }}</p>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex justify-center gap-2">
          <UButton
            v-if="!isUpgrade"
            :label="t('subscription.tierChange.viewPlans')"
            color="neutral"
            variant="outline"
            @click="handleViewPlans"
          />
          <UButton
            :label="t('subscription.tierChange.ok')"
            :color="isUpgrade ? 'primary' : 'neutral'"
            @click="handleOk"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>
