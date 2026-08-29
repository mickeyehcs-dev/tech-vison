import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { DriverLocation } from '../../types';
import { Radio } from 'lucide-react';
import { formatTime } from '../../utils/formatters';

export interface DriverMapProps {
  latestLocation?: DriverLocation | null;
  trail?: DriverLocation[];
  height?: string | number;
  interactive?: boolean;
}

export const DriverMap: React.FC<DriverMapProps> = ({
  latestLocation,
  trail = [],
  height = '320px',
  interactive = true
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    const lat = latestLocation ? Number(latestLocation.latitude) : (trail.length > 0 ? Number(trail[trail.length - 1].latitude) : 20.5937);
    const lng = latestLocation ? Number(latestLocation.longitude) : (trail.length > 0 ? Number(trail[trail.length - 1].longitude) : 78.9629);
    const villageLevelZoom = 16;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        zoomControl: interactive,
        dragging: interactive,
        scrollWheelZoom: true,
        attributionControl: false
      }).setView([lat, lng], latestLocation || trail.length > 0 ? villageLevelZoom : 14);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        minZoom: 4
      }).addTo(map);

      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;

    if (latestLocation) {
      const curLat = Number(latestLocation.latitude);
      const curLng = Number(latestLocation.longitude);

      if (!markerRef.current) {
        const driverIcon = L.divIcon({
          className: 'driver-marker',
          html: `
            <div style="background-color: #059669; width: 34px; height: 34px; border-radius: 50%; border: 3px solid #ffffff; box-shadow: 0 4px 14px rgba(5,150,105,0.4); display: flex; align-items: center; justify-content: center; color: #ffffff;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
            </div>
          `,
          iconSize: [34, 34],
          iconAnchor: [17, 17]
        });

        markerRef.current = L.marker([curLat, curLng], { icon: driverIcon }).addTo(map);
      } else {
        markerRef.current.setLatLng([curLat, curLng]);
      }

      if (map.getZoom() < 15) {
        map.setView([curLat, curLng], villageLevelZoom, { animate: true });
      } else {
        map.panTo([curLat, curLng], { animate: true });
      }
    }

    if (trail && trail.length > 0) {
      const latLngs = trail.map((t) => [Number(t.latitude), Number(t.longitude)] as [number, number]);
      if (!polylineRef.current) {
        polylineRef.current = L.polyline(latLngs, {
          color: '#059669',
          weight: 5,
          opacity: 0.85,
          dashArray: '6, 8'
        }).addTo(map);
      } else {
        polylineRef.current.setLatLngs(latLngs);
      }
    }
  }, [latestLocation, trail, interactive]);

  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  return (
    <div className="relative w-full rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 shadow-xs">
      <div ref={mapContainerRef} style={{ height, width: '100%' }} />

      {!latestLocation ? (
        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center z-10">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 mb-3 shadow-xs">
            <Radio className="w-6 h-6 text-emerald-600" />
          </div>
          <h4 className="text-sm font-bold text-slate-900">Driver GPS Tracker</h4>
          <p className="text-xs text-slate-500 max-w-xs mt-1">
            Waiting for real-time GPS coordinates from driver's mobile device.
          </p>
        </div>
      ) : (
        <div className="absolute bottom-3 left-3 z-10 px-3 py-2 rounded-xl bg-white/95 border border-slate-200 backdrop-blur-md shadow-md text-xs text-slate-800 flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-emerald-700 font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
            LIVE GPS
          </div>
          <div className="font-mono text-[11px] text-slate-600 font-medium">
            {Number(latestLocation.latitude).toFixed(5)}, {Number(latestLocation.longitude).toFixed(5)}
          </div>
          <div className="text-[10px] text-slate-400 font-medium">
            {formatTime(latestLocation.recorded_at)}
          </div>
        </div>
      )}
    </div>
  );
};
