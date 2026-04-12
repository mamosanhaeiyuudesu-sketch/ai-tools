import { defineNuxtConfig } from 'nuxt/config';

export default defineNuxtConfig({
  srcDir: 'src',
  compatibilityDate: '2026-03-12',
  app: {
    head: {
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
      ],
    },
  },
  modules: ['@nuxtjs/tailwindcss'],
  devtools: {
    enabled: true, // または false
    vscode: {},
  },
  // devServer: {
  //   port: 24701
  // },
  // vite: {
  //   server: {
  //     allowedHosts: true,
  //     hmr: { port: 24601 },
  //   },
  // },
});
