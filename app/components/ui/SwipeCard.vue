<script setup lang="ts">
export interface SwipeAction {
  icon: string
  label: string
  color: string
  onClick: () => void
}

const props = defineProps<{
  actions: SwipeAction[]
}>()

const cardRef = ref<HTMLElement>()
const isOpen = ref(false)
const offsetX = ref(0)
const isDragging = ref(false)

const ACTION_WIDTH = 64
const actionsTotalWidth = computed(() => props.actions.length * ACTION_WIDTH)
const threshold = computed(() => actionsTotalWidth.value * 0.4)

let startX = 0
let startOffsetX = 0
const hasMoved = ref(false)
const DRAG_THRESHOLD = 5

let pointerId = -1

function onPointerDown(e: PointerEvent) {
  // Only handle left mouse button or touch
  if (e.button !== 0) return
  isDragging.value = true
  hasMoved.value = false
  startX = e.clientX
  startOffsetX = offsetX.value
  pointerId = e.pointerId
}

function onPointerMove(e: PointerEvent) {
  if (!isDragging.value) return
  const deltaX = e.clientX - startX

  // Only start swiping after exceeding drag threshold
  if (!hasMoved.value && Math.abs(deltaX) < DRAG_THRESHOLD) return

  // Capture pointer on first confirmed horizontal swipe
  if (!hasMoved.value) {
    hasMoved.value = true
    ;(e.currentTarget as HTMLElement).setPointerCapture(pointerId)
  }

  const newOffset = startOffsetX + deltaX
  // Clamp: don't allow swiping right past 0, or left past actions width
  offsetX.value = Math.max(-actionsTotalWidth.value, Math.min(0, newOffset))
}

function onPointerUp() {
  if (!isDragging.value) return
  isDragging.value = false

  // If no significant movement, let click propagate naturally
  if (!hasMoved.value) return

  // Decide to snap open or closed
  if (Math.abs(offsetX.value) > threshold.value) {
    offsetX.value = -actionsTotalWidth.value
    isOpen.value = true
  } else {
    offsetX.value = 0
    isOpen.value = false
  }
}

function onContentClick(e: Event) {
  // If the card was swiped open, close it and prevent navigation
  if (isOpen.value) {
    e.preventDefault()
    e.stopPropagation()
    close()
    return
  }
  // If user was dragging (swiped), prevent click
  if (hasMoved.value) {
    e.preventDefault()
    e.stopPropagation()
  }
}

function close() {
  offsetX.value = 0
  isOpen.value = false
}

// Close when clicking outside
function onClickOutside(e: Event) {
  if (isOpen.value && cardRef.value && !cardRef.value.contains(e.target as Node)) {
    close()
  }
}

onMounted(() => {
  document.addEventListener('pointerdown', onClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('pointerdown', onClickOutside)
})

function handleActionClick(action: SwipeAction) {
  close()
  action.onClick()
}
</script>

<template>
  <div ref="cardRef" class="relative overflow-hidden rounded-lg">
    <!-- Action buttons (behind the card) -->
    <div class="absolute inset-y-0 right-0 flex items-stretch" :style="{ width: `${actionsTotalWidth}px` }">
      <button
        v-for="(action, i) in actions"
        :key="i"
        type="button"
        class="flex flex-col items-center justify-center gap-1 text-white text-xs font-medium touch-manipulation"
        :class="action.color"
        :style="{ width: `${ACTION_WIDTH}px` }"
        @click="handleActionClick(action)"
      >
        <UIcon :name="action.icon" class="text-lg" />
        <span>{{ action.label }}</span>
      </button>
    </div>

    <!-- Swipeable card content -->
    <div
      class="relative bg-default z-10 select-none"
      style="touch-action: pan-y"
      :class="{ 'transition-transform duration-200 ease-out': !isDragging }"
      :style="{ transform: `translateX(${offsetX}px)` }"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      @click.capture="onContentClick"
    >
      <slot />
    </div>
  </div>
</template>
