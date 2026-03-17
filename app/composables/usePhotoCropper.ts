import type { CropOptions, CropQueueState } from '~/types/photo-crop'
import { autoCropCenter } from '~/utils/image-crop-adapter'

const DEFAULT_OPTIONS: CropOptions = {
  aspectRatio: 1,
  autoCropIfSkipped: true,
}

// Shared state (global singleton like other modals in the project)
const isOpen = ref(false)
const imageUrl = ref('')
const queueState = reactive<CropQueueState>({
  currentFile: null,
  currentIndex: 0,
  totalImages: 0,
  isProcessing: false,
})
const currentOptions = ref<CropOptions>({ ...DEFAULT_OPTIONS })

// Promise resolve callback for the current crop operation
let resolveCrop: ((file: File) => void) | null = null

export function usePhotoCropper() {
  /**
   * Command: Open crop modal for a single file.
   * Always resolves with a File (manual crop or auto center-crop).
   */
  function cropFile(file: File, options?: Partial<CropOptions>): Promise<File> {
    currentOptions.value = { ...DEFAULT_OPTIONS, ...options }

    return new Promise<File>((resolve) => {
      resolveCrop = resolve
      queueState.currentFile = file
      imageUrl.value = URL.createObjectURL(file)
      isOpen.value = true
    })
  }

  /**
   * Command: Set queue progress info (called by usePhotoUpload).
   */
  function setQueueProgress(current: number, total: number) {
    queueState.currentIndex = current
    queueState.totalImages = total
  }

  /**
   * Command: User confirmed manual crop → canvas to File → resolve.
   */
  async function confirmCrop(canvas: HTMLCanvasElement) {
    if (!resolveCrop || !queueState.currentFile) return
    queueState.isProcessing = true

    try {
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('Canvas toBlob failed'))),
          queueState.currentFile!.type || 'image/jpeg',
          0.85
        )
      })

      const croppedFile = new File(
        [blob],
        queueState.currentFile!.name,
        { type: blob.type, lastModified: Date.now() }
      )

      cleanup()
      resolveCrop(croppedFile)
      resolveCrop = null
    } catch {
      // Fallback to auto crop on error
      await skipCrop()
    } finally {
      queueState.isProcessing = false
    }
  }

  /**
   * Command: User skipped manual crop → auto center-crop → resolve.
   */
  async function skipCrop() {
    if (!resolveCrop || !queueState.currentFile) return
    queueState.isProcessing = true

    try {
      const cropped = await autoCropCenter(
        queueState.currentFile,
        currentOptions.value.aspectRatio
      )
      cleanup()
      resolveCrop(cropped)
      resolveCrop = null
    } catch {
      // Last resort: resolve with original file
      const file = queueState.currentFile!
      cleanup()
      resolveCrop!(file)
      resolveCrop = null
    } finally {
      queueState.isProcessing = false
    }
  }

  function cleanup() {
    if (imageUrl.value) {
      URL.revokeObjectURL(imageUrl.value)
      imageUrl.value = ''
    }
    isOpen.value = false
    queueState.currentFile = null
  }

  // Query (read-only computed)
  return {
    // Commands
    cropFile,
    setQueueProgress,
    confirmCrop,
    skipCrop,
    // Queries
    isOpen: computed(() => isOpen.value),
    imageUrl: computed(() => imageUrl.value),
    aspectRatio: computed(() => currentOptions.value.aspectRatio),
    queueCurrent: computed(() => queueState.currentIndex),
    queueTotal: computed(() => queueState.totalImages),
    isProcessing: computed(() => queueState.isProcessing),
  }
}
