export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: true },
  ssr: false,

  modules: ['@nuxt/ui', '@nuxtjs/i18n', '@nuxt/fonts'],
  css: ['~/assets/css/main.css'],

  colorMode: {
    preference: 'light'
  },

  experimental: {
    payloadExtraction: false
  },

  future: {
    compatibilityVersion: 4
  },

  runtimeConfig: {
    databaseUrl: '',
    betterAuth: {
      secret: '',
      url: ''
    },
    google: {
      clientId: '',
      clientSecret: ''
    },
    resend: {
      apiKey: '',
      fromEmail: ''
    },
    r2: {
      endpoint: '',
      accessKeyId: '',
      secretAccessKey: '',
      bucketName: '',
      publicUrl: ''
    }
  },

  routeRules: {
    // ── Prerender SPA entry（CDN 靜態，零 cold start）──
    '/': { prerender: true },
  },

  nitro: {
    preset: process.env.NITRO_PRESET || 'vercel'
  },

  vite: {
    optimizeDeps: {
      include: [
        '@vue/devtools-core',
        '@vue/devtools-kit',
        'better-auth/vue',
      ]
    }
  },

  i18n: {
    locales: [
      { code: 'en', language: 'en-US', name: 'English', file: 'en.json' },
      { code: 'zh-Hant', language: 'zh-Hant', name: '繁體中文', file: 'zh-Hant.json' }
    ],
    defaultLocale: 'en',
    langDir: 'locales',
    strategy: 'no_prefix',
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'i18n_locale',
      fallbackLocale: 'en'
    }
  },

  devServer: {
    port: 3000
  },

  app: {
    head: {
      title: 'MyApp',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'apple-mobile-web-app-title', content: 'MyApp' },
        { name: 'description', content: 'Your SaaS platform.' },
        { property: 'og:title', content: 'MyApp' },
        { property: 'og:description', content: 'Your SaaS platform.' },
        { property: 'og:site_name', content: 'MyApp' },
        { property: 'og:type', content: 'website' },
        { property: 'og:url', content: 'https://myapp.example.com' },
        { property: 'og:image', content: 'https://myapp.example.com/og.png' },
        { property: 'og:image:width', content: '1200' },
        { property: 'og:image:height', content: '630' },
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:title', content: 'MyApp' },
        { name: 'twitter:description', content: 'Your SaaS platform.' },
        { name: 'twitter:image', content: 'https://myapp.example.com/og.png' },
        { name: 'theme-color', content: '#6F4E37' },
      ],
      script: [
        { src: 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5033254747565204', async: true, crossorigin: 'anonymous', tagPosition: 'bodyClose' }
      ],
      link: [
        { rel: 'icon', type: 'image/png', href: '/favicon-96x96.png', sizes: '96x96' },
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'shortcut icon', href: '/favicon.ico' },
        { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' },
        { rel: 'manifest', href: '/site.webmanifest' },
      ]
    }
  }
})
