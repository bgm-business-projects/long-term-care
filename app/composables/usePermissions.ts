export function usePermissions() {
  const { user } = useAuth()
  const isDeveloper = computed(() => user.value?.role === 'developer')
  const isAdminOrAbove = computed(() => !!user.value?.role && ['admin', 'developer'].includes(user.value.role))
  const canChangeRole = computed(() => isDeveloper.value)
  return { isDeveloper, isAdminOrAbove, canChangeRole }
}
