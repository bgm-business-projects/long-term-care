<script setup lang="ts">
interface MapPoint {
  lat: number
  lng: number
  label: string
  sub?: string
  kind: 'start' | 'stop' | 'dest'
  order?: number
}

interface Props {
  points: MapPoint[]
  open: boolean
  height?: string
}

const props = withDefaults(defineProps<Props>(), { height: '50vh' })

const mapContainer = ref<HTMLElement | null>(null)
let mapRef: any = null

async function renderMap() {
  if (!mapContainer.value || props.points.length < 2) return
  const L = (await import('leaflet')).default
  if (typeof document !== 'undefined' && !document.getElementById('leaflet-css')) {
    const link = document.createElement('link')
    link.id = 'leaflet-css'
    link.rel = 'stylesheet'
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
    document.head.appendChild(link)
    // 等 CSS 載入完成（避免 leaflet 容器尺寸算錯）
    await new Promise<void>(resolve => {
      link.onload = () => resolve()
      setTimeout(resolve, 800) // 保險 timeout
    })
  }
  if (mapRef) { mapRef.remove(); mapRef = null }

  const latlngs: [number, number][] = props.points.map(p => [p.lat, p.lng])
  const map = L.map(mapContainer.value as HTMLElement).setView(latlngs[0]!, 13)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19,
    crossOrigin: true as any,
  }).addTo(map)

  for (let i = 0; i < props.points.length; i++) {
    const p = props.points[i]!
    const labelText = p.kind === 'start' ? '起' : p.kind === 'dest' ? (p.order ?? '終') : (p.order ?? i)
    const bg = p.kind === 'start' ? '#6b7280' : p.kind === 'dest' ? '#16a34a' : '#2563eb'
    const html = `<div class="rmap-marker" style="background:${bg}">${labelText}</div>`
    const icon = L.divIcon({ html, className: 'rmap-marker-wrap', iconSize: [30, 30], iconAnchor: [15, 15] })
    const marker = L.marker([p.lat, p.lng], { icon }).addTo(map)
    marker.bindPopup(`<b>${p.label}</b>${p.sub ? `<br><small>${p.sub}</small>` : ''}`)
  }

  L.polyline(latlngs, { color: '#7c3aed', weight: 4, opacity: 0.85, dashArray: '8 6' }).addTo(map)
  map.fitBounds(L.latLngBounds(latlngs), { padding: [30, 30] })
  mapRef = map

  // Modal 動畫結束、容器尺寸定型後重新計算
  setTimeout(() => { try { map.invalidateSize() } catch {} }, 250)
  setTimeout(() => { try { map.invalidateSize() } catch {} }, 600)
}

watch(() => [props.open, props.points], async ([isOpen]) => {
  if (isOpen) {
    // 等 modal 開啟動畫
    await new Promise(resolve => setTimeout(resolve, 100))
    await nextTick()
    await renderMap()
  } else if (mapRef) {
    mapRef.remove()
    mapRef = null
  }
}, { deep: true, immediate: true })

onBeforeUnmount(() => {
  if (mapRef) { mapRef.remove(); mapRef = null }
})
</script>

<template>
  <ClientOnly>
    <div ref="mapContainer" class="w-full rounded border border-default" :style="`height: ${height}`" />
    <template #fallback>
      <div class="w-full rounded border border-default flex items-center justify-center text-muted" :style="`height: ${height}`">
        載入地圖中…
      </div>
    </template>
  </ClientOnly>
</template>

<style>
.rmap-marker-wrap { background: transparent; border: none; }
.rmap-marker {
  width: 30px; height: 30px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-weight: bold; font-size: 13px; color: white;
  box-shadow: 0 2px 6px rgba(0,0,0,0.3);
  border: 2px solid white;
}
</style>
