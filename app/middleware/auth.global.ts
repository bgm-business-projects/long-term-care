const publicPaths = ['/', '/forgot-password', '/reset-password', '/verify-email', '/admin/login', '/agency/login', '/driver/login']

export default defineNuxtRouteMiddleware(async (to) => {
  const { user, loading, fetchSession } = useAuth()

  // ── Public auth pages ──
  if (publicPaths.includes(to.path)) {
    if (user.value) {
      const role = (user.value as any).role ?? ''
      if (to.path === '/admin/login') return navigateTo('/admin')
      if (to.path === '/agency/login') return navigateTo('/agency')
      if (to.path === '/driver/login') return navigateTo('/driver')
      const { getSafeRedirectUrl } = useRedirectService()
      return navigateTo(getSafeRedirectUrl(to.query.redirect))
    }
    return
  }

  if (loading.value && !user.value) {
    await fetchSession()
  }

  // Not logged in — redirect to context-appropriate login
  if (!user.value) {
    if (to.path.startsWith('/admin')) return navigateTo('/admin/login')
    if (to.path.startsWith('/agency')) return navigateTo('/agency/login')
    if (to.path.startsWith('/driver')) return navigateTo('/driver/login')
    return navigateTo('/')
  }

  // Consent gate
  if (!user.value.consentAcceptedAt && to.path !== '/consent') {
    return navigateTo('/consent')
  }
  if (user.value.consentAcceptedAt && to.path === '/consent') {
    return navigateTo('/')
  }

  // Route guards
  if (to.path.startsWith('/admin') && !['admin', 'developer'].includes(user.value.role as string)) {
    return navigateTo('/admin/login')
  }
  if (to.path.startsWith('/agency') && !['agency_staff', 'admin', 'developer'].includes(user.value.role as string)) {
    return navigateTo('/agency/login')
  }
  if (to.path.startsWith('/_admin') && !['admin', 'developer'].includes(user.value.role as string)) {
    return navigateTo('/')
  }
  if (to.path.startsWith('/driver') && !['driver', 'admin', 'developer'].includes(user.value.role as string)) {
    return navigateTo('/driver/login')
  }
})
