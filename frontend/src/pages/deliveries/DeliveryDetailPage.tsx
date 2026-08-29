import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../../components/layout/DashboardLayout';
import { SectionCard } from '../../components/common/SectionCard';
import { StatCard } from '../../components/common/StatCard';
import { StatusBadge } from '../../components/common/StatusBadge';
import { RiskBadge } from '../../components/common/RiskBadge';
import { DeliveryTimeline } from '../../components/delivery/DeliveryTimeline';
import { DeliveryActions } from '../../components/delivery/DeliveryActions';
import { AssignDeliveryModal } from '../../components/delivery/AssignDeliveryModal';
import { DriverMap } from '../../components/map/DriverMap';
import { RouteRiskAnalysis } from '../../components/route/RouteRiskAnalysis';
import { LoadingState, ErrorState } from '../../components/common/EmptyState';
import { Button } from '../../components/common/Button';
import { useDelivery } from '../../hooks/useDelivery';
import { useSensorData } from '../../hooks/useSensorData';
import { useAuth } from '../../context/AuthContext';
import { locationsApi } from '../../api/locations';
import { DriverLocation } from '../../types';
import { formatNumber, formatDate } from '../../utils/formatters';
import { LiveStatusBadge } from '../../components/common/LiveStatusBadge';
import {
  ArrowLeft,
  Thermometer,
  Droplets,
  Wind,
  Clock,
  MapPin,
  Cpu,
  User,
  Activity,
  BrainCircuit,
  Phone,
  Mail,
  Truck,
  Hourglass,
  Radio,
  Share2
} from 'lucide-react';

