const publicPaths = ['/login', '/forgot-password', '/reset-password', '/verify-email']

export default defineNuxtRouteMiddleware(async (to) => {
  const { user, loading, fetchSession } = useAuth()

  // ── Public auth pages — render immediately, no session fetch needed ──
  if (publicPaths.includes(to.path)) {
    // Already known logged in → redirect away (preserve redirect param)
    if (user.value) {
      const { getSafeRedirectUrl } = useRedirectService()
      return navigateTo(getSafeRedirectUrl(to.query.redirect))
    }
    // Don't await fetchSession — let the page render instantly
    return
  }

  if (loading.value && !user.value) {
    await fetchSession()
  }

  // ── Normal Auth Flow ──

  // Not logged in — redirect to login
  if (!user.value) {
    return navigateTo('/login')
  }

  // Consent gate — must accept before using the app
  if (!user.value.consentAcceptedAt && to.path !== '/consent') {
    return navigateTo('/consent')
  }

  // Already consented — redirect away from consent page
  if (user.value.consentAcceptedAt && to.path === '/consent') {
    return navigateTo('/')
  }

  // Admin route guard
  if (to.path.startsWith('/admin') && !['admin', 'developer'].includes(user.value.role as string)) {
    return navigateTo('/')
  }

  // Driver route guard
  if (to.path.startsWith('/driver') && !['driver', 'admin', 'developer'].includes(user.value.role as string)) {
    return navigateTo('/')
  }
})
