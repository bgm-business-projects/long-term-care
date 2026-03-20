export default defineNuxtRouteMiddleware((to) => {
  if (to.path.startsWith('/admin') && to.path !== '/admin/login') {
    setPageLayout('admin-panel')
  }
  if (to.path.startsWith('/agency') && to.path !== '/agency/login') {
    setPageLayout('agency-panel')
  }
})
