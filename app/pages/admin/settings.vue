<script setup lang="ts">
const { api } = useApi()
const toast = useToast()
const settings = ref<any[]>([])
const googleMapsKey = ref('')
const saving = ref(false)

onMounted(async () => {
  settings.value = await api<any[]>('/api/admin/settings')
  const gmSetting = settings.value.find(s => s.key === 'google_maps_api_key')
  googleMapsKey.value = gmSetting?.hasValue ? '' : ''  // 不顯示現有值
})

async function saveGoogleMapsKey() {
  if (!googleMapsKey.value.trim()) return
  saving.value = true
  try {
    await api('/api/admin/settings', { method: 'POST', body: { key: 'google_maps_api_key', value: googleMapsKey.value.trim() } })
    toast.add({ title: 'Google Maps Key 已儲存', color: 'success' })
    googleMapsKey.value = ''
    settings.value = await api<any[]>('/api/admin/settings')
  } catch {
    toast.add({ title: '儲存失敗', color: 'error' })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="max-w-2xl space-y-6">
    <h1 class="text-xl font-bold">系統設定</h1>
    <div class="border border-default rounded-xl p-4 space-y-4">
      <h2 class="font-semibold">地圖設定</h2>
      <div class="space-y-2">
        <div class="flex items-center gap-2">
          <span class="text-sm text-muted">Google Maps API Key：</span>
          <UBadge :label="settings.find(s=>s.key==='google_maps_api_key')?.hasValue ? '已設定 ✓' : '未設定（使用 OpenStreetMap）'"
                  :color="settings.find(s=>s.key==='google_maps_api_key')?.hasValue ? 'success' : 'warning'" />
        </div>
        <p class="text-xs text-muted">設定後啟用 Google Maps 路線規劃（Directions API），未設定時自動使用 OpenStreetMap。</p>
        <div class="flex gap-2">
          <UInput v-model="googleMapsKey" type="password" placeholder="輸入新的 API Key..." class="flex-1" />
          <UButton @click="saveGoogleMapsKey" :loading="saving" :disabled="!googleMapsKey.trim()">儲存</UButton>
        </div>
      </div>
    </div>
  </div>
</template>
