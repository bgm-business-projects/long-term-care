interface DirectionsResponse {
  fallback?: boolean
  url?: string
  status?: string
  routes?: Array<{
    legs: Array<{
      distance?: { text: string; value: number }
      duration?: { text: string; value: number }
    }>
  }>
}

type Coord = { lat: number; lng: number }
type Place = Coord | string

function haversineMeters(a: Coord, b: Coord): number {
  const R = 6371000 // 地球半徑 (公尺)
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const sinLat = Math.sin(dLat / 2)
  const sinLng = Math.sin(dLng / 2)
  const h = sinLat * sinLat + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

function formatKm(meters: number): string {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} 公里` : `${Math.round(meters)} 公尺`
}

export function useDistance() {
  const { api } = useApi()

  async function fetchDistanceMeters(
    origin: Place,
    destination: Place,
  ): Promise<{ meters: number; text: string; durationSec?: number; durationText?: string; estimated?: boolean } | null> {
    const o = typeof origin === 'string' ? origin : `${origin.lat},${origin.lng}`
    const d = typeof destination === 'string' ? destination : `${destination.lat},${destination.lng}`

    try {
      const res = await api<DirectionsResponse>(`/api/maps/directions?origin=${encodeURIComponent(o)}&destination=${encodeURIComponent(d)}`)

      if (!res.fallback) {
        const leg = res.routes?.[0]?.legs?.[0]
        if (leg?.distance) {
          return {
            meters: leg.distance.value,
            text: leg.distance.text,
            durationSec: leg.duration?.value,
            durationText: leg.duration?.text,
          }
        }
      }
    } catch {
      // 繼續走 fallback
    }

    // Fallback：未設 Google Maps API Key 或 API 失敗，當座標都有時用 Haversine 直線估算
    if (typeof origin !== 'string' && typeof destination !== 'string') {
      const meters = haversineMeters(origin, destination)
      return {
        meters,
        text: `${formatKm(meters)}（直線估算）`,
        estimated: true,
      }
    }

    return null
  }

  return { fetchDistanceMeters }
}
