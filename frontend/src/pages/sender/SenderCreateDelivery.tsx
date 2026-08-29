import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '../../components/layout/DashboardLayout';
import { SectionCard } from '../../components/common/SectionCard';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { Button } from '../../components/common/Button';
import { deliveriesApi } from '../../api/deliveries';
import { usersApi } from '../../api/users';
import { useToast } from '../../context/ToastContext';
import { useNavigate } from 'react-router-dom';
import { Utensils, MapPin, Sparkles, ArrowLeft, Clock } from 'lucide-react';
import { User } from '../../types';

export const SenderCreateDelivery: React.FC = () => {
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
  const navigate = useNavigate();

  useEffect(() => {
    const fetchDrivers = async () => {
      try {
        const drvs = await usersApi.getActiveDrivers();
        setDrivers(drvs);
      } catch (err) {
        console.warn('Failed to load active drivers', err);
      }
    };
    fetchDrivers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!foodName || !sourceLocation || !destinationLocation) {
      toast.warning('Please fill in all required delivery details');
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
      navigate(`/deliveries/${created.id}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to create delivery');
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6 max-w-2xl mx-auto">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            leftIcon={<ArrowLeft className="w-4 h-4" />}
            onClick={() => navigate('/sender/overview')}
          >
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Create Delivery</h1>
            <p className="text-xs text-slate-500 mt-0.5">Register food cargo for intelligent transport monitoring</p>
          </div>
        </div>

        <SectionCard
          title={
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              <span>Shipment Parameters</span>
            </div>
          }
        >
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <Input
              label="Food Item Name / Cargo Description"
              placeholder="e.g. Fresh Cow Milk, Organic Tomatoes, Fresh Salmon"
              value={foodName}
              onChange={(e) => setFoodName(e.target.value)}
              leftIcon={<Utensils className="w-4 h-4 text-emerald-600" />}
              helperText="Specify the food type to configure optimal storage bounds"
              required
              autoFocus
            />

            <Input
              label="Origin Pickup Location"
              placeholder="e.g. Anantapur, Andhra Pradesh, India"
              value={sourceLocation}
              onChange={(e) => setSourceLocation(e.target.value)}
              leftIcon={<MapPin className="w-4 h-4 text-emerald-600" />}
              required
            />

            <Input
              label="Final Destination"
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
                helperText="Scheduled delivery dispatch start time"
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

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={() => navigate('/sender/overview')}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" size="md" loading={loading}>
                Create Delivery Request
              </Button>
            </div>
          </form>
        </SectionCard>
      </div>
    </DashboardLayout>
  );
};
