import { useState, useEffect, useCallback, useRef } from 'react';
import { SensorLog, ModelPrediction } from '../types';
import { deliveriesApi } from '../api/deliveries';

export function useSensorData(deliveryId: number, autoRefreshIntervalMs: number = 6000) {
  const [latestSensor, setLatestSensor] = useState<SensorLog | null>(null);
  const [sensorHistory, setSensorHistory] = useState<SensorLog[]>([]);
  const [predictions, setPredictions] = useState<ModelPrediction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  const fetchTelemetry = useCallback(async () => {
    if (!deliveryId) return;
    try {
      const [latest, history, preds] = await Promise.all([
        deliveriesApi.getLatestSensorData(deliveryId),
        deliveriesApi.getSensorHistory(deliveryId, 50),
        deliveriesApi.getPredictions(deliveryId, 50)
      ]);

      if (isMountedRef.current) {
        setLatestSensor(latest);
        setSensorHistory(history || []);
        setPredictions(preds || []);
        setError(null);
      }
    } catch (err: any) {
      if (isMountedRef.current) {
        console.warn('Failed to poll sensor telemetry:', err);
        setError(err.message || 'Unable to load sensor data');
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [deliveryId]);

  useEffect(() => {
    isMountedRef.current = true;
    setLoading(true);
    fetchTelemetry();

    let timer: any = null;
    if (autoRefreshIntervalMs > 0) {
      timer = setInterval(() => {
        fetchTelemetry();
      }, autoRefreshIntervalMs);
    }

    return () => {
      isMountedRef.current = false;
      if (timer) clearInterval(timer);
    };
  }, [deliveryId, autoRefreshIntervalMs, fetchTelemetry]);

  return {
    latestSensor,
    sensorHistory,
    predictions,
    loading,
    error,
    refresh: fetchTelemetry
  };
}
