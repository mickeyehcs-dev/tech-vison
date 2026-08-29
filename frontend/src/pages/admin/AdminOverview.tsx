import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '../../components/layout/DashboardLayout';
import { StatCard } from '../../components/common/StatCard';
import { SectionCard } from '../../components/common/SectionCard';
import { DeliveryTable } from '../../components/delivery/DeliveryTable';
import { AssignDeliveryModal } from '../../components/delivery/AssignDeliveryModal';
import { Delivery, DashboardStats } from '../../types';
import { adminApi } from '../../api/locations';
import { deliveriesApi } from '../../api/deliveries';
import { useToast } from '../../context/ToastContext';
import {
  Users,
  Truck,
  Clock,
  Cpu,
  ShieldAlert
} from 'lucide-react';
import { Button } from '../../components/common/Button';
import { useNavigate } from 'react-router-dom';

export const AdminOverview: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [currentDeliveries, setCurrentDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDeliveryToAssign, setSelectedDeliveryToAssign] = useState<Delivery | null>(null);
  const toast = useToast();
  const navigate = useNavigate();

  const loadData = async () => {
    try {
      const [statsData, delivsData] = await Promise.all([
        adminApi.getDashboardStats(),
        deliveriesApi.listDeliveries({ statusGroup: 'current', limit: 10 })
      ]);
      setStats(statsData);
      setCurrentDeliveries(delivsData.deliveries);
    } catch (err: any) {
      toast.error('Failed to load dashboard overview data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      loadData();
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6">
        {/* Header banner */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Admin Command Center</h1>
            <p className="text-xs text-slate-500 mt-1">
              Real-time monitoring of food cargo logistics, IoT sensors, and spoilage risks
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate('/admin/sensors')}
              leftIcon={<Cpu className="w-4 h-4 text-emerald-600" />}
            >
              Manage Sensors
            </Button>
            <Button
              size="sm"
              onClick={() => navigate('/admin/users')}
              leftIcon={<Users className="w-4 h-4" />}
            >
              Manage Users
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Pending Assignments"
            value={stats?.pendingDeliveries || 0}
            icon={<Clock className="w-6 h-6" />}
            variant="amber"
            subtitle="Requires driver & IoT assignment"
          />
          <StatCard
            title="Active In-Transit"
            value={stats?.currentDeliveries || 0}
            icon={<Truck className="w-6 h-6" />}
            variant="emerald"
            subtitle="Under real-time telemetry"
          />
          <StatCard
            title="Available Sensors"
            value={`${stats?.availableSensors || 0} / ${stats?.totalSensors || 0}`}
            icon={<Cpu className="w-6 h-6" />}
            variant="sky"
            subtitle="Ready for deployment"
          />
          <StatCard
            title="Spoilage Alerts"
            value={stats?.highRiskDeliveries || 0}
            icon={<ShieldAlert className="w-6 h-6" />}
            variant={stats?.highRiskDeliveries ? 'rose' : 'default'}
            subtitle="High / Critical risk deliveries"
          />
        </div>

        {/* Current Active Deliveries */}
        <SectionCard
          title="Active Monitored Deliveries"
          subtitle="Real-time multi-sensor telemetry stream and logistics state"
          action={
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/admin/deliveries')}
            >
              View All →
            </Button>
          }
          noPadding
        >
          <DeliveryTable
            deliveries={currentDeliveries}
            loading={loading}
            isAdmin={true}
            onAssignClick={(d) => setSelectedDeliveryToAssign(d)}
          />
        </SectionCard>

        {/* Assign Modal */}
        <AssignDeliveryModal
          isOpen={Boolean(selectedDeliveryToAssign)}
          onClose={() => setSelectedDeliveryToAssign(null)}
          delivery={selectedDeliveryToAssign}
          onSuccess={() => {
            loadData();
          }}
        />
      </div>
    </DashboardLayout>
  );
};
