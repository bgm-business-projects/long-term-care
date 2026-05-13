<script setup lang="ts">
interface MapPoint {
  lat: number
  lng: number
  label: string
  sub?: string
  /** marker 樣式：start = 司機起點、stop = 上車（含順序編號）、dest = 終點 */
  kind: 'start' | 'stop' | 'dest'
  order?: number
}

interface Props {
  open: boolean
  points: MapPoint[]
  title?: string
}

const props = withDefaults(defineProps<Props>(), { title: '路線地圖' })
const emit = defineEmits<{ 'update:open': [value: boolean] }>()

const mapContainer = ref<HTMLElement | null>(null)
const mapRef = ref<any>(null)

async function renderMap() {
  if (!mapContainer.value || props.points.length < 2) return
  const L = (await import('leaflet')).default
  // 確保 CSS 載入（leaflet 的 css 含 marker icon 等）
  if (typeof document !== 'undefined' && !document.getElementById('leaflet-css')) {
    const link = document.createElement('link')
    link.id = 'leaflet-css'
    link.rel = 'stylesheet'
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
    document.head.appendChild(link)
  }

  // 銷毀舊 map
  if (mapRef.value) {
    mapRef.value.remove()
    mapRef.value = null
  }

  const latlngs: [number, number][] = props.points.map(p => [p.lat, p.lng])
  const map = L.map(mapContainer.value as HTMLElement).setView(latlngs[0]!, 13)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19,
  }).addTo(map)

  for (const p of props.points) {
    const html = p.kind === 'start'
      ? '<div class="map-marker map-marker-start">起</div>'
      : p.kind === 'dest'
        ? `<div class="map-marker map-marker-dest">${p.order ?? '終'}</div>`
        : `<div class="map-marker map-marker-stop">${p.order ?? '?'}</div>`
    const icon = L.divIcon({ html, className: 'map-marker-wrap', iconSize: [32, 32], iconAnchor: [16, 16] })
    const marker = L.marker([p.lat, p.lng], { icon }).addTo(map)
    marker.bindPopup(`<b>${p.label}</b>${p.sub ? `<br><small>${p.sub}</small>` : ''}`)
  }

  // 路線連線
  L.polyline(latlngs, { color: '#7c3aed', weight: 4, opacity: 0.8, dashArray: '8 6' }).addTo(map)

  // 自動 fit
  map.fitBounds(L.latLngBounds(latlngs), { padding: [30, 30] })

  mapRef.value = map
}

watch(() => props.open, async (isOpen) => {
  if (isOpen) {
    await nextTick()
    await renderMap()
  } else if (mapRef.value) {
    mapRef.value.remove()
    mapRef.value = null
  }
})

onBeforeUnmount(() => {
  if (mapRef.value) {
    mapRef.value.remove()
    mapRef.value = null
  }
})
</script>

<template>
  <UModal :open="props.open" :title="props.title" description=" " size="xl" @update:open="(v: boolean) => emit('update:open', v)">
    <template #content>
      <div class="p-4 space-y-3">
        <ClientOnly>
          <div ref="mapContainer" class="w-full rounded border border-default" style="height: 60vh" />
          <template #fallback>
            <div class="w-full rounded border border-default flex items-center justify-center text-muted" style="height: 60vh">
              載入地圖中…
            </div>
          </template>
        </ClientOnly>
        <p class="text-xs text-muted">資料來源：OpenStreetMap (© OSM Contributors) · 紫色虛線為司機行進順序</p>
        <div class="flex justify-end">
          <UButton color="neutral" variant="outline" @click="emit('update:open', false)">關閉</UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>

<style>
.map-marker-wrap { background: transparent; border: none; }
.map-marker {
  width: 32px; height: 32px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-weight: bold; font-size: 14px; color: white;
  box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  border: 2px solid white;
}
.map-marker-start { background: #6b7280; }
.map-marker-stop { background: #2563eb; }
.map-marker-dest { background: #16a34a; }
</style>
