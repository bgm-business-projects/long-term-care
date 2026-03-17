export const LayoutModes = {
  STANDARD: 'standard',
  FOCUS: 'focus',
} as const

export type LayoutMode = typeof LayoutModes[keyof typeof LayoutModes]

declare module 'nuxt/app' {
  interface PageMeta {
    layoutMode?: LayoutMode
  }
}
