import type { IImageResizer } from './IImageResizer'

export class BrowserImageResizer implements IImageResizer {
  async resize(file: File, maxDimension: number, quality: number): Promise<File> {
    const bitmap = await createImageBitmap(file)
    const { width, height } = bitmap

    // Calculate target dimensions maintaining aspect ratio
    let targetW = width
    let targetH = height
    if (width > maxDimension || height > maxDimension) {
      const scale = maxDimension / Math.max(width, height)
      targetW = Math.round(width * scale)
      targetH = Math.round(height * scale)
    }

    const canvas = new OffscreenCanvas(targetW, targetH)
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(bitmap, 0, 0, targetW, targetH)
    bitmap.close()

    const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality })
    return new File([blob], file.name, { type: 'image/jpeg' })
  }
}
