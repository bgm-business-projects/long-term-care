import { LayoutModes, type LayoutMode } from '~/types/layout'

export function useAppLayoutController() {
  const route = useRoute()

  const currentMode = computed<LayoutMode>(
    () => (route.meta.layoutMode as LayoutMode) || LayoutModes.STANDARD
  )

  const isFocusMode = computed(() => currentMode.value === LayoutModes.FOCUS)

  const layoutClasses = computed(() =>
    isFocusMode.value ? 'flex-1 flex flex-col min-h-0' : 'pb-20 md:pb-0'
  )

  const panelUiOptions = computed(() =>
    isFocusMode.value ? { body: '!p-0 !gap-0' } : undefined
  )

  return { currentMode, isFocusMode, layoutClasses, panelUiOptions }
}
