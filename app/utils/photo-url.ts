/** Photo size variant types */
export type PhotoSize = 'sm' | 'md' | 'lg'

/** Size suffix mapping — lg has no suffix (it's the original) */
const SUFFIX_MAP: Record<PhotoSize, string> = {
  sm: '__sm',
  md: '__md',
  lg: '',
}

/**
 * Derive variant URL from base URL by inserting size suffix before extension.
 *
 * Example:
 *   getPhotoUrl('https://photos.myapp.example.com/uid/abc.jpg', 'sm')
 *   → 'https://photos.myapp.example.com/uid/abc__sm.jpg'
 */
export function getPhotoUrl(baseUrl: string, size: PhotoSize = 'lg'): string {
  const suffix = SUFFIX_MAP[size]
  if (!suffix) return baseUrl

  const dotIndex = baseUrl.lastIndexOf('.')
  if (dotIndex === -1) return baseUrl + suffix

  return baseUrl.slice(0, dotIndex) + suffix + baseUrl.slice(dotIndex)
}

/**
 * Determine fallback size chain: sm → md → lg → null.
 * Used when a variant 404s to try the next larger size.
 */
export function getPhotoFallbackSize(current: PhotoSize): PhotoSize | null {
  switch (current) {
    case 'sm': return 'md'
    case 'md': return 'lg'
    case 'lg': return null
  }
}
