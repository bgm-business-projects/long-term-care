import { createCachedQuery } from '~/core/cache/createCachedQuery'
import { onClientEvent } from '~/core/events/ClientEventBus'
import { CacheEvents } from '~/core/events/CacheEvents'
import { TIER_PRIORITY, type SubscriptionTier } from '~~/shared/domain/subscription'

function toMs(value: string | number): number {
  if (typeof value === 'string') return new Date(value).getTime()
  // If > 1e12, already milliseconds; otherwise seconds
  return value > 1e12 ? value : value * 1000
}

function getEffectiveTier(tier: string | undefined, expiresAt: string | number | null | undefined): SubscriptionTier {
  const t = (tier ?? 'free') as SubscriptionTier
  if (!(t in TIER_PRIORITY)) return 'free'
  if (t === 'free') return 'free'
  if (expiresAt === null || expiresAt === undefined) return t // permanent
  if (toMs(expiresAt) > Date.now()) return t
  return 'free' // expired
}

// Tier change notification payload (stored for deferred modal)
let pendingTierNotification: { oldTier: string; newTier: string; direction: 'upgrade' | 'downgrade' } | null = null

const subscriptionCache = createCachedQuery<{ tierNotification?: { oldTier: string; newTier: string; direction: 'upgrade' | 'downgrade' } | null }>(
  'subscription',
  async () => {
    const { api } = useApi()
    const data = await api<{
      tierNotification?: { oldTier: string; newTier: string; direction: 'upgrade' | 'downgrade' }
    }>('/api/subscription')
    return {
      tierNotification: data.tierNotification ?? null
    }
  },
  {
    ttl: 60_000,
    initial: { tierNotification: null },
    persist: true,
  }
)

if (import.meta.client) {
  onClientEvent(CacheEvents.SubscriptionChanged, () => subscriptionCache.invalidate())
}

export function useSubscription() {
  const { user } = useAuth()
  const { api } = useApi()

  const tier = computed<SubscriptionTier>(() => {
    if (!user.value) return 'free'
    return getEffectiveTier(user.value.subscriptionTier, user.value.subscriptionExpiresAt)
  })

  async function fetchSubscriptionState(force?: boolean) {
    await subscriptionCache.load(force)
    const cached = subscriptionCache.data.value

    // Trigger tier change modal if notification present
    if (cached.tierNotification) {
      const { openTierChangeModal } = useTierChangeModal()
      openTierChangeModal(cached.tierNotification)
    }
  }

  const isExpired = computed(() => {
    if (!user.value) return false
    const rawTier = user.value.subscriptionTier ?? 'free'
    if (rawTier === 'free') return false
    return tier.value === 'free' && rawTier !== 'free'
  })

  const isPermanent = computed(() => {
    if (tier.value === 'free') return false
    return user.value?.subscriptionExpiresAt === null || user.value?.subscriptionExpiresAt === undefined
  })

  async function previewCode(code: string) {
    return api<{ status: 'available' | 'used' | 'disabled' | 'invalid'; tier?: string; durationDays?: number | null }>(
      '/api/subscription/redeem-preview',
      { params: { code } }
    )
  }

  async function redeem(code: string, force = false) {
    const result = await api<any>('/api/subscription/redeem', {
      method: 'POST',
      body: { code, force },
    })
    // Refresh user session to get updated subscription fields
    const { fetchSession } = useAuth()
    await fetchSession()
    subscriptionCache.invalidate()
    return result
  }

  return {
    tier,
    isExpired,
    isPermanent,
    fetchSubscriptionState,
    previewCode,
    redeem,
  }
}
