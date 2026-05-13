interface PresignResponse {
  uploadUrl: string
  publicUrl: string
}

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'] as const

// 單張文件上傳（身分證/行照/車輛照片）。回傳 publicUrl。
export function useFileUploader() {
  const { api } = useApi()

  async function compress(file: File): Promise<File> {
    if (!file.type.startsWith('image/')) return file
    try {
      const mod = await import('browser-image-compression')
      const imageCompression = mod.default ?? mod
      return await imageCompression(file, {
        maxSizeMB: 1.5,
        maxWidthOrHeight: 1920,
        initialQuality: 0.85,
        useWebWorker: true,
      })
    } catch {
      return file
    }
  }

  async function uploadOne(file: File): Promise<string> {
    if (!ACCEPTED.includes(file.type as typeof ACCEPTED[number])) {
      throw new Error('僅接受 JPG / PNG / WebP / HEIC 圖檔')
    }
    const compressed = await compress(file)
    const presign = await api<PresignResponse>('/api/files/presign', {
      method: 'POST',
      body: { filename: file.name, contentType: file.type },
    })
    const res = await fetch(presign.uploadUrl, {
      method: 'PUT',
      body: compressed,
      headers: { 'Content-Type': file.type },
    })
    if (!res.ok) throw new Error(`上傳失敗 (${res.status})`)
    return presign.publicUrl
  }

  return { uploadOne }
}
