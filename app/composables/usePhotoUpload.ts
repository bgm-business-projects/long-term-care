import { BrowserImageResizer } from '~/services/BrowserImageResizer'
import { SIZE_VARIANTS } from '~/services/IImageResizer'
import type { PresignBatchResponseDTO } from '~~/server/shared/contracts/file.dto'

const MAX_PHOTOS = 5
const MAX_SIZE_MB = 1
const MAX_DIMENSION = 1920

interface PhotoUploadState {
  urls: string[]
  uploading: boolean
  progress: number
}

const resizer = new BrowserImageResizer()

export function usePhotoUpload() {
  const { api } = useApi()
  const toast = useToast()
  const { t } = useI18n()

  const state = reactive<PhotoUploadState>({
    urls: [],
    uploading: false,
    progress: 0
  })

  function setInitialPhotos(urls: string[]) {
    state.urls = [...urls]
  }

  async function compressImage(file: File): Promise<File> {
    try {
      const mod = await import('browser-image-compression')
      const imageCompression = mod.default ?? mod
      return await imageCompression(file, {
        maxSizeMB: MAX_SIZE_MB,
        maxWidthOrHeight: MAX_DIMENSION,
        initialQuality: 0.82,
        useWebWorker: true
      })
    } catch {
      return file
    }
  }

  async function uploadToStorage(file: File): Promise<string> {
    // Get batch presign URLs for all 3 variants
    const batch = await api<PresignBatchResponseDTO>(
      '/api/files/presign-batch',
      {
        method: 'POST',
        body: { filename: file.name, contentType: file.type },
      }
    )

    // Generate sm and md variants from the lg file
    const [smFile, mdFile] = await Promise.all(
      SIZE_VARIANTS
        .filter(v => v.size !== 'lg')
        .map(v => resizer.resize(file, v.maxDimension, v.quality))
    )

    // Upload all 3 variants in parallel
    const uploads = [
      fetch(batch.variants.lg.uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      }),
      fetch(batch.variants.md.uploadUrl, {
        method: 'PUT',
        body: mdFile,
        headers: { 'Content-Type': 'image/jpeg' },
      }),
      fetch(batch.variants.sm.uploadUrl, {
        method: 'PUT',
        body: smFile,
        headers: { 'Content-Type': 'image/jpeg' },
      }),
    ]

    const results = await Promise.all(uploads)
    const failed = results.find(r => !r.ok)
    if (failed) {
      throw new Error(`Upload failed: ${failed.status}`)
    }

    // Return base (lg) URL — frontend derives sm/md via convention
    return batch.basePublicUrl
  }

  async function addPhotos(files: File[]): Promise<string[]> {
    const remaining = MAX_PHOTOS - state.urls.length
    if (remaining <= 0) return []

    const filesToProcess = files.slice(0, remaining)

    // Phase 1: Crop each file sequentially
    const { cropFile, setQueueProgress } = usePhotoCropper()
    const croppedFiles: File[] = []
    for (let i = 0; i < filesToProcess.length; i++) {
      setQueueProgress(i + 1, filesToProcess.length)
      const cropped = await cropFile(filesToProcess[i]!)
      croppedFiles.push(cropped)
    }

    // Phase 2: Compress + upload (multi-size)
    if (state.uploading) return []
    state.uploading = true
    state.progress = 0

    const newUrls: string[] = []
    try {
      for (let i = 0; i < croppedFiles.length; i++) {
        const compressed = await compressImage(croppedFiles[i]!)
        const url = await uploadToStorage(compressed)
        newUrls.push(url)
        state.urls.push(url)
        state.progress = Math.round(((i + 1) / croppedFiles.length) * 100)
      }
    } catch (err) {
      toast.add({ title: t('photo.uploadError'), color: 'error' })
      throw err
    } finally {
      state.uploading = false
    }
    return newUrls
  }

  function removePhoto(index: number) {
    state.urls.splice(index, 1)
  }

  function reorderPhotos(fromIndex: number, toIndex: number) {
    const [removed] = state.urls.splice(fromIndex, 1)
    if (removed) state.urls.splice(toIndex, 0, removed)
  }

  return {
    photoUrls: computed(() => state.urls),
    uploading: computed(() => state.uploading),
    progress: computed(() => state.progress),
    canAddMore: computed(() => state.urls.length < MAX_PHOTOS),
    maxPhotos: MAX_PHOTOS,
    setInitialPhotos,
    addPhotos,
    removePhoto,
    reorderPhotos
  }
}
