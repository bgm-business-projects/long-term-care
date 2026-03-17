import type { PhotoSize } from '~/utils/photo-url'

export interface ImageVariant {
  size: PhotoSize
  maxDimension: number
  quality: number
}

export interface IImageResizer {
  resize(file: File, maxDimension: number, quality: number): Promise<File>
}

/** Standard size tiers for multi-size image generation */
export const SIZE_VARIANTS: ImageVariant[] = [
  { size: 'sm', maxDimension: 128, quality: 0.75 },
  { size: 'md', maxDimension: 480, quality: 0.80 },
  { size: 'lg', maxDimension: 1920, quality: 0.82 },
]
