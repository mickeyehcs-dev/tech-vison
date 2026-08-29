import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Input } from '../common/Input';
import { Select } from '../common/Select';
import { Button } from '../common/Button';
import { deliveriesApi } from '../../api/deliveries';
import { usersApi } from '../../api/users';
import { useToast } from '../../context/ToastContext';
import { Utensils, MapPin, Clock } from 'lucide-react';
import { User } from '../../types';

export interface CreateDeliveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newDelivery: any) => void;
}

export const CreateDeliveryModal: React.FC<CreateDeliveryModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [foodName, setFoodName] = useState('');
  const [sourceLocation, setSourceLocation] = useState('');
  const [destinationLocation, setDestinationLocation] = useState('');
  const [startTime, setStartTime] = useState(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  });
  const [selectedDriverId, setSelectedDriverId] = useState<string>('');
  const [drivers, setDrivers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (!isOpen) return;
    const fetchDrivers = async () => {
      try {
        const drvs = await usersApi.getActiveDrivers();
        setDrivers(drvs);
      } catch (err) {
        console.warn('Failed to load active drivers', err);
      }
    };
    fetchDrivers();
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!foodName || !sourceLocation || !destinationLocation) {
      toast.warning('Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      const formattedStartTime = startTime ? startTime.replace('T', ' ') + ':00' : undefined;
      const created = await deliveriesApi.createDelivery({
        food_name: foodName,
        source_location: sourceLocation,
        destination_location: destinationLocation,
        start_time: formattedStartTime,
        driver_id: selectedDriverId ? Number(selectedDriverId) : undefined
      });

      toast.success(
        selectedDriverId
          ? `Delivery #${created.delivery_code} created and assigned to driver!`
          : `Delivery #${created.delivery_code} created successfully!`
      );
      onSuccess(created);
      onClose();
      setFoodName('');
      setSourceLocation('');
      setDestinationLocation('');
      setSelectedDriverId('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to create delivery');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create New Delivery"
      description="Submit food item and transit coordinates for IoT monitored dispatch"
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Food Item Name"
          placeholder="e.g. Fresh Cow Milk, Organic Tomatoes, Fresh Salmon"
          value={foodName}
          onChange={(e) => setFoodName(e.target.value)}
          leftIcon={<Utensils className="w-4 h-4 text-emerald-600" />}
          required
        />

        <Input
          label="Pickup Origin (Source)"
          placeholder="e.g. Anantapur, Andhra Pradesh, India"
          value={sourceLocation}
          onChange={(e) => setSourceLocation(e.target.value)}
          leftIcon={<MapPin className="w-4 h-4 text-emerald-600" />}
          required
        />

        <Input
          label="Delivery Destination"
          placeholder="e.g. Hyderabad, Telangana, India"
          value={destinationLocation}
          onChange={(e) => setDestinationLocation(e.target.value)}
          leftIcon={<MapPin className="w-4 h-4 text-rose-600" />}
          required
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Time & Date to Start Delivery"
            type="datetime-local"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            leftIcon={<Clock className="w-4 h-4 text-blue-600" />}
            helperText="Scheduled cargo pickup time"
          />

          <Select
            label="Assign Driver (Optional)"
            value={selectedDriverId}
            onChange={(e) => setSelectedDriverId(e.target.value)}
            options={[
              { value: '', label: 'Assign Later (Pending)' },
              ...drivers.map((d) => ({
                value: d.id,
                label: `${d.full_name || d.email} ${d.device_id ? `[IoT: ${d.device_id}]` : ''}`
              }))
            ]}
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" size="sm" loading={loading}>
            Submit Delivery
          </Button>
        </div>
      </form>
    </Modal>
  );
};
