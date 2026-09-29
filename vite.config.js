import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa'; // <-- NOVO IMPORT

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
    
    // <-- CONFIGURAÇÃO DO APP MOBILE (PWA) -->
    VitePWA({
      registerType: 'autoUpdate', // Atualiza o app no telemóvel sozinho
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'pwa-192x192.png', 'pwa-512x512.png'],
      manifest: {
        name: 'Rakiti',
        short_name: 'Rakiti',
        description: 'NPS, CSAT e retenção de clientes',
        theme_color: '#0f172a', // Cor principal (slate-900 para combinar com o Dark Mode)
        background_color: '#0f172a',
        display: 'standalone', // Faz abrir em ecrã inteiro parecendo um App nativo
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable' // Ajuda o Android a moldar o ícone
          }
        ]
      }
    })
  ],
  server: {
    port: 5173
  }
});