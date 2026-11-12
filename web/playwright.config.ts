import { defineConfig, devices } from '@playwright/test';

// Наскрізні тести: справжній FarmCart.Api з демонстраційними даними й зафіксованим часом (BE-7) віддає зібраний
// клієнт (web/dist). Перед запуском потрібні `dotnet build -c Release` і `npm run build` - їх робить ci.ps1.
const PORT = 5081;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: '../artifacts/e2e',
  // Сервер зберігає стан у пам'яті, а сценарії діляться слотами доставки, тож ідуть по одному.
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { outputFolder: '../artifacts/e2e-report', open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `dotnet run --project ../src/FarmCart.Api --configuration Release --no-build --no-launch-profile --urls ${BASE_URL}`,
    url: `${BASE_URL}/api/health`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      ASPNETCORE_ENVIRONMENT: 'Development',
      FarmCart__FixedTime: '2026-10-01T09:00:00+03:00',
    },
  },
});
