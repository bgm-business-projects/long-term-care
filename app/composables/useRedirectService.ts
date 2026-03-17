export function useRedirectService() {
  const route = useRoute()

  /** 產生帶有 redirect 參數的登入 URL */
  function getLoginUrlWithReturn(fallbackPath = '/'): string {
    const currentPath = route.fullPath
    if (currentPath.startsWith('/login')) return '/login'
    return `/login?redirect=${encodeURIComponent(currentPath)}`
  }

  /** 安全驗證 redirect 參數，防止 open redirect */
  function getSafeRedirectUrl(
    queryRedirect?: string | (string | null)[] | string | null,
    fallbackPath = '/'
  ): string {
    const raw = Array.isArray(queryRedirect) ? queryRedirect[0] : queryRedirect
    const path = raw ?? null
    if (path && path.startsWith('/') && !path.startsWith('//')) {
      return path
    }
    return fallbackPath
  }

  return { getLoginUrlWithReturn, getSafeRedirectUrl }
}
