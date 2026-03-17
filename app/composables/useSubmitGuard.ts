export function useSubmitGuard() {
  const submitting = ref(false)

  async function guard<T>(fn: () => Promise<T>): Promise<T | undefined> {
    if (submitting.value) return undefined
    submitting.value = true
    try {
      return await fn()
    } finally {
      submitting.value = false
    }
  }

  return { submitting, guard }
}
