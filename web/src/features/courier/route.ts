import type { DeliveryTask } from '../../api/types';
import { distanceKm } from '../map/geo';

export interface RouteStop {
  kind: 'pickup' | 'dropoff';
  orderId: number;
  /** null - точка доставки невідома (адреса лише текстом): така зупинка йде в кінець свого слоту. */
  lat: number | null;
  lon: number | null;
}

/**
 * Порядок зупинок кур'єра «забрати → віддати» для кількох доставок. Слоти проходяться за часом; усередині слоту -
 * найближча доступна зупинка (віддати можна лише вже забране). Це наближення, а не оптимальний маршрут, але на
 * кількох точках дає розумний обхід без зворотних поїздок.
 */
export function planRoute(tasks: readonly DeliveryTask[]): RouteStop[] {
  const bySlot = new Map<string, DeliveryTask[]>();
  for (const task of [...tasks].sort((a, b) => a.slotStart.localeCompare(b.slotStart) || a.orderId - b.orderId)) {
    bySlot.set(task.slotStart, [...(bySlot.get(task.slotStart) ?? []), task]);
  }

  const route: RouteStop[] = [];
  let here: { lat: number; lon: number } | null = null;
  for (const group of bySlot.values()) {
    const pending: RouteStop[] = group.map((task) => ({ kind: 'pickup', orderId: task.orderId, lat: task.pickupLat, lon: task.pickupLon }));
    const unknown: RouteStop[] = [];
    const picked = new Set<number>();
    while (pending.length > 0) {
      const from = here;
      const index = from === null ? 0 : pending.reduce((best, stop, i) => (distanceTo(from, stop) < distanceTo(from, pending[best]!) ? i : best), 0);
      const [stop] = pending.splice(index, 1) as [RouteStop];
      route.push(stop);
      here = { lat: stop.lat!, lon: stop.lon! };
      if (stop.kind === 'pickup' && !picked.has(stop.orderId)) {
        picked.add(stop.orderId);
        const task = group.find((item) => item.orderId === stop.orderId)!;
        const dropoff: RouteStop = { kind: 'dropoff', orderId: task.orderId, lat: task.dropOffLat, lon: task.dropOffLon };
        (dropoff.lat === null || dropoff.lon === null ? unknown : pending).push(dropoff);
      }
    }

    route.push(...unknown);
  }

  return route;
}

function distanceTo(from: { lat: number; lon: number }, stop: RouteStop): number {
  return stop.lat === null || stop.lon === null ? Infinity : distanceKm(from, { lat: stop.lat, lon: stop.lon });
}

/** Увесь маршрут у Google Maps: перша й остання відомі точки, решта - проміжні (не більше 9). */
export function googleRouteUrl(stops: readonly RouteStop[]): string | null {
  const known = stops.filter((stop) => stop.lat !== null && stop.lon !== null).map((stop) => `${stop.lat},${stop.lon}`);
  if (known.length < 2) {
    return null;
  }

  const params = new URLSearchParams({ api: '1', origin: known[0]!, destination: known.at(-1)!, travelmode: 'driving' });
  const waypoints = known.slice(1, -1).slice(0, 9);
  if (waypoints.length > 0) {
    params.set('waypoints', waypoints.join('|'));
  }

  return `https://www.google.com/maps/dir/?${params}`;
}

/** Навігатор на вибір: від ферми до покупця (Waze веде лише до місця призначення). */
export function navigatorLinks(task: DeliveryTask): { name: string; href: string }[] {
  const origin = `${task.pickupLat},${task.pickupLon}`;
  const coordinates = task.dropOffLat !== null && task.dropOffLon !== null ? `${task.dropOffLat},${task.dropOffLon}` : null;
  const destination = coordinates ?? task.address;
  return [
    { name: 'Google Maps', href: `https://www.google.com/maps/dir/?${new URLSearchParams({ api: '1', origin, destination, travelmode: 'driving' })}` },
    {
      name: 'Waze',
      href: coordinates ? `https://waze.com/ul?${new URLSearchParams({ ll: coordinates, navigate: 'yes' })}` : `https://waze.com/ul?${new URLSearchParams({ q: task.address, navigate: 'yes' })}`,
    },
    { name: 'Apple Maps', href: `https://maps.apple.com/?${new URLSearchParams({ saddr: origin, daddr: destination, dirflg: 'd' })}` },
  ];
}

/** Стан слоту доставки відносно поточного часу: до початку, триває (частка минулого) чи вже минув. */
export function slotState(start: string, end: string, now: number): { phase: 'before' | 'during' | 'after'; minutes: number; progress: number } {
  const from = new Date(start).getTime();
  const to = new Date(end).getTime();
  if (now < from) {
    return { phase: 'before', minutes: Math.ceil((from - now) / 60_000), progress: 0 };
  }

  if (now <= to) {
    return { phase: 'during', minutes: Math.ceil((to - now) / 60_000), progress: (now - from) / (to - from) };
  }

  return { phase: 'after', minutes: Math.floor((now - to) / 60_000), progress: 1 };
}
