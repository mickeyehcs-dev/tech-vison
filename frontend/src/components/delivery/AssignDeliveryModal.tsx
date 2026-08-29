import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Select } from '../common/Select';
import { Button } from '../common/Button';
import { Delivery, User } from '../../types';
import { usersApi } from '../../api/users';
import { deliveriesApi } from '../../api/deliveries';
import { useToast } from '../../context/ToastContext';
import { LoadingState } from '../common/EmptyState';
import { Truck, Cpu } from 'lucide-react';

export interface AssignDeliveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  delivery: Delivery | null;
  onSuccess: (updated: Delivery) => void;
}

export const AssignDeliveryModal: React.FC<AssignDeliveryModalProps> = ({
  isOpen,
  onClose,
  delivery,
  onSuccess
}) => {
  const [drivers, setDrivers] = useState<User[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState<string>('');
  const [loadingData, setLoadingData] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (!isOpen) return;

    const fetchOptions = async () => {
      setLoadingData(true);
      try {
        const drvList = await usersApi.getActiveDrivers();
        setDrivers(drvList);
        if (drvList.length > 0) {
          setSelectedDriverId(String(drvList[0].id));
        }
      } catch (err: any) {
        toast.error('Failed to load active drivers');
      } finally {
        setLoadingData(false);
      }
    };

    fetchOptions();
  }, [isOpen, toast]);

  const selectedDriver = drivers.find((d) => String(d.id) === selectedDriverId);

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!delivery || !selectedDriverId) {
      toast.warning('Please select a driver to assign');
      return;
    }

    setSubmitting(true);
    try {
      const updated = await deliveriesApi.assignDriver(
        delivery.id,
        Number(selectedDriverId)
      );
      toast.success(`Delivery #${delivery.delivery_code} assigned to driver successfully!`);
      onSuccess(updated);
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to assign delivery');
    } finally {
      setSubmitting(false);
    }
  };

  if (!delivery) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Assign Driver to #${delivery.delivery_code}`}
      description="Select an active fleet driver for this cargo dispatch"
      maxWidth="md"
    >
      {loadingData ? (
        <LoadingState message="Loading active fleet drivers..." />
      ) : (
        <form onSubmit={handleAssign} className="flex flex-col gap-4">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-1">
            <div>
              <span className="font-bold text-slate-900">Cargo Item:</span> {delivery.food_name}
            </div>
            <div>
              <span className="font-bold text-slate-900">Route:</span> {delivery.source_location} →{' '}
              {delivery.destination_location}
            </div>
          </div>

          <Select
            label="Select Active Fleet Driver"
            value={selectedDriverId}
            onChange={(e) => setSelectedDriverId(e.target.value)}
            options={drivers.map((d) => ({
              value: d.id,
              label: `${d.full_name || d.email} ${d.phone_number ? `(${d.phone_number})` : ''} ${d.device_id ? `[IoT: ${d.device_id}]` : ''}`
            }))}
            placeholder={drivers.length === 0 ? 'No active drivers available' : 'Select Driver'}
            required
            disabled={drivers.length === 0}
          />

          {selectedDriver && (
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-1.5">
              <div className="flex items-center gap-2 text-slate-900 font-bold">
                <Truck className="w-4 h-4 text-emerald-600" />
                {selectedDriver.full_name || selectedDriver.email}
              </div>
              <div className="text-[11px] text-slate-600 font-medium">
                Phone: <span className="text-slate-900 font-bold">{selectedDriver.phone_number || 'None'}</span> • Email: <span className="text-slate-900">{selectedDriver.email}</span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-600">
                <Cpu className="w-3.5 h-3.5 text-blue-600" />
                Assigned IoT Sensor: <span className="font-mono text-blue-700 font-bold">{selectedDriver.device_id ? `${selectedDriver.device_name || 'Unit'} [${selectedDriver.device_id}]` : 'Auto-paired via Driver vehicle'}</span>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              loading={submitting}
              disabled={drivers.length === 0}
            >
              Confirm Assignment
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
};
