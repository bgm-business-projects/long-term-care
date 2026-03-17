<script setup lang="ts">
import { animate, stagger } from 'animejs'

interface NavItem {
  label: string
  icon: string
  to: string
}

defineProps<{
  items: NavItem[]
}>()

const route = useRoute()
const navRef = ref<HTMLElement | null>(null)

onMounted(() => {
  if (!navRef.value) return

  // Nav bar entry animation
  animate(navRef.value, {
    translateY: [60, 0],
    opacity: [0, 1],
    duration: 500,
    ease: 'out(3)',
    delay: 200
  })

  // Nav items stagger
  const items = navRef.value.querySelectorAll('.nav-item')
  animate(items, {
    scale: [0.8, 1],
    opacity: [0, 1],
    delay: stagger(80, { start: 300 }),
    duration: 400,
    ease: 'out(3)'
  })

})

// Animate active indicator on route change
const indicatorRefs = ref<Map<string, HTMLElement>>(new Map())

function setIndicatorRef(to: string, el: any) {
  if (el) indicatorRefs.value.set(to, el as HTMLElement)
}

watch(() => route.path, (newPath) => {
  const el = indicatorRefs.value.get(newPath)
  if (el) {
    animate(el, {
      scaleX: [0, 1.2, 1],
      opacity: [0, 1],
      duration: 350,
      ease: 'out(3)'
    })
  }
})

</script>

<template>
  <nav
    ref="navRef"
    class="fixed bottom-0 inset-x-0 z-40 bg-default border-t border-muted md:hidden"
  >
    <div class="flex justify-around items-end h-16 pb-[env(safe-area-inset-bottom)]">
      <NuxtLink
        v-for="item in items"
        :key="item.to"
        :to="item.to"
        class="nav-item flex flex-col items-center justify-center gap-1 flex-1 h-full relative"
        :class="route.path === item.to ? 'text-primary' : 'text-muted'"
      >
        <div
          :ref="(el) => setIndicatorRef(item.to, el)"
          class="absolute top-0 inset-x-0 mx-auto w-12 h-0.5 rounded-full bg-primary transition-opacity"
          :class="route.path === item.to ? 'opacity-100' : 'opacity-0'"
          :style="route.path === item.to ? {} : { transform: 'scaleX(0)' }"
        />
        <UIcon :name="item.icon" class="text-xl" />
        <span class="text-xs font-medium">{{ item.label }}</span>
      </NuxtLink>
    </div>

  </nav>
</template>
