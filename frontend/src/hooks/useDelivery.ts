import { useState, useEffect, useCallback } from 'react';
import { Delivery } from '../types';
import { deliveriesApi } from '../api/deliveries';
import { useToast } from '../context/ToastContext';

export function useDelivery(deliveryId: number) {
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  const fetchDelivery = useCallback(async () => {
    if (!deliveryId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await deliveriesApi.getDeliveryById(deliveryId);
      setDelivery(data);
    } catch (err: any) {
      const msg = err.message || 'Failed to load delivery';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [deliveryId]);

  useEffect(() => {
    fetchDelivery();
  }, [fetchDelivery]);

  const accept = async () => {
    if (!deliveryId) return;
    try {
      const updated = await deliveriesApi.acceptDelivery(deliveryId);
      setDelivery(updated);
      toast.success('Delivery accepted successfully!');
      return updated;
    } catch (err: any) {
      toast.error(err.message || 'Failed to accept delivery');
      throw err;
    }
  };

  const start = async () => {
    if (!deliveryId) return;
    try {
      const updated = await deliveriesApi.startDelivery(deliveryId);
      setDelivery(updated);
      toast.success('Delivery started! IoT telemetry & GPS tracking active.');
      return updated;
    } catch (err: any) {
      toast.error(err.message || 'Failed to start delivery');
      throw err;
    }
  };

  const complete = async () => {
    if (!deliveryId) return;
    try {
      const updated = await deliveriesApi.completeDelivery(deliveryId);
      setDelivery(updated);
      toast.success('Delivery completed successfully! Sensor released.');
      return updated;
    } catch (err: any) {
      toast.error(err.message || 'Failed to complete delivery');
      throw err;
    }
  };

  const reject = async (reason?: string) => {
    if (!deliveryId) return;
    try {
      const updated = await deliveriesApi.rejectDelivery(deliveryId, reason);
      setDelivery(updated);
      toast.info('Delivery assignment declined. Shipment returned to pending queue.');
      return updated;
    } catch (err: any) {
      toast.error(err.message || 'Failed to reject delivery');
      throw err;
    }
  };

  return {
    delivery,
    loading,
    error,
    refresh: fetchDelivery,
    accept,
    reject,
    start,
    complete
  };
}
