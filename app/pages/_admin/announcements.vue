<script setup lang="ts">
const { api } = useApi()
const toast = useToast()

const announcements = ref<any[]>([])
const loading = ref(false)
const showModal = ref(false)
const editingId = ref<number | null>(null)

const form = reactive({
  title: '',
  body: '',
  expiresAt: '',
})

async function load() {
  loading.value = true
  try {
    announcements.value = await api<any[]>('/api/dispatch/announcements')
  } finally {
    loading.value = false
  }
}

onMounted(load)

function openCreate() {
  editingId.value = null
  Object.assign(form, { title: '', body: '', expiresAt: '' })
  showModal.value = true
}

function openEdit(a: any) {
  editingId.value = a.id
  Object.assign(form, {
    title: a.title,
    body: a.body,
    expiresAt: a.expiresAt ? a.expiresAt.split('T')[0] : '',
  })
  showModal.value = true
}

async function save() {
  const body = {
    title: form.title,
    body: form.body,
    expiresAt: form.expiresAt || null,
  }
  try {
    if (editingId.value) {
      await api(`/api/dispatch/announcements/${editingId.value}`, { method: 'PUT', body })
      toast.add({ title: '公告已更新', color: 'success' })
    } else {
      await api('/api/dispatch/announcements', { method: 'POST', body })
      toast.add({ title: '公告已建立', color: 'success' })
    }
    showModal.value = false
    await load()
  } catch (e: any) {
    toast.add({ title: e?.data?.statusMessage || '儲存失敗', color: 'error' })
  }
}

async function togglePublish(a: any) {
  try {
    if (a.isPublished) {
      await api(`/api/dispatch/announcements/${a.id}`, {
        method: 'PUT',
        body: { title: a.title, body: a.body, isPublished: false },
      })
      toast.add({ title: '已取消發布', color: 'success' })
    } else {
      await api(`/api/dispatch/announcements/${a.id}/publish`, { method: 'POST' })
      toast.add({ title: '已發布公告', color: 'success' })
    }
    await load()
  } catch {
    toast.add({ title: '操作失敗', color: 'error' })
  }
}

async function remove(id: number) {
  if (!confirm('確定要刪除此公告？')) return
  try {
    await api(`/api/dispatch/announcements/${id}`, { method: 'DELETE' })
    toast.add({ title: '公告已刪除', color: 'success' })
    await load()
  } catch {
    toast.add({ title: '刪除失敗', color: 'error' })
  }
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-xl font-bold">公告管理</h1>
      <UButton icon="i-lucide-plus" @click="openCreate">新增公告</UButton>
    </div>

    <div v-if="loading" class="text-center py-12 text-muted">
      <UIcon name="i-lucide-loader-2" class="text-2xl animate-spin" />
    </div>

    <div v-else class="overflow-x-auto border border-default rounded-xl">
      <table class="w-full text-sm">
        <thead class="bg-default/50 border-b border-default">
          <tr>
            <th class="px-3 py-2 text-left">標題</th>
            <th class="px-3 py-2 text-center">發布狀態</th>
            <th class="px-3 py-2 text-left">到期日</th>
            <th class="px-3 py-2 text-left">建立時間</th>
            <th class="px-3 py-2 text-center">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="a in announcements" :key="a.id" class="border-b border-default/50 hover:bg-default/30">
            <td class="px-3 py-2 font-medium">{{ a.title }}</td>
            <td class="px-3 py-2 text-center">
              <UBadge :label="a.isPublished ? '已發布' : '草稿'" :color="a.isPublished ? 'success' : 'neutral'" />
            </td>
            <td class="px-3 py-2">{{ a.expiresAt ? new Date(a.expiresAt).toLocaleDateString('zh-TW') : '—' }}</td>
            <td class="px-3 py-2">{{ new Date(a.createdAt).toLocaleDateString('zh-TW') }}</td>
            <td class="px-3 py-2 text-center">
              <div class="flex items-center justify-center gap-1">
                <UButton size="xs" icon="i-lucide-pencil" variant="ghost" @click="openEdit(a)" />
                <UButton
                  size="xs"
                  :icon="a.isPublished ? 'i-lucide-eye-off' : 'i-lucide-send'"
                  variant="ghost"
                  :color="a.isPublished ? 'warning' : 'success'"
                  :title="a.isPublished ? '取消發布' : '發布'"
                  @click="togglePublish(a)"
                />
                <UButton size="xs" icon="i-lucide-trash-2" variant="ghost" color="error" @click="remove(a.id)" />
              </div>
            </td>
          </tr>
          <tr v-if="announcements.length === 0">
            <td colspan="5" class="px-3 py-8 text-center text-muted">目前沒有公告</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 新增/編輯 Modal -->
    <UModal v-model:open="showModal" :title="editingId ? '編輯公告' : '新增公告'" description=" " size="lg">
      <template #body>
        <div class="p-4 space-y-4">
          <UFormField label="標題">
            <UInput v-model="form.title" placeholder="公告標題" class="w-full" />
          </UFormField>

          <UFormField label="內容">
            <textarea
              v-model="form.body"
              placeholder="公告內容"
              rows="6"
              class="w-full border border-default rounded px-3 py-2 text-sm resize-y"
            />
          </UFormField>

          <UFormField label="到期日（選填）">
            <input
              type="date"
              v-model="form.expiresAt"
              class="border border-default rounded px-3 py-1.5 text-sm w-full"
            />
          </UFormField>

          <div class="flex justify-end gap-2 pt-2">
            <UButton color="neutral" variant="outline" @click="showModal = false">取消</UButton>
            <UButton color="primary" @click="save">儲存</UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
