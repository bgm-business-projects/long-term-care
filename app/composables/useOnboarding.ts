export function useOnboarding() {
  const { user } = useAuth()
  const { api } = useApi()

  const needsOnboarding = computed(() => {
    if (!user.value) return false
    return user.value.onboardingCompletedAt === null
      || user.value.onboardingCompletedAt === undefined
  })

  async function completeOnboarding() {
    await api('/api/onboarding/complete', { method: 'POST' })
    const { fetchSession } = useAuth()
    await fetchSession()
  }

  return { needsOnboarding, completeOnboarding }
}
