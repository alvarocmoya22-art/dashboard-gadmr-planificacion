import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
    base: process.env.VITE_BASE_PATH || (process.env.NODE_ENV === 'production' ? '/dashboard-gadmr-planificacion/' : '/'),
    plugins: [react()],
    server: { port: 5173, host: '0.0.0.0' },
});
