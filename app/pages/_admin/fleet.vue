<script setup lang="ts">
const { api } = useApi()
const positions = ref<any[]>([])
const mapContainer = ref<HTMLElement | null>(null)
let map: any = null
let markers: any[] = []

async function loadPositions() {
  try {
    positions.value = await api<any[]>('/api/dispatch/fleet/positions')
    updateMarkers()
  } catch (e) {}
}

onMounted(async () => {
  // 動態載入 Leaflet（OpenStreetMap，開源免費）
  const L = await import('leaflet')
  await import('leaflet/dist/leaflet.css')

  map = L.map(mapContainer.value!).setView([25.033, 121.565], 12)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(map)

  await loadPositions()
})

function updateMarkers() {
  markers.forEach(m => m.remove())
  markers = []

  if (!map) return
  const L = (window as any).L
  if (!L) return

  positions.value.forEach(pos => {
    if (!pos.lat || !pos.lng) return
    const marker = L.marker([Number(pos.lat), Number(pos.lng)])
      .addTo(map)
      .bindPopup(`
        <b>${pos.plate}</b><br>
        司機：${pos.driver_name || '未知'}<br>
        狀態：${pos.last_status}<br>
        更新：${pos.last_update ? new Date(pos.last_update).toLocaleTimeString('zh-TW') : '—'}
      `)
    markers.push(marker)
  })
}

// 30 秒自動刷新
const refreshInterval = setInterval(loadPositions, 30000)
onUnmounted(() => clearInterval(refreshInterval))
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-xl font-bold">車隊即時動態</h1>
      <div class="flex items-center gap-2">
        <span class="text-xs text-muted">每 30 秒自動更新</span>
        <UButton size="sm" icon="i-lucide-refresh-cw" variant="outline" @click="loadPositions">
          立即更新
        </UButton>
      </div>
    </div>
    <div ref="mapContainer" class="w-full h-[calc(100vh-200px)] rounded-xl border border-default" />
  </div>
</template>
