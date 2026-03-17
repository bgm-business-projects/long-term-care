import { clearSWRCache } from '~/core/cache/clearSWRCache'

export function useAuth() {
  const { $authClient } = useNuxtApp()
  const authClient = $authClient as ReturnType<typeof import('better-auth/vue').createAuthClient>

  const user = useState<{
    id: string
    name: string
    email: string
    image?: string | null
    role?: string
    subscriptionTier?: string
    subscriptionExpiresAt?: string | number | null
    consentAcceptedAt?: number | null
    onboardingCompletedAt?: number | null
  } | null>('auth-user', () => null)
  const loading = useState('auth-loading', () => true)

  async function fetchSession() {
    try {
      loading.value = true
      const { data } = await authClient.getSession()
      user.value = data?.user ?? null
    } catch {
      user.value = null
    } finally {
      loading.value = false
    }
  }

  async function signUpWithEmail(name: string, email: string, password: string) {
    const { data, error } = await authClient.signUp.email({
      name,
      email,
      password
    })
    if (error) throw normalizeAuthError(error)
    clearSWRCache()
    user.value = data?.user ?? null
    return data
  }

  async function signInWithEmail(email: string, password: string) {
    const { data, error } = await authClient.signIn.email({
      email,
      password
    })
    if (error) throw normalizeAuthError(error)
    clearSWRCache()
    user.value = data?.user ?? null
    return data
  }

  async function signInWithGoogle(callbackURL?: string) {
    await authClient.signIn.social({
      provider: 'google',
      callbackURL: callbackURL || '/'
    })
  }

  async function signOut() {
    await authClient.signOut()
    clearSWRCache()
    user.value = null
    navigateTo('/login')
  }

  async function forgetPassword(email: string) {
    const { error } = await authClient.requestPasswordReset({
      email,
      redirectTo: '/reset-password'
    })
    if (error) throw normalizeAuthError(error)
  }

  async function resetPassword(token: string, newPassword: string) {
    const { error } = await authClient.resetPassword({
      newPassword,
      token
    })
    if (error) throw normalizeAuthError(error)
  }

  async function verifyEmail(token: string) {
    const { error } = await authClient.verifyEmail({
      query: { token }
    })
    if (error) throw normalizeAuthError(error)
  }

  async function updateUser({ name }: { name: string }) {
    const { data, error } = await authClient.updateUser({ name })
    if (error) throw normalizeAuthError(error)
    if (user.value) {
      user.value = { ...user.value, name }
    }
    return data
  }

  async function changePassword(currentPassword: string, newPassword: string) {
    const { error } = await authClient.changePassword({
      currentPassword,
      newPassword
    })
    if (error) throw normalizeAuthError(error)
  }

  return {
    user: readonly(user),
    loading: readonly(loading),
    fetchSession,
    signUpWithEmail,
    signInWithEmail,
    signInWithGoogle,
    signOut,
    forgetPassword,
    resetPassword,
    verifyEmail,
    updateUser,
    changePassword
  }
}

function normalizeAuthError(error: any): { code: string; status?: number; message?: string } {
  const status = error?.status || error?.statusCode
  const message = error?.message || ''
  const code = error?.code || ''

  if (status === 401 || code === 'INVALID_PASSWORD' || code === 'USER_NOT_FOUND') {
    return { code: 'INVALID_CREDENTIALS', status, message }
  }
  if (status === 422 || code === 'USER_ALREADY_EXISTS' || message.includes('already')) {
    return { code: 'EMAIL_EXISTS', status, message }
  }
  if (code === 'PASSWORD_TOO_SHORT' || message.includes('password') && message.includes('short')) {
    return { code: 'PASSWORD_TOO_SHORT', status, message }
  }
  if (code === 'INVALID_EMAIL' || code === 'INVALID_EMAIL_OR_PASSWORD') {
    return { code: 'INVALID_EMAIL', status, message }
  }
  if (code === 'INVALID_TOKEN' || message.includes('invalid') && message.includes('token')) {
    return { code: 'INVALID_TOKEN', status, message }
  }
  if (code === 'TOKEN_EXPIRED' || message.includes('expired')) {
    return { code: 'TOKEN_EXPIRED', status, message }
  }

  return { code: 'GENERIC', status, message }
}
