export function useDisplayPagination<T>(source: Ref<T[]>, pageSize: number = 20) {
  const displayCount = ref(pageSize)

  const displayedItems = computed(() => source.value.slice(0, displayCount.value))
  const hasMore = computed(() => displayCount.value < source.value.length)

  function showMore() {
    displayCount.value += pageSize
  }

  // Reset to first page when source changes
  watch(source, () => {
    displayCount.value = pageSize
  })

  return { displayedItems, hasMore, showMore }
}
