import { createAuthClient } from 'better-auth/vue'

export default defineNuxtPlugin(() => {
  const authClient = createAuthClient({
    baseURL: window.location.origin
  })

  return {
    provide: {
      authClient
    }
  }
})
