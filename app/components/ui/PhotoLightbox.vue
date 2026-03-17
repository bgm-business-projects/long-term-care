<script setup lang="ts">
const props = defineProps<{
  urls: string[]
  initialIndex?: number
}>()

const open = defineModel<boolean>('open', { default: false })

const { t } = useI18n()

const currentIndex = ref(props.initialIndex ?? 0)

watch(() => props.initialIndex, (v) => {
  if (v !== undefined) currentIndex.value = v
})

// Reset index when opening
watch(open, (val) => {
  if (val && props.initialIndex !== undefined) {
    currentIndex.value = props.initialIndex
  }
  showHint.value = val
})

const hasPrev = computed(() => currentIndex.value > 0)
const hasNext = computed(() => currentIndex.value < props.urls.length - 1)

function prev() {
  if (hasPrev.value) currentIndex.value--
}

function next() {
  if (hasNext.value) currentIndex.value++
}

// Swipe gesture
const touchStartX = ref(0)
const touchStartY = ref(0)
const touchDeltaX = ref(0)
const swiping = ref(false)

function onTouchStart(e: TouchEvent) {
  const touch = e.touches[0]
  if (!touch) return
  touchStartX.value = touch.clientX
  touchStartY.value = touch.clientY
  touchDeltaX.value = 0
  swiping.value = true
}

function onTouchMove(e: TouchEvent) {
  if (!swiping.value) return
  const touch = e.touches[0]
  if (!touch) return
  const dx = touch.clientX - touchStartX.value
  const dy = touch.clientY - touchStartY.value
  // Only track horizontal swipes
  if (Math.abs(dx) > Math.abs(dy)) {
    e.preventDefault()
    touchDeltaX.value = dx
  }
}

function onTouchEnd() {
  if (!swiping.value) return
  swiping.value = false
  const threshold = 50
  if (touchDeltaX.value > threshold) prev()
  else if (touchDeltaX.value < -threshold) next()
  touchDeltaX.value = 0
}

// Keyboard navigation
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowLeft') prev()
  else if (e.key === 'ArrowRight') next()
  else if (e.key === 'Escape') open.value = false
}

// Swipe hint: auto-hide after 2s
const showHint = ref(false)
let hintTimer: ReturnType<typeof setTimeout> | undefined
watch(showHint, (val) => {
  if (val) {
    clearTimeout(hintTimer)
    hintTimer = setTimeout(() => { showHint.value = false }, 2000)
  }
})

// Image translate during swipe
const swipeStyle = computed(() => {
  if (!swiping.value || touchDeltaX.value === 0) return {}
  // Clamp movement range
  const clamped = Math.max(-120, Math.min(120, touchDeltaX.value))
  return { transform: `translateX(${clamped}px)`, transition: 'none' }
})
</script>

<template>
  <Teleport to="body">
    <Transition name="lightbox">
      <div
        v-if="open"
        class="fixed inset-0 z-[100] flex flex-col bg-black/95"
        @keydown="onKeydown"
        tabindex="0"
        ref="containerRef"
      >
        <!-- Top bar: counter + close -->
        <div class="flex items-center justify-between px-4 py-3 text-white/80 shrink-0">
          <span class="text-sm font-medium">{{ currentIndex + 1 }} / {{ urls.length }}</span>
          <button
            type="button"
            class="p-2 rounded-full hover:bg-white/10 transition-colors"
            @click="open = false"
          >
            <UIcon name="i-lucide-x" class="text-xl" />
          </button>
        </div>

        <!-- Image area -->
        <div
          class="flex-1 flex items-center justify-center relative overflow-hidden select-none"
          @touchstart.passive="onTouchStart"
          @touchmove="onTouchMove"
          @touchend.passive="onTouchEnd"
        >
          <!-- Prev arrow (desktop) -->
          <button
            v-if="hasPrev"
            type="button"
            class="hidden sm:flex absolute left-2 z-10 p-2 rounded-full bg-black/40 text-white/80 hover:bg-black/60 transition-colors"
            @click="prev"
          >
            <UIcon name="i-lucide-chevron-left" class="text-2xl" />
          </button>

          <!-- Image -->
          <img
            :key="currentIndex"
            :src="urls[currentIndex]"
            class="max-h-full max-w-full object-contain transition-transform duration-200"
            :style="swipeStyle"
            draggable="false"
          />

          <!-- Next arrow (desktop) -->
          <button
            v-if="hasNext"
            type="button"
            class="hidden sm:flex absolute right-2 z-10 p-2 rounded-full bg-black/40 text-white/80 hover:bg-black/60 transition-colors"
            @click="next"
          >
            <UIcon name="i-lucide-chevron-right" class="text-2xl" />
          </button>

          <!-- Swipe hint (mobile, auto-fades) -->
          <Transition name="fade">
            <div
              v-if="showHint && urls.length > 1"
              class="absolute bottom-16 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/60 text-white/80 text-xs px-3 py-1.5 rounded-full pointer-events-none"
            >
              <UIcon name="i-lucide-move-horizontal" class="size-3.5" />
              <span>{{ t('photo.swipeHint') }}</span>
            </div>
          </Transition>
        </div>

        <!-- Bottom dots -->
        <div v-if="urls.length > 1" class="flex justify-center gap-1.5 pb-4 pt-2 shrink-0">
          <button
            v-for="(_, idx) in urls"
            :key="idx"
            type="button"
            class="w-2 h-2 rounded-full transition-colors"
            :class="idx === currentIndex ? 'bg-white' : 'bg-white/30'"
            @click="currentIndex = idx"
          />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.lightbox-enter-active,
.lightbox-leave-active {
  transition: opacity 0.2s ease;
}
.lightbox-enter-from,
.lightbox-leave-to {
  opacity: 0;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
