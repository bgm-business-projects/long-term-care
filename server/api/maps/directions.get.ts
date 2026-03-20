import { requireAdmin } from '../../utils/requireAdmin'
import { getGoogleMapsKey } from '../../utils/getGoogleMapsKey'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const { origin, destination, waypoints } = getQuery(event)

  if (!origin || !destination) {
    throw createError({ statusCode: 400, statusMessage: '缺少 origin 或 destination' })
  }

  const apiKey = await getGoogleMapsKey()

  // 無 API Key → 回傳降級資訊，讓前端開新分頁
  if (!apiKey) {
    return {
      fallback: true,
      url: `https://maps.google.com/maps/dir/${encodeURIComponent(String(origin))}/${encodeURIComponent(String(destination))}`,
    }
  }

  const params = new URLSearchParams({
    origin: String(origin),
    destination: String(destination),
    mode: 'driving',
    language: 'zh-TW',
    region: 'TW',
    key: apiKey,
    ...(waypoints && { waypoints: String(waypoints) }),
  })

  const response = await $fetch<{
    status: string
    routes: Array<{
      overview_polyline: { points: string }
      legs: Array<{
        distance: { text: string; value: number }
        duration: { text: string; value: number }
        steps: Array<{
          html_instructions: string
          distance: { text: string; value: number }
          duration: { text: string; value: number }
        }>
      }>
    }>
  }>(
    `https://maps.googleapis.com/maps/api/directions/json?${params}`
  )

  if (response.status !== 'OK') {
    return {
      fallback: true,
      url: `https://maps.google.com/maps/dir/${encodeURIComponent(String(origin))}/${encodeURIComponent(String(destination))}`,
      error: response.status,
    }
  }

  const leg = response.routes[0].legs[0]
  return {
    fallback: false,
    distance: leg.distance,
    duration: leg.duration,
    polyline: response.routes[0].overview_polyline.points,
    steps: leg.steps.map(s => ({
      instruction: s.html_instructions,
      distance: s.distance,
      duration: s.duration,
    })),
  }
})
