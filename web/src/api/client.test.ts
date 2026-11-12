import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { server, TOKEN } from '../test/server';
import { ApiError, api, session } from './client';

describe('клієнт API', () => {
  it('додає токен сесії в заголовок Authorization', async () => {
    session.token = TOKEN;

    await expect(api('/me')).resolves.toMatchObject({ id: 7 });
  });

  it('помилка API стає ApiError з кодом і статусом', async () => {
    const failure = await api('/auth/code', { method: 'POST', body: { phone: '123' } }).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ApiError);
    expect(failure).toMatchObject({ status: 400, code: 'phone_invalid' });
  });

  it('відхилена сесія (401) стирає токен і повідомляє застосунок', async () => {
    const onUnauthorized = vi.fn();
    session.token = 'stale-token';
    session.onUnauthorized(onUnauthorized);

    await expect(api('/me')).rejects.toMatchObject({ status: 401, code: 'session_invalid' });

    expect(session.token).toBeNull();
    expect(onUnauthorized).toHaveBeenCalledOnce();
    session.onUnauthorized(null);
  });

  it('відповідь без JSON дає загальний код помилки сервера', async () => {
    server.use(http.get('*/api/reference', () => new HttpResponse('Bad Gateway', { status: 502 })));

    await expect(api('/reference')).rejects.toMatchObject({ status: 502, code: 'server' });
  });

  it('обрив мережі дає код network', async () => {
    server.use(http.get('*/api/reference', () => HttpResponse.error()));

    await expect(api('/reference')).rejects.toMatchObject({ status: 0, code: 'network' });
  });

  it('відповідь 204 не має тіла', async () => {
    server.use(http.delete('*/api/cart/items/1', () => new HttpResponse(null, { status: 204 })));

    await expect(api('/cart/items/1', { method: 'DELETE' })).resolves.toBeUndefined();
  });
});
