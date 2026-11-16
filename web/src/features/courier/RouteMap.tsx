import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect } from 'react';
import { MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet';
import type { RouteStop } from './route';

export interface RouteMapProps {
  stops: RouteStop[];
  /** Підпис зупинки для підказки: «Забрати №1004 - Бойківська комора». */
  label: (stop: RouteStop) => string;
}

// Номерований маркер: помаранчевий - забрати на фермі, зелений - віддати покупцю.
function numbered(index: number, kind: RouteStop['kind']): L.DivIcon {
  const color = kind === 'pickup' ? '#ef6c00' : '#2e7d32';
  return L.divIcon({
    className: '',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    html: `<div style="width:28px;height:28px;border-radius:50%;background:${color};color:#fff;font:700 13px system-ui,sans-serif;display:grid;place-items:center;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.45)">${index}</div>`,
  });
}

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  const key = points.map((point) => point.join(',')).join(';');
  useEffect(() => {
    if (points.length > 0) {
      map.fitBounds(points, { padding: [28, 28], maxZoom: 14 });
    }
    // key описує всі точки; сам масив щоразу новий.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key]);
  return null;
}

/** Мапа маршруту кур'єра: зупинки в порядку обходу з номерами й лінія між ними (OpenStreetMap). */
export default function RouteMap({ stops, label }: RouteMapProps) {
  const known = stops.flatMap((stop, index) => (stop.lat !== null && stop.lon !== null ? [{ stop, index, point: [stop.lat, stop.lon] as [number, number] }] : []));
  const points = known.map((item) => item.point);
  return (
    <MapContainer center={points[0] ?? [49.8419, 24.0315]} zoom={12} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={18} />
      <FitBounds points={points} />
      {points.length > 1 && <Polyline positions={points} pathOptions={{ color: '#1565c0', weight: 3, opacity: 0.8, dashArray: '6 6' }} />}
      {known.map(({ stop, index, point }) => (
        <Marker key={`${stop.kind}-${stop.orderId}`} position={point} icon={numbered(index + 1, stop.kind)} title={label(stop)} alt={label(stop)}>
          <Tooltip>{`${index + 1}. ${label(stop)}`}</Tooltip>
        </Marker>
      ))}
    </MapContainer>
  );
}
