<script setup lang="ts">
const { locale, setLocale } = useI18n()

function toggle() {
  setLocale(locale.value === 'en' ? 'zh-Hant' : 'en')
}

const label = computed(() => locale.value === 'en' ? '中' : 'EN')
</script>

<template>
  <UButton
    :label="label"
    color="neutral"
    variant="ghost"
    size="sm"
    @click="toggle"
  />
</template>