export const DeliveryDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const deliveryId = parseInt(id || '0', 10);
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);

  const { delivery, loading: loadingDelivery, error: deliveryError, accept, reject, start, complete, refresh } =
    useDelivery(deliveryId);

  const isTracking = Boolean(delivery && ['assigned', 'accepted', 'in_transit'].includes(delivery.status));
  const { latestSensor, predictions } =
    useSensorData(deliveryId, 4000);

  const [locationsData, setLocationsData] = useState<{
    trail: DriverLocation[];
    latest: DriverLocation | null;
  }>({ trail: [], latest: null });

  useEffect(() => {
    if (!deliveryId) return;
    const fetchLocs = async () => {
      try {
        const res = await locationsApi.getLocationTrail(deliveryId);
        setLocationsData(res);
      } catch (err) {
        console.warn('Failed to load GPS trail', err);
      }
    };
    fetchLocs();
    let timer: any = null;
    if (isTracking) {
      timer = setInterval(fetchLocs, 10000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [deliveryId, isTracking]);

  const [elapsedHours, setElapsedHours] = useState<number>(0);

  useEffect(() => {
    if (!delivery) return;

    const calcHours = () => {
      if (delivery.started_at) {
        const endTime = delivery.completed_at ? new Date(delivery.completed_at).getTime() : Date.now();
        const startTime = new Date(delivery.started_at).getTime();
        return Math.max(0, (endTime - startTime) / (1000 * 60 * 60));
      }
      if (latestSensor?.storage_hours !== undefined && latestSensor.storage_hours > 0) {
        return latestSensor.storage_hours;
      }
      if (latestSensor?.storage_days !== undefined && latestSensor.storage_days > 0) {
        return latestSensor.storage_days * 24;
      }
      return 0;
    };

    setElapsedHours(calcHours());

    if (delivery.status === 'in_transit') {
      const interval = setInterval(() => {
        setElapsedHours(calcHours());
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [delivery, latestSensor]);

  if (loadingDelivery) {
    return (
      <DashboardLayout>
        <LoadingState message="Loading delivery telemetry record..." />
      </DashboardLayout>
    );
  }

  if (deliveryError || !delivery) {
    return (
      <DashboardLayout>
        <ErrorState
          title="Delivery Not Accessible"
          message={deliveryError || 'The requested delivery was not found or you lack authorization.'}
          onRetry={() => navigate(-1)}
        />
      </DashboardLayout>
    );
  }

  const isSender = user?.role === 'sender';
  const isDriver = user?.role === 'driver';
  const isAdmin = user?.role === 'admin';
  const isPending = delivery.status === 'pending';

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Back Link & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <button
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-900 font-semibold transition-colors mb-2 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Deliveries
            </button>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                {delivery.food_name}
              </h1>
              <StatusBadge status={delivery.status} />
              <RiskBadge level={latestSensor?.risk_level || 'LOW'} />
            </div>
            <p className="font-mono text-xs text-slate-500 mt-1 font-semibold">
              Tracking Code: #{delivery.delivery_code}
            </p>
          </div>

          {/* Quick Actions & Sharing */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                const trackUrl = `${window.location.origin}/track/${delivery.delivery_code}`;
                navigator.clipboard.writeText(trackUrl);
                alert(`Public tracking link copied to clipboard:\n${trackUrl}`);
              }}
              className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
              title="Copy public link to share live tracking with others"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Copy Public Link</span>
            </button>


            {(isAdmin || isSender) && isPending && (
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Cpu className="w-4 h-4" />}
                onClick={() => setIsAssignModalOpen(true)}
              >
                Assign Driver
              </Button>
            )}
          </div>
        </div>

        {/* Driver Action Control */}
        {isDriver && (
          <DeliveryActions
            delivery={delivery}
            onAccept={accept}
            onReject={reject}
            onStart={start}
            onComplete={complete}
            isDriver={true}
          />
        )}

        {/* Telemetry Sensor Overview Cards */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-600" />
              Latest Telemetry & Spoilage Indicators
            </h3>
            {latestSensor && (
              <span className="text-[11px] text-slate-500 font-mono font-medium">
                Updated: {formatDate(latestSensor.recorded_at)}
              </span>
            )}
          </div>

          {!latestSensor ? (
            <div className="p-8 rounded-2xl bg-white border border-slate-200 shadow-xs text-center text-xs text-slate-500">
              No sensor data received yet. Telemetry will begin once IoT hardware transmits data.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
              <StatCard
                title="Temperature"
                value={`${formatNumber(latestSensor.temperature)}°C`}
                icon={<Thermometer className="w-5 h-5" />}
                variant={latestSensor.temperature > 10 ? 'rose' : 'emerald'}
                subtitle="Chilled: 0-8°C"
              />
              <StatCard
                title="Humidity"
                value={`${formatNumber(latestSensor.humidity)}%`}
                icon={<Droplets className="w-5 h-5" />}
                variant={latestSensor.humidity > 80 ? 'amber' : 'sky'}
                subtitle="Safe: <80%"
              />
              <StatCard
                title="Methane Gas"
                value={`${formatNumber(latestSensor.methane, 3)} ppm`}
                icon={<Wind className="w-5 h-5" />}
                variant={latestSensor.methane > 0.03 ? 'rose' : 'default'}
                subtitle="Decomposition gas"
              />
              <StatCard
                title="CO2 Gas"
                value={`${formatNumber(latestSensor.co2, 0)} ppm`}
                icon={<Wind className="w-5 h-5" />}
                variant={latestSensor.co2 > 1000 ? 'rose' : 'default'}
                subtitle="Safe: <1000 ppm"
              />
              <StatCard
                title="Storage Hours"
                value={`${formatNumber(elapsedHours, 1)} hrs`}
                icon={<Clock className="w-5 h-5" />}
                variant={elapsedHours > 48 ? 'amber' : 'default'}
                subtitle={delivery.status === 'in_transit' ? 'Counting live' : 'Total transit duration'}
              />
              <StatCard
                title="Spoil In"
                value={
                  latestSensor.spoil_in !== undefined && latestSensor.spoil_in !== null
                    ? `${formatNumber(latestSensor.spoil_in, 1)} hrs`
                    : 'N/A'
                }
                icon={<Hourglass className="w-5 h-5" />}
                variant={
                  latestSensor.spoil_in === 0 || latestSensor.risk_level === 'CRITICAL'
                    ? 'rose'
                    : latestSensor.spoil_in !== undefined && latestSensor.spoil_in !== null && latestSensor.spoil_in <= 12
                    ? 'rose'
                    : latestSensor.spoil_in !== undefined && latestSensor.spoil_in !== null && latestSensor.spoil_in <= 24
                    ? 'amber'
                    : 'emerald'
                }
                subtitle={
                  latestSensor.spoil_in === 0
                    ? 'Cargo spoiled'
                    : 'Est. shelf life remaining'
                }
              />
              <StatCard
                title="Spoilage Risk"
                value={`${formatNumber(latestSensor.score, 1)} / 100`}
                icon={<BrainCircuit className="w-5 h-5" />}
                variant={
                  latestSensor.risk_level === 'CRITICAL' || latestSensor.risk_level === 'HIGH'
                    ? 'rose'
                    : latestSensor.risk_level === 'MEDIUM'
                    ? 'amber'
                    : 'emerald'
                }
                subtitle={`Status: ${latestSensor.status}`}
              />
            </div>
          )}
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Route Risk + Map + ML History */}
          <div className="flex flex-col gap-6 lg:col-span-2">
            <RouteRiskAnalysis delivery={delivery} />

            {/* Live GPS Map */}
            <SectionCard
              title={
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-emerald-600" />
                  <span>Real-Time GPS Route Tracking</span>
                </div>
              }
              subtitle="Vehicle position updates and historical trajectory trail"
              noPadding
            >
              <div className="p-1">
                <DriverMap
                  latestLocation={locationsData.latest}
                  trail={locationsData.trail}
                  height="340px"
                />
              </div>
            </SectionCard>

            {/* ML Spoilage Predictions Log Table */}
            <SectionCard
              title={
                <div className="flex items-center gap-2">
                  <BrainCircuit className="w-4 h-4 text-emerald-600" />
                  <span>Machine Learning Inference History</span>
                </div>
              }
              subtitle="Model Version: v1.0.0-spoilage-rf"
              noPadding
            >
              {predictions.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400">
                  No prediction inference records logged yet
                </div>
              ) : (
                <div className="max-h-60 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold sticky top-0">
                      <tr>
                        <th className="px-4 py-2.5">Timestamp</th>
                        <th className="px-4 py-2.5">Model</th>
                        <th className="px-4 py-2.5">Risk Score</th>
                        <th className="px-4 py-2.5">Classification</th>
                        <th className="px-4 py-2.5">Spoil In</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-800">
                      {predictions.slice(-10).reverse().map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50">
                          <td className="px-4 py-2 font-mono text-[11px] text-slate-500">
                            {formatDate(p.prediction_timestamp)}
                          </td>
                          <td className="px-4 py-2 font-mono text-[11px] text-slate-500">
                            {p.model_version}
                          </td>
                          <td className="px-4 py-2 font-bold text-slate-900">
                            {formatNumber(p.score, 1)} / 100
                          </td>
                          <td className="px-4 py-2">
                            <RiskBadge level={p.risk_level} />
                          </td>
                          <td className="px-4 py-2 font-mono font-bold text-slate-800">
                            {p.spoil_in !== undefined && p.spoil_in !== null
                              ? `${formatNumber(p.spoil_in, 1)} hrs`
                              : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>
          </div>

          {/* Right Column: Shipment Details & Timeline */}
          <div className="flex flex-col gap-6 lg:col-span-1">
            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider pb-2 border-b border-slate-100">
                Shipment Particulars
              </h4>

              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-slate-400 font-medium block mb-0.5">Food Item:</span>
                  <span className="font-bold text-slate-900 text-sm">{delivery.food_name}</span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-slate-400 font-medium block">From:</span>
                      <span className="text-slate-800 font-medium">{delivery.source_location}</span>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-slate-400 font-medium block">To:</span>
                      <span className="text-slate-800 font-medium">{delivery.destination_location}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <span className="text-slate-500 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400" /> Scheduled Start:
                  </span>
                  <span className="font-bold text-slate-800">
                    {formatDate(delivery.start_time || delivery.created_at)}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-400" /> Sender:
                  </span>
                  <span className="font-bold text-slate-800">{delivery.sender_name || delivery.sender_email}</span>
                </div>

                {/* Driver Information Card */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 flex items-center gap-1.5 font-bold">
                      <Truck className="w-3.5 h-3.5 text-emerald-600" /> Assigned Driver:
                    </span>
                    {delivery.driver_name ? (
                      <span className="font-bold text-slate-900">{delivery.driver_name}</span>
                    ) : (
                      <span className="text-slate-400 italic">Unassigned</span>
                    )}
                  </div>

                  {delivery.driver_name && (
                    <div className="space-y-1.5 pt-1 border-t border-slate-200/60 text-[11px]">
                      {delivery.driver_phone && (
                        <div className="flex items-center justify-between text-slate-700">
                          <span className="text-slate-500 flex items-center gap-1">
                            <Phone className="w-3 h-3 text-emerald-600" /> Phone:
                          </span>
                          <a
                            href={`tel:${delivery.driver_phone}`}
                            className="font-mono text-emerald-700 hover:text-emerald-800 font-bold"
                          >
                            {delivery.driver_phone}
                          </a>
                        </div>
                      )}
                      {delivery.driver_email && (
                        <div className="flex items-center justify-between text-slate-700">
                          <span className="text-slate-500 flex items-center gap-1">
                            <Mail className="w-3 h-3 text-slate-400" /> Email:
                          </span>
                          <span className="font-mono text-slate-700 truncate max-w-[150px]">
                            {delivery.driver_email}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 flex items-center gap-1.5 font-bold">
                      <Cpu className="w-3.5 h-3.5 text-emerald-600" /> IoT Telemetry Unit:
                    </span>
                    <LiveStatusBadge
                      isLive={Boolean(
                        latestSensor &&
                        (Date.now() - new Date(latestSensor.recorded_at).getTime() <= 120000)
                      )}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-200/60">
                    <span className="text-slate-400">Device ID:</span>
                    <span className="font-mono text-emerald-700 font-bold">
                      {delivery.device_id ? `#${delivery.device_id}` : 'Auto-paired with Driver'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Lifecycle Timeline */}
            <DeliveryTimeline delivery={delivery} />
          </div>
        </div>

        {/* Assign Driver Modal */}
        <AssignDeliveryModal
          isOpen={isAssignModalOpen}
          delivery={delivery}
          onClose={() => setIsAssignModalOpen(false)}
          onSuccess={() => {
            setIsAssignModalOpen(false);
            refresh();
          }}
        />
      </div>
    </DashboardLayout>
  );
};
