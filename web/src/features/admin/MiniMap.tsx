import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapContainer, Marker, TileLayer, Tooltip } from 'react-leaflet';

export interface MiniMapProps {
  lat: number;
  lon: number;
  label: string;
}

const pin = L.divIcon({
  className: '',
  iconSize: [26, 26],
  iconAnchor: [13, 26],
  html: '<div style="width:26px;height:26px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#4527a0;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.5)"></div>',
});

/** Невелика мапа місця господарства для адміністратора: замість голих координат видно, де саме ферма. */
export default function MiniMap({ lat, lon, label }: MiniMapProps) {
  return (
    <MapContainer center={[lat, lon]} zoom={11} scrollWheelZoom={false} attributionControl style={{ height: '100%', width: '100%' }}>
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={18} />
      <Marker position={[lat, lon]} icon={pin} title={label} alt={label}>
        <Tooltip>{label}</Tooltip>
      </Marker>
    </MapContainer>
  );
}
