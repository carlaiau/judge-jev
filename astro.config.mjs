import { defineConfig } from 'astro/config'
import react from '@astrojs/react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  output: 'static',
  srcDir: './site/src',
  publicDir: './site/public',
  outDir: './site/dist',
  integrations: [react()],
  vite: { plugins: [tailwindcss()] },
})
