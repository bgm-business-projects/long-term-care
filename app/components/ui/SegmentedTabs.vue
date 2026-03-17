<script setup lang="ts">
defineProps<{
  options: { label: string; value: string }[]
}>()

const model = defineModel<string>({ required: true })

defineEmits<{
  change: [value: string]
}>()
</script>

<template>
  <div class="flex rounded-lg border border-muted overflow-hidden">
    <button
      v-for="(opt, i) in options"
      :key="opt.value"
      type="button"
      class="flex-1 px-3 py-1.5 text-xs font-medium transition-colors"
      :class="[
        model === opt.value
          ? 'bg-primary text-white'
          : 'bg-default text-muted hover:text-default',
        i > 0 ? 'border-l border-muted' : ''
      ]"
      @click="model = opt.value; $emit('change', opt.value)"
    >
      {{ opt.label }}
    </button>
  </div>
</template>
