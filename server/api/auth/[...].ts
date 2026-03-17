import { useAuth } from '../../infrastructure/auth/better-auth'

export default defineEventHandler(async (event) => {
  const auth = useAuth()

  // Manually construct Web Request to avoid body stream issues with toWebRequest
  const url = getRequestURL(event)
  const method = event.method
  const headers = getHeaders(event)

  const requestInit: RequestInit = {
    method,
    headers: headers as HeadersInit
  }

  // Read body as UTF-8 string to avoid encoding issues
  if (method !== 'GET' && method !== 'HEAD') {
    const body = await readRawBody(event, 'utf8')
    if (body) {
      requestInit.body = body
    }
  }

  const request = new Request(url.toString(), requestInit)
  return auth.handler(request)
})
