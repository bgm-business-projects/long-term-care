interface TierChangeInfo {
  oldTier: string
  newTier: string
  direction: 'upgrade' | 'downgrade'
}

const showTierChangeModal = ref(false)
const tierChangeInfo = ref<TierChangeInfo | null>(null)

export function useTierChangeModal() {
  const { api } = useApi()

  function openTierChangeModal(info: TierChangeInfo) {
    tierChangeInfo.value = info
    showTierChangeModal.value = true
  }

  function closeTierChangeModal() {
    showTierChangeModal.value = false
    tierChangeInfo.value = null
  }

  async function acknowledgeTierChange() {
    try {
      await api('/api/subscription/tier-notification/acknowledge', { method: 'POST' })
    } catch {
      // Silently fail — next load will re-detect
    }
    closeTierChangeModal()
  }

  return {
    showTierChangeModal,
    tierChangeInfo,
    openTierChangeModal,
    closeTierChangeModal,
    acknowledgeTierChange,
  }
}
