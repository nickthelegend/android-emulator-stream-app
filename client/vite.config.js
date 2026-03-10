import { defineConfig } from 'vite'

export default defineConfig({
    server: {
        proxy: {
            '/api': {
                target: 'http://localhost:3500',
                changeOrigin: true,
            },
            '/ws': {
                target: 'ws://localhost:3500',
                ws: true,
            }
        }
    }
})
