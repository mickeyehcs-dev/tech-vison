import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '../../components/layout/DashboardLayout';
import { DriverMap } from '../../components/map/DriverMap';
import { Button } from '../../components/common/Button';
import { StatusBadge } from '../../components/common/StatusBadge';
import { RiskBadge } from '../../components/common/RiskBadge';
import { StatCard } from '../../components/common/StatCard';
import { EmptyState } from '../../components/common/EmptyState';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { Delivery, DriverLocation } from '../../types';
import { deliveriesApi } from '../../api/deliveries';
import { useGeolocation } from '../../hooks/useGeolocation';
import { useSensorData } from '../../hooks/useSensorData';
import { useToast } from '../../context/ToastContext';
import {
  Navigation,
  Play,
  CheckCheck,
  CheckCircle2,
  XCircle,
  Thermometer,
  Droplets,
  Wind,
  Cpu,
  MapPin,
  Radio,
  Hourglass
} from 'lucide-react';
import { LiveStatusBadge } from '../../components/common/LiveStatusBadge';
import { RouteRiskAnalysis } from '../../components/route/RouteRiskAnalysis';
import { RouteAnalyzeResponse } from '../../api/routeApi';
import { formatNumber, formatTravelTime } from '../../utils/formatters';

export const DriverActiveDelivery: React.FC = () => {
  const [activeDeliveries, setActiveDeliveries] = useState<Delivery[]>([]);
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);
  const [routeData, setRouteData] = useState<RouteAnalyzeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGpsEnabled] = useState(true);
  const toast = useToast();

  const loadActiveRuns = async () => {
    try {
      const res = await deliveriesApi.listDeliveries({ statusGroup: 'current', limit: 20 });
      setActiveDeliveries(res.deliveries);
      if (res.deliveries.length > 0) {
        setSelectedDelivery((prev) =>
          prev ? res.deliveries.find((d) => d.id === prev.id) || res.deliveries[0] : res.deliveries[0]
        );
      } else {
        setSelectedDelivery(null);
      }
    } catch (err: any) {
      toast.error('Failed to load active runs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadActiveRuns();
  }, []);

  const { coords, accuracy, permissionGranted } = useGeolocation(
    selectedDelivery?.id,
    isGpsEnabled && Boolean(selectedDelivery && selectedDelivery.status === 'in_transit')
  );

  const { latestSensor } = useSensorData(
    selectedDelivery?.id || 0,
    selectedDelivery?.status === 'in_transit' ? 5000 : 0
  );

  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);

  const handleAccept = async () => {
    if (!selectedDelivery) return;
    try {
      const updated = await deliveriesApi.acceptDelivery(selectedDelivery.id);
      toast.success('Delivery accepted! Ready to start transit.');
      setSelectedDelivery(updated);
      loadActiveRuns();
    } catch (err: any) {
      toast.error(err.message || 'Failed to accept');
    }
  };

  const handleReject = async () => {
    if (!selectedDelivery) return;
    try {
      await deliveriesApi.rejectDelivery(selectedDelivery.id);
      toast.info('Delivery assignment declined. Returned to pending queue.');
      setIsRejectDialogOpen(false);
      setSelectedDelivery(null);
      loadActiveRuns();
    } catch (err: any) {
      toast.error(err.message || 'Failed to decline delivery');
    }
  };

  const handleStart = async () => {
    if (!selectedDelivery) return;
    try {
      const updated = await deliveriesApi.startDelivery(selectedDelivery.id);
      toast.success('Delivery started! GPS tracking & IoT sensor telemetry live.');
      setSelectedDelivery(updated);
      loadActiveRuns();
    } catch (err: any) {
      toast.error(err.message || 'Failed to start');
    }
  };

  const handleComplete = async () => {
    if (!selectedDelivery) return;
    try {
      await deliveriesApi.completeDelivery(selectedDelivery.id);
      toast.success('Delivery completed successfully! Sensor released.');
      setSelectedDelivery(null);
      loadActiveRuns();
    } catch (err: any) {
      toast.error(err.message || 'Failed to complete');
    }
  };

  const simulatedLatestLoc: DriverLocation | null = coords && selectedDelivery
    ? {
        id: 0,
        driver_id: selectedDelivery.driver_id || 0,
        delivery_id: selectedDelivery.id,
        latitude: coords.latitude,
        longitude: coords.longitude,
        recorded_at: new Date().toISOString()
      }
    : null;

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6">
        {/* Top Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Radio className="w-6 h-6 text-emerald-600 animate-pulse" />
              On-Road Mobile Driver Console
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Live vehicle GPS transmission, instant status controls, and cargo environment telemetry
            </p>
          </div>

          {/* Delivery selector tabs */}
          {activeDeliveries.length > 1 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full">
              {activeDeliveries.map((deliv) => (
                <button
                  key={deliv.id}
                  onClick={() => setSelectedDelivery(deliv)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border cursor-pointer ${
                    selectedDelivery?.id === deliv.id
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  #{deliv.delivery_code} - {deliv.food_name}
                </button>
              ))}
            </div>
          )}
        </div>

        {!selectedDelivery ? (
          <EmptyState
            icon={<CheckCircle2 className="w-10 h-10 text-emerald-600" />}
            title="No Active Runs"
            message="You have no shipments currently in transit or pending acceptance. Stand by for new assignments."
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column: Shipment Info & Large Mobile Actions */}
            <div className="flex flex-col gap-6 lg:col-span-1">
              {/* Delivery overview card */}
              <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="font-mono text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      #{selectedDelivery.delivery_code}
                    </span>
                    <StatusBadge status={selectedDelivery.status} />
                  </div>

                  <h3 className="text-xl font-black text-slate-900 mb-2">
                    {selectedDelivery.food_name}
                  </h3>

                  <div className="space-y-2.5 p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-700 my-4">
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-slate-500 font-medium block">Pickup:</strong>
                        <span>{selectedDelivery.source_location}</span>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-slate-500 font-medium block">Destination:</strong>
                        <span>{selectedDelivery.destination_location}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-500 pb-2">
                    <span>Sender:</span>
                    <span className="font-bold text-slate-800">{selectedDelivery.sender_name || 'Merchant'}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>IoT Unit:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-emerald-700 font-bold">{selectedDelivery.device_id || 'SFM Device'}</span>
                      <LiveStatusBadge
                        isLive={Boolean(
                          latestSensor &&
                          (Date.now() - new Date(latestSensor.recorded_at).getTime() <= 120000)
                        )}
                      />
                    </div>
                  </div>
                </div>

                {/* Big Mobile Action Controls */}
                <div className="pt-6 border-t border-slate-100 flex flex-col gap-3 mt-4">
                  {selectedDelivery.status === 'assigned' && (
                    <div className="flex flex-col gap-2.5">
                      <Button
                        variant="primary"
                        size="lg"
                        className="w-full py-3.5 text-base font-bold shadow-sm"
                        leftIcon={<CheckCircle2 className="w-5 h-5" />}
                        onClick={handleAccept}
                      >
                        Accept Assignment
                      </Button>
                      <Button
                        variant="outline"
                        size="md"
                        className="w-full text-rose-700 hover:bg-rose-50 border-rose-200"
                        leftIcon={<XCircle className="w-4 h-4" />}
                        onClick={() => setIsRejectDialogOpen(true)}
                      >
                        Decline / Reject Assignment
                      </Button>
                    </div>
                  )}

                  {selectedDelivery.status === 'accepted' && (
                    <Button
                      variant="success"
                      size="lg"
                      className="w-full py-3.5 text-base font-bold shadow-sm"
                      leftIcon={<Play className="w-5 h-5" />}
                      onClick={handleStart}
                    >
                      Start Delivery Run
                    </Button>
                  )}

                  {selectedDelivery.status === 'in_transit' && (
                    <Button
                      variant="primary"
                      size="lg"
                      className="w-full py-3.5 text-base font-bold shadow-sm"
                      leftIcon={<CheckCheck className="w-6 h-6" />}
                      onClick={handleComplete}
                    >
                      Confirm Drop-off & Complete
                    </Button>
                  )}
                </div>
              </div>

              {/* Reject Confirmation Dialog */}
              <ConfirmDialog
                isOpen={isRejectDialogOpen}
                onClose={() => setIsRejectDialogOpen(false)}
                onConfirm={handleReject}
                title="Decline Delivery Assignment"
                message={`Are you sure you want to decline delivery #${selectedDelivery.delivery_code} (${selectedDelivery.food_name})? The shipment will be returned to the pending queue for another driver.`}
                confirmText="Yes, Decline"
                variant="danger"
              />

              {/* GPS Status Card */}
              <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs text-xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-slate-900 flex items-center gap-1.5">
                    <Navigation className="w-4 h-4 text-emerald-600" />
                    GPS Tracking Status
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      permissionGranted
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}
                  >
                    {permissionGranted ? 'TRANSMITTING' : 'PERM REQUIRED'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  {permissionGranted
                    ? `Live coordinates: ${coords?.latitude.toFixed(5)}, ${coords?.longitude.toFixed(5)}`
                    : 'Please allow browser location permissions to transmit route updates to customer and dispatch.'}
                </p>
              </div>
            </div>

            {/* Right Column: Live Map & Real-Time IoT Telemetry Cards */}
            <div className="flex flex-col gap-6 lg:col-span-2">
              {/* Map */}
              <div className="rounded-2xl overflow-hidden shadow-xs border border-slate-200">
                <DriverMap
                  latestLocation={simulatedLatestLoc}
                  height="340px"
                  interactive={true}
                />
              </div>

              {/* Live Telemetry Sensors Grid */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-emerald-600" />
                    Live Cargo Environmental Telemetry
                  </h4>
                  {latestSensor && (
                    <RiskBadge level={latestSensor.risk_level} score={Number(latestSensor.score)} showScore />
                  )}
                </div>

                {!latestSensor ? (
                  <div className="p-8 text-center rounded-2xl bg-white border border-slate-200 shadow-xs text-xs text-slate-500">
                    No sensor data received yet. Waiting for hardware module transmission.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    <StatCard
                      title="Temperature"
                      value={`${formatNumber(latestSensor.temperature)}°C`}
                      icon={<Thermometer className="w-5 h-5" />}
                      variant={latestSensor.temperature > 10 ? 'rose' : 'emerald'}
                      subtitle="Safe: 0-8°C"
                    />
                    <StatCard
                      title="Humidity"
                      value={`${formatNumber(latestSensor.humidity)}%`}
                      icon={<Droplets className="w-5 h-5" />}
                      variant={latestSensor.humidity > 80 ? 'amber' : 'sky'}
                      subtitle="Optimal: <75%"
                    />
                    <StatCard
                      title="Methane Gas"
                      value={`${formatNumber(latestSensor.methane, latestSensor.methane >= 1 ? 1 : 3)} ppm`}
                      icon={<Wind className="w-5 h-5" />}
                      variant={latestSensor.methane > 25 || (latestSensor.methane > 0.03 && latestSensor.methane < 1) ? 'rose' : 'default'}
                      subtitle="Spoilage marker"
                    />
                    <StatCard
                      title="CO2 Gas"
                      value={`${formatNumber(latestSensor.co2, 0)} ppm`}
                      icon={<Wind className="w-5 h-5" />}
                      variant={latestSensor.co2 > 1000 ? 'rose' : 'default'}
                      subtitle="Threshold: <1000"
                    />
                    <StatCard
                      title="Total Est. Transit"
                      value={
                        routeData?.route
                          ? formatTravelTime(
                              routeData.route.estimated_travel_time_minutes ||
                              Math.round(routeData.route.travel_time_minutes * 1.2)
                            )
                          : '--'
                      }
                      icon={<Navigation className="w-5 h-5" />}
                      variant="sky"
                      subtitle={
                        routeData?.route
                          ? `${routeData.route.distance_km.toFixed(0)} km (Route API)`
                          : 'Route Weather API'
                      }
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
                          : 'Est. shelf life'
                      }
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Route Risk & Weather Waypoint Analysis */}
            <RouteRiskAnalysis delivery={selectedDelivery} onRouteDataLoaded={setRouteData} />
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};
