<script setup lang="ts">
import { Cropper } from 'vue-advanced-cropper'
import 'vue-advanced-cropper/dist/style.css'

const { t } = useI18n()
const {
  isOpen,
  imageUrl,
  aspectRatio,
  queueCurrent,
  queueTotal,
  isProcessing,
  confirmCrop,
  skipCrop,
} = usePhotoCropper()

const cropperRef = ref<InstanceType<typeof Cropper> | null>(null)

const modalOpen = computed({
  get: () => isOpen.value,
  set: () => {
    // Prevent closing by clicking overlay — must use skip or confirm
  },
})

async function handleConfirm() {
  const cropper = cropperRef.value
  if (!cropper) return
  const { canvas } = cropper.getResult()
  if (canvas) {
    await confirmCrop(canvas)
  }
}

async function handleSkip() {
  await skipCrop()
}
</script>

<template>
  <UModal
    v-model:open="modalOpen"
    :title="t('photoCrop.title')"
    :close="false"
    :ui="{ content: 'sm:max-w-lg' }"
  >
    <template #body>
      <div class="space-y-4">
        <!-- Progress indicator -->
        <div v-if="queueTotal > 1" class="text-center text-sm text-muted">
          {{ t('photoCrop.progress', { current: queueCurrent, total: queueTotal }) }}
        </div>

        <!-- Cropper -->
        <div class="relative aspect-square w-full overflow-hidden rounded-lg bg-black">
          <Cropper
            v-if="imageUrl"
            ref="cropperRef"
            :src="imageUrl"
            :stencil-props="{ aspectRatio }"
            :canvas="{ maxWidth: 1920, maxHeight: 1920 }"
            class="h-full w-full"
            image-restriction="stencil"
          />
        </div>

        <!-- Actions -->
        <div class="flex justify-end gap-2">
          <UButton
            :label="t('photoCrop.skip')"
            color="neutral"
            variant="outline"
            :loading="isProcessing"
            @click="handleSkip"
          />
          <UButton
            :label="t('photoCrop.confirm')"
            color="primary"
            :loading="isProcessing"
            @click="handleConfirm"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>
