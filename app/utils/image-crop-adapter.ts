/**
 * ACL (Anti-Corruption Layer): Pure Canvas-based center crop.
 * No dependency on vue-advanced-cropper or any UI framework.
 */
export async function autoCropCenter(file: File, aspectRatio: number = 1): Promise<File> {
  const bitmap = await createImageBitmap(file)

  try {
    const { width: srcW, height: srcH } = bitmap
    const srcAspect = srcW / srcH

    let cropW: number
    let cropH: number

    if (srcAspect > aspectRatio) {
      // Source is wider → crop width
      cropH = srcH
      cropW = Math.round(srcH * aspectRatio)
    } else {
      // Source is taller → crop height
      cropW = srcW
      cropH = Math.round(srcW / aspectRatio)
    }

    const offsetX = Math.round((srcW - cropW) / 2)
    const offsetY = Math.round((srcH - cropH) / 2)

    const canvas = document.createElement('canvas')
    canvas.width = cropW
    canvas.height = cropH

    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D context unavailable')

    ctx.drawImage(bitmap, offsetX, offsetY, cropW, cropH, 0, 0, cropW, cropH)

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Canvas toBlob failed'))),
        file.type || 'image/jpeg',
        0.85
      )
    })

    // Cleanup
    canvas.width = 0
    canvas.height = 0

    return new File([blob], file.name, { type: blob.type, lastModified: Date.now() })
  } finally {
    bitmap.close()
  }
}
