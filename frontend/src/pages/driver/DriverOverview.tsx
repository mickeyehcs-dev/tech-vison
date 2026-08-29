import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '../../components/layout/DashboardLayout';
import { StatCard } from '../../components/common/StatCard';
import { DeliveryCard } from '../../components/delivery/DeliveryCard';
import { Delivery, DashboardStats } from '../../types';
import { adminApi } from '../../api/locations';
import { deliveriesApi } from '../../api/deliveries';
import { useToast } from '../../context/ToastContext';
import { Button } from '../../components/common/Button';
import { Radio, Truck, CheckCircle2, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const DriverOverview: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activeDeliveries, setActiveDeliveries] = useState<Delivery[]>([]);
  const toast = useToast();
  const navigate = useNavigate();

  const loadData = async () => {
    try {
      const [statsData, delivsData] = await Promise.all([
        adminApi.getDashboardStats(),
        deliveriesApi.listDeliveries({ statusGroup: 'current', limit: 6 })
      ]);
      setStats(statsData);
      setActiveDeliveries(delivsData.deliveries);
    } catch (err: any) {
      toast.error('Failed to load driver dashboard');
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Driver Fleet Dashboard</h1>
            <p className="text-xs text-slate-500 mt-1">
              Active transport assignments, GPS location transmission, and cargo condition monitoring
            </p>
          </div>
          <Button
            size="md"
            variant="primary"
            leftIcon={<Radio className="w-4 h-4 animate-pulse" />}
            onClick={() => navigate('/driver/active')}
          >
            Launch On-Road Tracker
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            title="Assigned / Pending Acceptance"
            value={stats?.assignedDeliveries || 0}
            icon={<Clock className="w-6 h-6" />}
            variant="amber"
            subtitle="Requires your confirmation"
          />
          <StatCard
            title="In-Transit Active"
            value={stats?.currentDeliveries || 0}
            icon={<Truck className="w-6 h-6" />}
            variant="emerald"
            subtitle="Currently under transit"
          />
          <StatCard
            title="Completed Deliveries"
            value={stats?.completedDeliveries || 0}
            icon={<CheckCircle2 className="w-6 h-6" />}
            variant="sky"
            subtitle="Total completed runs"
          />
        </div>

        {/* Active Deliveries Grid */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-slate-900">Current Assigned Shipments</h3>
            <Button variant="ghost" size="sm" onClick={() => navigate('/driver/deliveries')}>
              View All Runs →
            </Button>
          </div>

          {activeDeliveries.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-white border border-dashed border-slate-300 text-slate-500 text-xs shadow-xs">
              No active shipments right now. Check back when admin or sender assigns a delivery.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeDeliveries.map((deliv) => (
                <DeliveryCard key={deliv.id} delivery={deliv} />
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};
