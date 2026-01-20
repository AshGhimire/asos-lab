import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    plugins: [react()],
    root: '.', // Serve from current directory (services/api)
    publicDir: 'public', // Static assets like style.css
    build: {
        outDir: 'dist/public', // Output to where Fastify expects it
        emptyOutDir: true
    },
    server: {
        port: 5173,
        proxy: {
            '/bid': 'http://localhost:3000',
            '/state': 'http://localhost:3000',
            '/login': 'http://localhost:3000',
            '/signup': 'http://localhost:3000',
            '/crash': 'http://localhost:3000'
        }
    }
});
