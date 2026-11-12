import 'leaflet/dist/leaflet.css';
import { useEffect } from 'react';
import { CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import type { GeoPoint } from '../catalog/filters';

export interface LocationPickerProps {
  value: GeoPoint;
  onChange: (point: GeoPoint) => void;
}

const round = (value: number) => Math.round(value * 10_000) / 10_000;

function Clicks({ value, onChange }: LocationPickerProps) {
  const map = useMap();
  useMapEvents({ click: (event) => onChange({ lat: round(event.latlng.lat), lon: round(event.latlng.lng) }) });
  useEffect(() => {
    map.panTo([value.lat, value.lon]);
  }, [map, value.lat, value.lon]);
  return null;
}

/** Точка ферми на мапі (UI-08): клік ставить позначку; ті самі координати можна ввести в поля поруч. */
export default function LocationPicker({ value, onChange }: LocationPickerProps) {
  return (
    <MapContainer center={[value.lat, value.lon]} zoom={10} scrollWheelZoom style={{ height: '100%', width: '100%' }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={18}
      />
      <Clicks value={value} onChange={onChange} />
      <CircleMarker center={[value.lat, value.lon]} radius={9} pathOptions={{ color: '#fff', weight: 3, fillColor: '#2e7d32', fillOpacity: 1 }} />
    </MapContainer>
  );
}
