import { animate } from 'animejs'
import type { Ref } from 'vue'

const NAV_ORDER = ['/', '/profile', '/plans', '/admin']

let lastPath: string | null = null
let isFirstLoad = true

export function usePageTransition(contentRef: Ref<HTMLElement | null>) {
  const route = useRoute()

  onMounted(() => {
    if (!contentRef.value) return

    if (isFirstLoad) {
      // First load: fade only
      animate(contentRef.value, {
        opacity: [0, 1],
        duration: 350,
        ease: 'out(3)'
      })
      isFirstLoad = false
      lastPath = route.path
      return
    }

    // Determine direction based on nav order
    const fromIndex = NAV_ORDER.indexOf(lastPath ?? '/')
    const toIndex = NAV_ORDER.indexOf(route.path)
    const direction = toIndex >= fromIndex ? 1 : -1

    animate(contentRef.value, {
      translateX: [30 * direction, 0],
      opacity: [0, 1],
      duration: 350,
      ease: 'out(3)'
    })

    lastPath = route.path
  })
}
