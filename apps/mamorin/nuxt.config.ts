import { defineNuxtConfig } from 'nuxt/config';

export default defineNuxtConfig({
  srcDir: 'src',
  compatibilityDate: '2026-03-12',
  devtools: {
    enabled: true, // または false
    vscode: {},
    //port: 24703
  },
  // devServer: {
  //   port: 24703
  // },
  // vite: {
  //   server: {
  //     allowedHosts: true,
  //     hmr: { port: 24603 },
  //   },
  // },
});
