import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import i18n from '../i18n';
import { backend, server } from './server';
import { hub } from './signalr';

// Справжній хаб у jsdom недоступний: з'єднання SignalR замінює керований двійник.
vi.mock('@microsoft/signalr', () => import('./signalr'));

// Під інструментацією покриття сторінка інколи малюється довше за типову 1 с очікування findBy*.
configure({ asyncUtilTimeout: 5000 });

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));

afterEach(async () => {
  cleanup();
  server.resetHandlers();
  backend.reset();
  hub.reset();
  localStorage.clear();
  await i18n.changeLanguage('uk');
  localStorage.clear();
});

afterAll(() => server.close());
