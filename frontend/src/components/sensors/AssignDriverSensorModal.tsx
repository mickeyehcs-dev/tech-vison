import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Select } from '../common/Select';
import { Button } from '../common/Button';
import { SensorModule, User } from '../../types';
import { usersApi } from '../../api/users';
import { sensorsApi } from '../../api/sensors';
import { useToast } from '../../context/ToastContext';
import { LoadingState } from '../common/EmptyState';
import { Cpu } from 'lucide-react';

export interface AssignDriverSensorModalProps {
  isOpen: boolean;
  onClose: () => void;
  sensor: SensorModule | null;
  onSuccess: () => void;
}

export const AssignDriverSensorModal: React.FC<AssignDriverSensorModalProps> = ({
  isOpen,
  onClose,
  sensor,
  onSuccess
}) => {
  const [drivers, setDrivers] = useState<User[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (!isOpen || !sensor) return;

    setSelectedDriverId(sensor.driver_id ? String(sensor.driver_id) : '');

    const fetchDrivers = async () => {
      setLoading(true);
      try {
        const list = await usersApi.getActiveDrivers();
        setDrivers(list);
      } catch (err: any) {
        toast.error('Failed to load active drivers');
      } finally {
        setLoading(false);
      }
    };

    fetchDrivers();
  }, [isOpen, sensor, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sensor) return;

    setSubmitting(true);
    try {
      const driverIdNum = selectedDriverId ? parseInt(selectedDriverId, 10) : null;
      await sensorsApi.assignDriverToSensor(sensor.id, driverIdNum);
      toast.success(
        driverIdNum
          ? `Sensor ${sensor.device_name} successfully assigned to driver!`
          : `Sensor ${sensor.device_name} unassigned from driver.`
      );
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update sensor driver assignment');
    } finally {
      setSubmitting(false);
    }
  };

  if (!sensor) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Assign Driver to ${sensor.device_name}`}
      description="Pair this IoT hardware telemetry module with a fleet driver"
      maxWidth="md"
    >
      {loading ? (
        <LoadingState message="Loading fleet drivers..." />
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-1">
            <div className="flex items-center gap-2 text-slate-900 font-bold">
              <Cpu className="w-4 h-4 text-emerald-600" />
              <span>{sensor.device_name}</span>
              <span className="font-mono text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                {sensor.device_id}
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Hardware: {sensor.hardware_model} (Firmware v{sensor.firmware_version})
            </p>
          </div>

          <Select
            label="Assigned Driver"
            value={selectedDriverId}
            onChange={(e) => setSelectedDriverId(e.target.value)}
            options={[
              { value: '', label: 'Unassigned (Unpaired / Pool)' },
              ...drivers.map((d) => ({
                value: d.id,
                label: `${d.full_name || d.email} ${d.phone_number ? `(${d.phone_number})` : ''}`
              }))
            ]}
          />

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
            >
              Save Driver Assignment
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
};
