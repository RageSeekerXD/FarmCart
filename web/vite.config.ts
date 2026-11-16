import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Dev: Vite проксує API, хаби й фото товарів на FarmCart.Api (:5080). Прод: API віддає web/dist статикою.
const api = 'http://localhost:5080';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': api,
      '/img': api,
      '/openapi': api,
      '/hubs': { target: api, ws: true },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    // Тести проходять сценарій як користувач (набір тексту в jsdom); під інструментацією покриття їм мало типових 5 с.
    testTimeout: 20_000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/main.tsx', 'src/features/map/FarmMapView.tsx', 'src/features/courier/RouteMap.tsx', 'src/features/admin/MiniMap.tsx', 'src/features/farmer/LocationPicker.tsx', 'src/test/**', 'src/**/*.test.{ts,tsx}', 'src/**/*.d.ts', 'src/api/types.ts'],
      reporter: ['text-summary', 'html'],
      reportsDirectory: '../artifacts/web-coverage',
      thresholds: { lines: 70 },
    },
  },
});
