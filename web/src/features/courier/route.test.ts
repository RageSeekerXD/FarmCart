import { describe, expect, it } from 'vitest';
import { delivery } from '../../test/server';
import { googleRouteUrl, navigatorLinks, planRoute, slotState } from './route';

describe('маршрут кур’єра', () => {
  it('забирає раніше, ніж віддає, і йде до найближчої доступної точки', () => {
    const near = { ...delivery, orderId: 1002, pickupLat: 49.79, pickupLon: 24.06, dropOffLat: 49.8, dropOffLon: 24.05 };

    const route = planRoute([delivery, near]).map((stop) => `${stop.kind}:${stop.orderId}`);

    expect(route).toEqual(['pickup:1001', 'pickup:1002', 'dropoff:1002', 'dropoff:1001']);
  });

  it('слоти проходяться за часом: ранній слот повністю, потім пізніший', () => {
    const later = { ...delivery, orderId: 7, slotStart: '2026-10-02T14:00:00+03:00', slotEnd: '2026-10-02T16:00:00+03:00' };

    const route = planRoute([later, delivery]).map((stop) => `${stop.kind}:${stop.orderId}`);

    expect(route).toEqual(['pickup:1001', 'dropoff:1001', 'pickup:7', 'dropoff:7']);
  });

  it('доставка без точки на мапі - наприкінці свого слоту', () => {
    const unknown = { ...delivery, orderId: 3, dropOffLat: null, dropOffLon: null };

    const route = planRoute([unknown, delivery]);

    expect(route.at(-1)).toEqual({ kind: 'dropoff', orderId: 3, lat: null, lon: null });
  });

  it('увесь маршрут у Google Maps: початок, кінець і проміжні точки', () => {
    const url = new URL(googleRouteUrl(planRoute([delivery]))!);

    expect(url.searchParams.get('origin')).toBe('49.816,24.13');
    expect(url.searchParams.get('destination')).toBe('49.8378,24.0468');
    expect(googleRouteUrl([])).toBeNull();
  });

  it('без точки доставки навігатори ведуть за адресою', () => {
    const links = navigatorLinks({ ...delivery, dropOffLat: null, dropOffLon: null });

    expect(links.map((link) => link.name)).toEqual(['Google Maps', 'Waze', 'Apple Maps']);
    expect(new URL(links[1]!.href).searchParams.get('q')).toBe(delivery.address);
    expect(new URL(links[2]!.href).searchParams.get('daddr')).toBe(delivery.address);
  });

  it('таймер слоту: до початку, під час і після', () => {
    const start = '2026-10-02T10:00:00+03:00';
    const end = '2026-10-02T12:00:00+03:00';
    const at = (time: string) => new Date(`2026-10-02T${time}:00+03:00`).getTime();

    expect(slotState(start, end, at('09:30'))).toEqual({ phase: 'before', minutes: 30, progress: 0 });
    expect(slotState(start, end, at('11:00'))).toEqual({ phase: 'during', minutes: 60, progress: 0.5 });
    expect(slotState(start, end, at('12:20'))).toEqual({ phase: 'after', minutes: 20, progress: 1 });
  });
});
