import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '../../components/layout/DashboardLayout';
import { StatCard } from '../../components/common/StatCard';
import { SectionCard } from '../../components/common/SectionCard';
import { DeliveryTable } from '../../components/delivery/DeliveryTable';
import { CreateDeliveryModal } from '../../components/delivery/CreateDeliveryModal';
import { AssignDeliveryModal } from '../../components/delivery/AssignDeliveryModal';
import { Delivery, DashboardStats } from '../../types';
import { adminApi } from '../../api/locations';
import { deliveriesApi } from '../../api/deliveries';
import { useToast } from '../../context/ToastContext';
import { Button } from '../../components/common/Button';
import { PlusCircle, Clock, Truck, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const SenderOverview: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [assignDeliveryTarget, setAssignDeliveryTarget] = useState<Delivery | null>(null);
  const toast = useToast();
  const navigate = useNavigate();

  const loadData = async () => {
    try {
      const [statsData, delivsData] = await Promise.all([
        adminApi.getDashboardStats(),
        deliveriesApi.listDeliveries({ limit: 10 })
      ]);
      setStats(statsData);
      setDeliveries(delivsData.deliveries);
    } catch (err: any) {
      toast.error('Failed to load sender dashboard');
    } finally {
      setLoading(false);
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
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Sender Portal</h1>
            <p className="text-xs text-slate-500 mt-1">
              Dispatch food cargo and track live temperature, humidity, and spoilage risk in transit
            </p>
          </div>
          <Button
            size="sm"
            leftIcon={<PlusCircle className="w-4 h-4" />}
            onClick={() => setIsCreateModalOpen(true)}
          >
            Create New Delivery
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            title="Pending Dispatch"
            value={stats?.pendingDeliveries || 0}
            icon={<Clock className="w-6 h-6" />}
            variant="amber"
            subtitle="Awaiting driver & IoT pairing"
          />
          <StatCard
            title="In Transit"
            value={stats?.currentDeliveries || 0}
            icon={<Truck className="w-6 h-6" />}
            variant="emerald"
            subtitle="Monitored with live telemetry"
          />
          <StatCard
            title="Completed"
            value={stats?.completedDeliveries || 0}
            icon={<CheckCircle2 className="w-6 h-6" />}
            variant="sky"
            subtitle="Safely delivered food shipments"
          />
        </div>

        {/* Recent Deliveries */}
        <SectionCard
          title="Recent Food Shipments"
          subtitle="Your submitted deliveries with live status tracking"
          action={
            <Button variant="ghost" size="sm" onClick={() => navigate('/sender/deliveries')}>
              View All →
            </Button>
          }
          noPadding
        >
          <DeliveryTable
            deliveries={deliveries}
            loading={loading}
            onAssignClick={(d) => setAssignDeliveryTarget(d)}
          />
        </SectionCard>

        {/* Create Modal */}
        <CreateDeliveryModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={() => loadData()}
        />

        {/* Assign Driver Modal */}
        <AssignDeliveryModal
          isOpen={Boolean(assignDeliveryTarget)}
          delivery={assignDeliveryTarget}
          onClose={() => setAssignDeliveryTarget(null)}
          onSuccess={() => {
            setAssignDeliveryTarget(null);
            loadData();
          }}
        />
      </div>
    </DashboardLayout>
  );
};
