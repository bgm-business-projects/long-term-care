<script setup lang="ts">
import * as locales from '@nuxt/ui/locale'

const { locale, t } = useI18n()

const uiLocale = computed(() => (locales as Record<string, any>)[locale.value] || locales.en)

useHead({
  htmlAttrs: {
    lang: computed(() => uiLocale.value.code),
    dir: computed(() => uiLocale.value.dir)
  },
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        'name': 'MyApp',
        'url': 'https://myapp.example.com',
        'description': 'Your SaaS platform.',
        'applicationCategory': 'BusinessApplication',
        'operatingSystem': 'Web',
        'offers': {
          '@type': 'AggregateOffer',
          'priceCurrency': 'USD',
          'lowPrice': '0',
          'offerCount': '3'
        },
        'creator': {
          '@type': 'Organization',
          'name': 'MyApp',
          'url': 'https://myapp.example.com',
          'logo': 'https://myapp.example.com/logo.png'
        }
      })
    }
  ]
})

useSeoMeta({
  ogLocale: computed(() => locale.value === 'zh-Hant' ? 'zh_TW' : 'en_US'),
  description: computed(() => t('seo.defaultDescription')),
})
</script>

<template>
  <UApp :locale="uiLocale">
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
