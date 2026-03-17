export interface CropOptions {
  aspectRatio: number
  minWidth?: number
  minHeight?: number
  autoCropIfSkipped: boolean
}

export interface CropQueueState {
  currentFile: File | null
  currentIndex: number
  totalImages: number
  isProcessing: boolean
}
