import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect } from 'react';
import { Circle, CircleMarker, MapContainer, Marker, TileLayer, Tooltip, useMap } from 'react-leaflet';
import type { FarmOnMap } from '../../api/types';
import type { GeoPoint } from '../catalog/filters';
import { boundsOf } from './geo';

export interface FarmMapViewProps {
  center: GeoPoint;
  farms: FarmOnMap[];
  radiusKm: number | null;
  selectedId: number | null;
  onSelect: (farmId: number) => void;
  label: (farm: FarmOnMap) => string;
  youAreHere: string;
}

// Маркер - елемент div із CSS, а не картинка: не залежить від шляхів до файлів Leaflet у збірці.
function pin(selected: boolean, certified: boolean): L.DivIcon {
  const size = selected ? 34 : 26;
  const color = certified ? '#2e7d32' : '#ef6c00';
  return L.divIcon({
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    html: `<div style="width:${size}px;height:${size}px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${color};border:3px solid ${selected ? '#ffb300' : '#fff'};box-shadow:0 1px 4px rgba(0,0,0,.5)"></div>`,
  });
}

/** Тримає в кадрі покупця, ферми й коло радіуса; обрану в списку ферму показує ближче. */
function Viewport({ center, farms, radiusKm, selectedId }: Pick<FarmMapViewProps, 'center' | 'farms' | 'radiusKm' | 'selectedId'>) {
  const map = useMap();
  const key = `${center.lat},${center.lon},${radiusKm},${farms.map((farm) => farm.id).join('.')}`;
  useEffect(() => {
    map.fitBounds(boundsOf(center, farms, radiusKm), { padding: [24, 24], maxZoom: 13 });
    // key описує всі залежності кадру; сам масив farms щоразу новий.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key]);

  useEffect(() => {
    const farm = farms.find((item) => item.id === selectedId);
    if (farm) {
      map.panTo([farm.lat, farm.lon]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, selectedId]);

  return null;
}

/** Мапа ферм на OpenStreetMap (UI-03). Картинку Leaflet автотести не перевіряють - лише чисті функції geo.ts. */
export default function FarmMapView({ center, farms, radiusKm, selectedId, onSelect, label, youAreHere }: FarmMapViewProps) {
  return (
    <MapContainer center={[center.lat, center.lon]} zoom={10} scrollWheelZoom style={{ height: '100%', width: '100%' }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={18}
      />
      <Viewport center={center} farms={farms} radiusKm={radiusKm} selectedId={selectedId} />
      {radiusKm !== null && (
        <Circle center={[center.lat, center.lon]} radius={radiusKm * 1000} pathOptions={{ color: '#2e7d32', fillOpacity: 0.08 }} />
      )}
      <CircleMarker center={[center.lat, center.lon]} radius={7} pathOptions={{ color: '#1565c0', fillColor: '#1565c0', fillOpacity: 1 }}>
        <Tooltip>{youAreHere}</Tooltip>
      </CircleMarker>
      {farms.map((farm) => (
        <Marker
          key={farm.id}
          position={[farm.lat, farm.lon]}
          icon={pin(farm.id === selectedId, farm.certified)}
          title={label(farm)}
          alt={label(farm)}
          zIndexOffset={farm.id === selectedId ? 1000 : 0}
          eventHandlers={{ click: () => onSelect(farm.id) }}
        >
          <Tooltip>{label(farm)}</Tooltip>
        </Marker>
      ))}
    </MapContainer>
  );
}
