import { useState, useEffect, useRef } from 'react';
import { locationsApi } from '../api/locations';

export function useGeolocation(deliveryId?: number, isTrackingActive: boolean = false) {
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [permissionGranted, setPermissionGranted] = useState<boolean>(false);
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isTrackingActive || !deliveryId) {
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      return;
    }

    if (!('geolocation' in navigator)) {
      setError('Geolocation is not supported by your browser');
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const acc = position.coords.accuracy;
        const spd = position.coords.speed;
        const hdg = position.coords.heading;

        setCoords({ latitude: lat, longitude: lng });
        setAccuracy(acc);
        setPermissionGranted(true);
        setError(null);

        // Transmit coordinates to backend
        try {
          await locationsApi.sendLocation({
            deliveryId,
            latitude: lat,
            longitude: lng
          });
        } catch (err) {
          console.warn('Failed to upload GPS location:', err);
        }
      },
      (err) => {
        console.warn('Geolocation watch error:', err);
        setError(err.message || 'Unable to retrieve location');
        setPermissionGranted(false);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 10000
      }
    );

    return () => {
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [deliveryId, isTrackingActive]);

  return {
    coords,
    accuracy,
    error,
    permissionGranted
  };
}
