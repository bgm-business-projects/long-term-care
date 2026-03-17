export function useApi() {
  async function api<T>(url: string, fetchOptions?: Parameters<typeof $fetch>[1]): Promise<T> {
    try {
      const res = await $fetch<T>(url, {
        ...fetchOptions,
        credentials: 'include'
      })
      return res as T
    } catch (err: any) {
      if (err?.statusCode === 401) {
        const { getLoginUrlWithReturn } = useRedirectService()
        navigateTo(getLoginUrlWithReturn())
        throw err
      }
      if (err?.statusCode === 403 && err?.data?.statusMessage === 'ACCOUNT_BANNED') {
        const { signOut } = useAuth()
        await signOut()
        throw err
      }
      throw err
    }
  }

  return { api }
}
