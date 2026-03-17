<script setup lang="ts">
import { getPhotoUrl, getPhotoFallbackSize, type PhotoSize } from '~/utils/photo-url'

defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{
  src: string
  size?: PhotoSize
  alt?: string
}>(), {
  size: 'lg',
  alt: '',
})

const currentSize = ref<PhotoSize>(props.size)
const currentSrc = computed(() => getPhotoUrl(props.src, currentSize.value))
const failed = ref(false)

watch(() => [props.src, props.size], () => {
  currentSize.value = props.size
  failed.value = false
})

function onError() {
  const fallback = getPhotoFallbackSize(currentSize.value)
  if (fallback) { currentSize.value = fallback }
  else { failed.value = true }
}
</script>

<template>
  <img v-if="!failed" :src="currentSrc" :alt="alt" v-bind="$attrs" @error="onError" />
  <slot v-else name="fallback" />
</template>
