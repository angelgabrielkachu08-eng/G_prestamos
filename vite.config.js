import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          minSize: 20_000,
          groups: [
            { name: 'react-vendor', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/, priority: 20 },
            { name: 'motion-vendor', test: /node_modules[\\/](framer-motion|motion|motion-dom)[\\/]/, priority: 15 },
            { name: 'supabase-vendor', test: /node_modules[\\/]@supabase[\\/]/, priority: 15 },
            { name: 'icons-vendor', test: /node_modules[\\/]lucide-react[\\/]/, priority: 15 },
            { name: 'vendor', test: /node_modules[\\/]/, priority: 1, maxSize: 300_000 },
          ],
        },
      },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({ registerType: 'autoUpdate', includeAssets: ['favicon.svg'], manifest: { name: 'Prestaneo Finance OS', short_name: 'Prestaneo', description: 'Gestión inteligente de préstamos y cobranzas', theme_color: '#08090c', background_color: '#08090c', display: 'standalone', orientation: 'portrait-primary', start_url: '/', icons: [{ src: '/pwa-192.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'any' }, { src: '/pwa-512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any maskable' }] } }),
  ],
})
