<script setup lang="ts">
interface Props {
  label: string
  value?: string
  uploading?: boolean
  required?: boolean
  accept?: string
}

const props = withDefaults(defineProps<Props>(), {
  value: '',
  uploading: false,
  required: false,
  accept: 'image/jpeg,image/png,image/webp,image/heic,image/heif',
})

const emit = defineEmits<{ select: [event: Event] }>()

const fileInput = ref<HTMLInputElement | null>(null)
function pick() {
  fileInput.value?.click()
}
</script>

<template>
  <div>
    <label class="block text-sm mb-1">
      {{ label }}<span v-if="required" class="text-red-500">*</span>
    </label>
    <div
      class="relative border border-dashed border-default rounded p-3 flex items-center gap-3 cursor-pointer hover:bg-elevated transition"
      @click="pick"
    >
      <div class="shrink-0 w-20 h-20 bg-elevated rounded overflow-hidden flex items-center justify-center">
        <img v-if="props.value" :src="props.value" alt="預覽" class="w-full h-full object-cover" />
        <UIcon v-else name="i-lucide-upload" class="w-7 h-7 text-muted" />
      </div>
      <div class="flex-1 text-sm">
        <p v-if="props.uploading" class="text-primary">上傳中…</p>
        <p v-else-if="props.value" class="text-success">已上傳，點擊更換</p>
        <p v-else class="text-muted">點擊上傳檔案 (JPG/PNG/WebP)</p>
      </div>
      <input
        ref="fileInput"
        type="file"
        :accept="props.accept"
        class="hidden"
        @change="emit('select', $event)"
      />
    </div>
  </div>
</template>
